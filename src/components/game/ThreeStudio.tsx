'use client';

import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Sparkles, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, type ComponentRef, type RefObject } from 'react';
import { STUDIO_OBJECTS, type StudioObject } from '@/data/studio-layout';
import { interactionById } from '@/data/interactions';
import { useGameStore } from '@/store/game-store';
import { RoomObjectModel, DESK_Y, DESKTOP_IDS, TABLE2_Y, TABLE_IDS } from './RoomObjectModel';
import { playModularPatch } from '@/game/audio/sfx';
import { dayCycle } from '@/game/simulation/day-cycle';

const toWorld = (x: number, y: number): [number, number] => [(x - 640) / 90, (y - 510) / 90];
/** Inverse of toWorld: a floor click's world point back to the logical room coordinate the sim uses. */
const toLogical = (worldX: number, worldZ: number) => ({ x: worldX * 90 + 640, y: worldZ * 90 + 510 });
const crystalColor = { red: '#d84f59', yellow: '#e6c34c', green: '#62cf86' } as const;

/** Distinguish a click from an orbit-drag so releasing a rotation over an object doesn't select or use it. */
let pointerDownAt: { x: number; y: number } | null = null;
const isDrag = (event: MouseEvent) => (pointerDownAt ? Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y) > 6 : false);

/** Mouse-drag orbits the view around a fixed room-centre axis, so WASD/click movement visibly walks the producer across the room. */
function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useFrame(() => { controls.current?.update(); });
  return <OrbitControls ref={controls} makeDefault target={[0, 1.2, -1]} enablePan={false} enableZoom minDistance={7} maxDistance={24} minPolarAngle={Math.PI * 0.16} maxPolarAngle={Math.PI * 0.46} enableDamping dampingFactor={0.12} />;
}

function EmotionalCrystal({ y }: { y: number }) {
  const state = useGameStore((store) => store.crystal);
  const color = crystalColor[state];
  return <group position={[0, y, 0]}>
    {[0, Math.PI / 3, -Math.PI / 3].map((rotation) => <mesh key={rotation} rotation={[0, 0, rotation]}>
      <boxGeometry args={[0.09, 0.6, 0.09]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
    </mesh>)}
    <pointLight color={color} intensity={4} distance={4} /><Sparkles count={12} scale={0.9} size={1.4} color={color} />
  </group>;
}

const CLOTH = '#161a24';
const CLOTH_DARK = '#0e111a';

type GrooveRefs = {
  torso: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
  foreL: RefObject<THREE.Group | null>;
  foreR: RefObject<THREE.Group | null>;
};
type GroovePose = { hipY: number; shoulderY: number; armX: number; armZ: number };

/**
 * The "vibing to the track" loop both producers play while a tune is being built: the upper body rocks
 * forward and back on the beat, the arms swing, the forearms sweep side to side, the shoulders lift
 * alternately and the head nods — energetic but relaxed. `grooveOffset` keeps the two figures off each
 * other's phase so they read as two people, not a mirrored pair.
 */
function useGroove(active: boolean, refs: GrooveRefs, pose: GroovePose, grooveOffset: number) {
  const amount = useRef(0);
  useFrame(({ clock }, delta) => {
    amount.current += ((active ? 1 : 0) - amount.current) * Math.min(1, delta * 3); // eases in and out, never snaps
    const k = amount.current;
    if (k < 0.002) return;
    const t = clock.elapsedTime + grooveOffset;
    const beat = t * 5.4;
    const nodBurst = Math.pow(Math.max(0, Math.sin(t * 0.4)), 8); // an emphatic nod every few bars
    if (refs.torso.current) {
      refs.torso.current.rotation.x = Math.sin(beat) * 0.15 * k;
      refs.torso.current.rotation.z = Math.sin(beat * 0.5) * 0.06 * k;
      refs.torso.current.position.y = pose.hipY + Math.abs(Math.sin(beat)) * 0.04 * k;
    }
    if (refs.head.current) {
      refs.head.current.rotation.x = (Math.sin(beat) * 0.07 + nodBurst * Math.sin(beat * 2) * 0.24) * k;
      refs.head.current.rotation.y = Math.sin(beat * 0.33) * 0.15 * k;
    }
    const swingArm = (upper: THREE.Group | null, fore: THREE.Group | null, side: number) => {
      if (upper) {
        upper.rotation.x = pose.armX + (-0.5 + Math.sin(beat) * 0.38 * side) * k;
        upper.rotation.z = pose.armZ * side + (0.3 + Math.sin(beat * 0.5) * 0.18) * k * side;
        upper.position.y = pose.shoulderY + Math.sin(beat + (side > 0 ? Math.PI : 0)) * 0.022 * k;
      }
      if (fore) {
        fore.rotation.x = -(0.55 + Math.sin(beat) * 0.25) * k;
        fore.rotation.z = Math.sin(beat + side * 0.6) * 0.5 * k * side;
      }
    };
    swingArm(refs.armL.current, refs.foreL.current, -1);
    swingArm(refs.armR.current, refs.foreR.current, 1);
  });
}

/** Everything from the hips up, shared by the standing and seated poses (offsets are relative to hip height). */
function UpperBody({ hipY, cloth = CLOTH, groove = false, grooveOffset = 0 }: { hipY: number; cloth?: string; groove?: boolean; grooveOffset?: number }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  useGroove(groove, { torso, head, armL, armR, foreL, foreR }, { hipY, shoulderY: 0.66, armX: 0.05, armZ: -0.12 }, grooveOffset);
  return <group ref={torso} position={[0, hipY, 0]}>
    {/* Voxel-like hoodie: low-poly, squared planes and deliberately visible block proportions. */}
    <mesh position={[0, 0.38, 0]} castShadow><boxGeometry args={[0.62, 0.76, 0.38]} /><meshStandardMaterial color={cloth} roughness={0.96} /></mesh>
    <mesh position={[0, 0.77, 0.02]} castShadow><boxGeometry args={[0.72, 0.22, 0.44]} /><meshStandardMaterial color="#202633" roughness={0.95} /></mesh>
    {/* Arms hinge at the shoulder with a second joint at the elbow, so they can swing and the forearms can sweep. */}
    <group ref={armL} position={[-0.43, 0.66, 0.02]} rotation={[0.05, 0, 0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><boxGeometry args={[0.18, 0.32, 0.2]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh>
      <group ref={foreL} position={[0, -0.32, 0]}><mesh position={[0, -0.14, 0]} castShadow><boxGeometry args={[0.17, 0.29, 0.19]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh></group>
    </group>
    <group ref={armR} position={[0.43, 0.66, 0.02]} rotation={[0.05, 0, -0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><boxGeometry args={[0.18, 0.32, 0.2]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh>
      <group ref={foreR} position={[0, -0.32, 0]}><mesh position={[0, -0.14, 0]} castShadow><boxGeometry args={[0.17, 0.29, 0.19]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh></group>
    </group>
    <mesh position={[0, 0.38, -0.205]}><boxGeometry args={[0.055, 0.62, 0.025]} /><meshStandardMaterial color="#05070c" metalness={0.35} /></mesh>
    {/* Square head inset inside a raised hood, pivoted at the neck so it can nod and turn. */}
    <group ref={head} position={[0, 0.8, 0]}>
      <mesh position={[0, 0.23, -0.08]} castShadow><boxGeometry args={[0.34, 0.38, 0.31]} /><meshStandardMaterial color="#4b3b3d" roughness={0.95} /></mesh>
      <mesh position={[0, 0.27, 0.07]} castShadow><boxGeometry args={[0.55, 0.58, 0.5]} /><meshStandardMaterial color={cloth} roughness={0.98} /></mesh>
      <mesh position={[0, 0.22, -0.24]}><boxGeometry args={[0.38, 0.38, 0.08]} /><meshStandardMaterial color="#2a2d36" /></mesh>
      {/* Pixel headphones: squared band and chunky ear cups over the raised hood. */}
      <mesh position={[0, 0.6, 0.04]}><boxGeometry args={[0.62, 0.1, 0.14]} /><meshStandardMaterial color="#090b10" /></mesh>
      <mesh position={[-0.36, 0.24, 0.02]}><boxGeometry args={[0.16, 0.3, 0.2]} /><meshStandardMaterial color="#090b10" /></mesh>
      <mesh position={[0.36, 0.24, 0.02]}><boxGeometry args={[0.16, 0.3, 0.2]} /><meshStandardMaterial color="#090b10" /></mesh>
      <mesh position={[-0.45, 0.24, 0.02]}><boxGeometry args={[0.045, 0.13, 0.14]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.45, 0.24, 0.02]}><boxGeometry args={[0.045, 0.13, 0.14]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.5} /></mesh>
    </group>
  </group>;
}

function StandingLegs() {
  return <>
    <mesh position={[-0.15, 0.42, 0]} castShadow><boxGeometry args={[0.22, 0.78, 0.24]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.95} /></mesh>
    <mesh position={[0.15, 0.42, 0]} castShadow><boxGeometry args={[0.22, 0.78, 0.24]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.95} /></mesh>
    {/* shoes point −z (forward), matching the face, so the figure reads as facing/walking forward */}
    <mesh position={[-0.15, 0.06, -0.1]} castShadow><boxGeometry args={[0.2, 0.12, 0.36]} /><meshStandardMaterial color="#07090e" /></mesh>
    <mesh position={[0.15, 0.06, -0.1]} castShadow><boxGeometry args={[0.2, 0.12, 0.36]} /><meshStandardMaterial color="#07090e" /></mesh>
  </>;
}

/** Seated facing the desk (−z): thighs run forward under the desk, shins drop to the floor. */
function SittingLegs() {
  return <>
    <mesh position={[-0.15, 0.6, -0.28]} castShadow><boxGeometry args={[0.18, 0.16, 0.55]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[0.15, 0.6, -0.28]} castShadow><boxGeometry args={[0.18, 0.16, 0.55]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[-0.15, 0.3, -0.52]} castShadow><boxGeometry args={[0.15, 0.6, 0.16]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[0.15, 0.3, -0.52]} castShadow><boxGeometry args={[0.15, 0.6, 0.16]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[-0.15, 0.06, -0.62]} castShadow><boxGeometry args={[0.2, 0.12, 0.32]} /><meshStandardMaterial color="#07090e" /></mesh>
    <mesh position={[0.15, 0.06, -0.62]} castShadow><boxGeometry args={[0.2, 0.12, 0.32]} /><meshStandardMaterial color="#07090e" /></mesh>
  </>;
}

/** One leg pivoted at the hip so it can swing during the walk cycle. */
function WalkLeg({ legRef, x }: { legRef: RefObject<THREE.Group | null>; x: number }) {
  return <group ref={legRef} position={[x, 0.85, 0]}>
    <mesh position={[0, -0.43, 0]} castShadow><boxGeometry args={[0.22, 0.82, 0.24]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.95} /></mesh>
    {/* toe points −z (forward), matching the face */}
    <mesh position={[0, -0.79, -0.1]} castShadow><boxGeometry args={[0.2, 0.12, 0.36]} /><meshStandardMaterial color="#07090e" /></mesh>
  </group>;
}

/** Standing/walking figure: turns to face the direction of travel and plays a bob + leg-swing cycle scaled by speed. */
function WalkingFigure() {
  const figure = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const last = useRef({ x: 0, z: 0, ready: false });
  const phase = useRef(0);
  const facing = useRef(0);
  const swing = useRef(0);
  useFrame((_, dt) => {
    const p = useGameStore.getState().playerPosition;
    const [x, z] = toWorld(p.x, p.y);
    if (!last.current.ready) last.current = { x, z, ready: true };
    const dx = x - last.current.x;
    const dz = z - last.current.z;
    last.current.x = x; last.current.z = z;
    const dist = Math.hypot(dx, dz);
    const speed = dt > 0 ? dist / dt : 0;
    const moving = dist > 0.0015;
    if (moving) {
      const target = Math.atan2(-dx, -dz); // model faces -z by default; turn toward travel
      const diff = Math.atan2(Math.sin(target - facing.current), Math.cos(target - facing.current));
      facing.current += diff * Math.min(1, dt * 14);
      phase.current += dt * (7 + Math.min(speed, 14) * 1.5);
    }
    const targetSwing = moving ? Math.sin(phase.current) * Math.min(0.75, 0.35 + speed * 0.05) : 0;
    swing.current += (targetSwing - swing.current) * Math.min(1, dt * 12);
    if (figure.current) figure.current.rotation.y = facing.current;
    if (bob.current) {
      bob.current.position.y = moving ? Math.abs(Math.sin(phase.current)) * Math.min(0.09, 0.03 + speed * 0.006) : 0;
      bob.current.rotation.x += ((moving ? -0.16 : 0) - bob.current.rotation.x) * Math.min(1, dt * 10); // lean forward while walking
    }
    if (legL.current) legL.current.rotation.x = swing.current;
    if (legR.current) legR.current.rotation.x = -swing.current;
  });
  return <group ref={figure}>
    <WalkLeg legRef={legL} x={-0.15} />
    <WalkLeg legRef={legR} x={0.15} />
    <group ref={bob}><UpperBody hipY={0.82} /></group>
  </group>;
}

type Puff = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; span: number; scale: number };

/**
 * Soft smoke: a recycled pool of voxel puffs that drift upward with a little wander and fade out.
 * `emit()` is called by the smoking cycle — a trickle from the lit tip, a slower cloud on the exhale.
 */
function SmokePuffs({ emitter }: { emitter: (emit: (x: number, y: number, z: number, strength: number) => void, delta: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo<Puff[]>(() => Array.from({ length: 34 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, span: 1, scale: 1 })), []);
  useFrame((_, delta) => {
    const meshes = group.current?.children;
    if (!meshes) return;
    const emit = (x: number, y: number, z: number, strength: number) => {
      const free = puffs.find((puff) => puff.life <= 0);
      if (!free) return;
      free.x = x + (Math.random() - 0.5) * 0.05;
      free.y = y;
      free.z = z + (Math.random() - 0.5) * 0.05;
      free.vx = (Math.random() - 0.5) * 0.13 * strength;
      free.vy = 0.16 + Math.random() * 0.14 * strength;
      free.vz = -(0.04 + Math.random() * 0.12) * strength; // drifts away from the face
      free.span = (1.6 + Math.random() * 1.4) * (0.7 + strength * 0.5);
      free.life = free.span;
      free.scale = (0.045 + Math.random() * 0.04) * (0.8 + strength * 0.9);
    };
    emitter(emit, delta);
    for (let i = 0; i < puffs.length; i += 1) {
      const puff = puffs[i];
      const mesh = meshes[i] as THREE.Mesh;
      if (puff.life <= 0) { mesh.visible = false; continue; }
      puff.life -= delta;
      const age = 1 - puff.life / puff.span;
      puff.x += (puff.vx + Math.sin((puff.y + i) * 3.1) * 0.03) * delta; // slight randomised wander
      puff.y += puff.vy * delta;
      puff.z += puff.vz * delta;
      puff.vy += 0.045 * delta; // rises a touch faster as it thins out
      mesh.visible = true;
      mesh.position.set(puff.x, puff.y, puff.z);
      mesh.rotation.y += delta * 0.5;
      const grown = puff.scale * (1 + age * 3.2);
      mesh.scale.setScalar(grown);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.3 * (1 - age) * Math.min(1, age * 6));
    }
  });
  return <group ref={group}>
    {puffs.map((_, index) => <mesh key={index} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#c7cdd2" transparent opacity={0} depthWrite={false} />
    </mesh>)}
  </group>;
}

const SMOKE_RAISE = 1.1; // hand travels up to the mouth
const SMOKE_INHALE = 0.9; // held at the lips, drawing
const SMOKE_LOWER = 1.0; // hand comes back down while exhaling
const SMOKE_REST = 2.6; // held at the side between drags
const SMOKE_CYCLE = SMOKE_RAISE + SMOKE_INHALE + SMOKE_LOWER + SMOKE_REST;

/**
 * Cinematic smoking loop: raise the cigarette to the mouth, hold briefly while inhaling (the tip glows),
 * then lower the hand while the exhale streams from the mouth. The lit tip smoulders the whole time.
 */
function SmokingEffect({ hipY }: { hipY: number }) {
  const smoking = useGameStore((state) => state.smokingMinutes > 0);
  const arm = useRef<THREE.Group>(null);
  const ember = useRef<THREE.Mesh>(null);
  const phase = useRef(SMOKE_RAISE + SMOKE_INHALE + SMOKE_LOWER); // start at rest, first drag comes shortly
  const exhale = useRef(0);
  const tipTrickle = useRef(0);
  const smoothing = (from: number, to: number, t: number) => from + (to - from) * (t * t * (3 - 2 * t));
  const restPos: [number, number, number] = [0.34, hipY + 0.16, -0.16];
  const mouthPos: [number, number, number] = [0.13, hipY + 0.92, -0.24];
  useFrame((_, delta) => {
    if (!smoking || !arm.current) return;
    phase.current = (phase.current + delta) % SMOKE_CYCLE;
    const t = phase.current;
    let lift = 0; // 0 = hand at the side, 1 = cigarette at the lips
    let drawing = false;
    if (t < SMOKE_RAISE) lift = smoothing(0, 1, t / SMOKE_RAISE);
    else if (t < SMOKE_RAISE + SMOKE_INHALE) { lift = 1; drawing = true; }
    else if (t < SMOKE_RAISE + SMOKE_INHALE + SMOKE_LOWER) lift = smoothing(1, 0, (t - SMOKE_RAISE - SMOKE_INHALE) / SMOKE_LOWER);
    arm.current.position.set(
      restPos[0] + (mouthPos[0] - restPos[0]) * lift,
      restPos[1] + (mouthPos[1] - restPos[1]) * lift,
      restPos[2] + (mouthPos[2] - restPos[2]) * lift,
    );
    arm.current.rotation.z = -0.35 + lift * 0.95; // wrist turns in as it reaches the mouth
    arm.current.rotation.x = lift * -0.45;
    if (ember.current) {
      const material = ember.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity += ((drawing ? 4.2 : 1.5) - material.emissiveIntensity) * Math.min(1, delta * 6);
    }
    // The exhale window opens the moment the hand starts back down.
    exhale.current = t >= SMOKE_RAISE + SMOKE_INHALE && t < SMOKE_RAISE + SMOKE_INHALE + 0.85 ? exhale.current + delta : 0;
    tipTrickle.current += delta;
  });
  if (!smoking) return null;
  const emitter = (emit: (x: number, y: number, z: number, strength: number) => void, delta: number) => {
    const hand = arm.current;
    if (!hand) return;
    // A thin wisp keeps rising off the lit tip while the cigarette is simply held.
    if (tipTrickle.current > 0.22) {
      tipTrickle.current = 0;
      emit(hand.position.x, hand.position.y + 0.16, hand.position.z, 0.35);
    }
    // Exhale: a slower, wider cloud leaving the mouth.
    if (exhale.current > 0 && exhale.current < 0.85 && Math.random() < delta * 26) {
      emit(0.06, hipY + 0.9, -0.3, 1);
    }
  };
  return <group>
    <group ref={arm} position={restPos} rotation={[0, 0, -0.35]}>
      <mesh><cylinderGeometry args={[0.017, 0.017, 0.26, 8]} /><meshStandardMaterial color="#f0e2c2" /></mesh>
      <mesh ref={ember} position={[0, 0.15, 0]}><cylinderGeometry args={[0.019, 0.019, 0.045, 8]} /><meshStandardMaterial color="#ff7a35" emissive="#ff5e1a" emissiveIntensity={1.5} toneMapped={false} /></mesh>
    </group>
    <SmokePuffs emitter={emitter} />
  </group>;
}

/** A stylised human silhouette. Swaps between standing/walking, seated and lying poses. */
function Player() {
  const position = useGameStore((state) => state.playerPosition);
  const seated = useGameStore((state) => state.seated);
  const lyingDown = useGameStore((state) => state.lyingDown);
  const scrolling = useGameStore((state) => state.scrolling);
  const friendActivity = useGameStore((state) => state.friendActivity);
  const [x, z] = toWorld(position.x, position.y);
  if (lyingDown) {
    // Lie on the mattress: tip the upright body onto its back (head toward +z, on the pillow) and raise to bed height.
    return <group position={[x, 0, z]}>
      <group position={[0, 0.55, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <UpperBody hipY={0.82} />
        <StandingLegs />
      </group>
      {/* doom-scrolling: a glowing phone held up over the face */}
      {scrolling && <group position={[0, 0.95, 0.55]}>
        <mesh rotation={[-0.6, 0, 0]}><boxGeometry args={[0.24, 0.44, 0.02]} /><meshStandardMaterial color="#0c0e14" /></mesh>
        <mesh position={[0, 0, 0.02]} rotation={[-0.6, 0, 0]}><planeGeometry args={[0.2, 0.38]} /><meshStandardMaterial color="#3a4a70" emissive="#5468a0" emissiveIntensity={1.3} toneMapped={false} /></mesh>
        <pointLight color="#6a7fb8" intensity={0.7} distance={1.2} />
      </group>}
      <EmotionalCrystal y={1.5} />
    </group>;
  }
  if (seated) {
    return <group position={[x, 0, z]}>
      <SittingLegs />
      <UpperBody hipY={0.62} groove={friendActivity === 'tune'} />
      {friendActivity === 'tune' && <TunePerformance />}
      {friendActivity === 'vodka' && <mesh position={[0.24, 1.05, -0.42]}><cylinderGeometry args={[0.08, 0.1, 0.52, 12]} /><meshStandardMaterial color="#52758e" transparent opacity={0.8} /></mesh>}
      {friendActivity === 'video-game' && <mesh position={[0, 1.18, -0.48]} rotation={[-0.28, 0, 0]}><boxGeometry args={[0.54, 0.3, 0.06]} /><meshStandardMaterial color="#263b48" emissive="#315f76" emissiveIntensity={0.8} /></mesh>}
      <SmokingEffect hipY={0.62} />
      <EmotionalCrystal y={2.22} />
    </group>;
  }
  return <group position={[x, 0, z]}>
    <WalkingFigure />
    <SmokingEffect hipY={0.82} />
    <EmotionalCrystal y={2.72} />
  </group>;
}

/** The called-over friend: a taller figure in a different coat who walks in and faces the producer. */
function FriendTorso({ hipY, sipping = false, groove = false }: { hipY: number; sipping?: boolean; groove?: boolean }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  // Offset a beat behind the producer so the pair reads as two people vibing, not one mirrored figure.
  useGroove(groove, { torso, head, armL, armR, foreL, foreR }, { hipY, shoulderY: 0.98, armX: 0.12, armZ: 0.12 }, 0.9);
  return <group ref={torso} position={[0, hipY, 0]}>
    <mesh position={[0, 0.54, 0]} castShadow><boxGeometry args={[0.46, 1.08, 0.3]} /><meshStandardMaterial color="#12161e" roughness={0.96} /></mesh>
    {/* Long arms hinge at the shoulder and elbow, so they stay attached standing, seated, sipping and grooving. */}
    <group ref={armL} position={[-0.29, 0.98, -0.03]} rotation={[sipping ? -0.7 : 0.12, 0, sipping ? -0.22 : -0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.055, 0.26, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh>
      <group ref={foreL} position={[0, -0.34, 0]} rotation={[sipping ? -0.85 : 0, 0, 0]}><mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.05, 0.22, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh></group>
    </group>
    <group ref={armR} position={[0.29, 0.98, -0.03]} rotation={[sipping ? -0.7 : 0.12, 0, sipping ? 0.22 : 0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.055, 0.26, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh>
      <group ref={foreR} position={[0, -0.34, 0]} rotation={[sipping ? -0.85 : 0, 0, 0]}><mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.05, 0.22, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh></group>
    </group>
    {/* Head and dreadlocks pivot together at the neck so the friend can nod along. */}
    <group ref={head} position={[0, 1.0, 0]}>
      <mesh position={[0, 0.18, -0.03]}><boxGeometry args={[0.31, 0.36, 0.29]} /><meshStandardMaterial color="#4a3530" /></mesh>
      {[-0.18, -0.09, 0, 0.09, 0.18].map((x, index) => <mesh key={x} position={[x, 0.31 - (index % 2) * 0.06, 0.05]} rotation={[0.08, 0, x * 1.8]}><boxGeometry args={[0.065, 0.42, 0.065]} /><meshStandardMaterial color="#111015" roughness={1} /></mesh>)}
    </group>
  </group>;
}

function SynthPerformance() {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (body.current) { body.current.position.y = Math.sin(clock.elapsedTime * 3.1) * 0.035; body.current.rotation.z = Math.sin(clock.elapsedTime * 2.4) * 0.045; } });
  return <group ref={body} position={[0, 0.1, -0.28]}><mesh position={[-0.22, 0.48, 0]} rotation={[0.1, 0, -0.26]}><capsuleGeometry args={[0.045, 0.38, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh><mesh position={[0.22, 0.48, 0]} rotation={[0.1, 0, 0.26]}><capsuleGeometry args={[0.045, 0.38, 4, 8]} /><meshStandardMaterial color="#12161e" /></mesh><Sparkles count={10} scale={[0.8, 0.5, 0.4]} size={1.1} speed={0.6} color="#d6a447" /></group>;
}

function TunePerformance() {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (body.current) { body.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 5.2)) * 0.08; body.current.rotation.z = Math.sin(clock.elapsedTime * 5.2) * 0.1; } });
  return <group ref={body}><Sparkles count={8} scale={[0.7, 0.8, 0.5]} size={1.2} speed={1.6} color="#e6c34c" /></group>;
}

function Visitor() {
  const active = useGameStore((state) => state.visitorActive);
  const vpos = useGameStore((state) => state.visitorPos);
  const ppos = useGameStore((state) => state.playerPosition);
  const selectObject = useGameStore((state) => state.selectObject);
  const friendActivity = useGameStore((state) => state.friendActivity);
  const friendMenuOpen = useGameStore((state) => state.friendMenuOpen);
  const sipTimer = useRef(3.5);
  const sipProgress = useRef(0);
  const drinkGlass = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!active || friendActivity || friendMenuOpen || !useGameStore.getState().visitorActive) return;
    const timer = window.setInterval(() => playModularPatch(), 5200 + Math.random() * 3600);
    return () => window.clearInterval(timer);
  }, [active, friendActivity, friendMenuOpen]);
  useFrame((_, delta) => {
    if (friendActivity !== 'vodka') { sipProgress.current = 0; sipTimer.current = 3.5 + Math.random() * 4; return; }
    if (sipProgress.current > 0) { sipProgress.current += delta; if (sipProgress.current > 1.7) sipProgress.current = 0; return; }
    sipTimer.current -= delta;
    if (sipTimer.current <= 0) { sipProgress.current = 0.01; sipTimer.current = 4 + Math.random() * 7; }
    if (drinkGlass.current) {
      const sipping = sipProgress.current > 0.05;
      drinkGlass.current.position.y += ((sipping ? 1.28 : 0.92) - drinkGlass.current.position.y) * Math.min(1, delta * 8);
      drinkGlass.current.rotation.x += ((sipping ? -0.5 : 0) - drinkGlass.current.rotation.x) * Math.min(1, delta * 8);
    }
  });
  if (!active) return null;
  const [vx, vz] = toWorld(vpos.x, vpos.y);
  const [px, pz] = toWorld(ppos.x, ppos.y);
  const facing = Math.atan2(-(px - vx), -(pz - vz));
  const [sx, sz] = toWorld(323, 277);
  const synthFacing = Math.atan2(-(sx - vx), -(sz - vz));
  if (friendActivity === 'tune' || friendActivity === 'vodka' || friendActivity === 'video-game') return <group position={[vx, 0, vz]} rotation={[0, 0, 0]} scale={1.35} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}><SittingLegs /><FriendTorso hipY={0.62} groove={friendActivity === 'tune'} />{friendActivity === 'vodka' && <group ref={drinkGlass} position={[-0.22, 0.92, -0.32]}><mesh><cylinderGeometry args={[0.09, 0.1, 0.2, 12]} /><meshStandardMaterial color="#e7e1d5" transparent opacity={0.75} /></mesh></group>}{friendActivity === 'tune' && <Html center position={[0, 2.4, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">MAKING A TUNE</div></Html>}</group>;
  return <group position={[vx, 0, vz]} rotation={[0, friendActivity ? facing : synthFacing, 0]} scale={1.35} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}>
    {/* Tall, slender friend: oversized boots, narrow silhouette, and individual dreadlock strands. */}
    <mesh position={[-0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.72, 4, 8]} /><meshStandardMaterial color="#293026" /></mesh>
    <mesh position={[0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.72, 4, 8]} /><meshStandardMaterial color="#293026" /></mesh>
    <mesh position={[-0.14, 0.07, -0.14]} castShadow><boxGeometry args={[0.25, 0.16, 0.48]} /><meshStandardMaterial color="#17140f" /></mesh>
    <mesh position={[0.14, 0.07, -0.14]} castShadow><boxGeometry args={[0.25, 0.16, 0.48]} /><meshStandardMaterial color="#17140f" /></mesh>
    <FriendTorso hipY={0.82} />
    {!friendActivity && !friendMenuOpen && <SynthPerformance />}
    {!friendActivity && <mesh position={[0, 1.15, 0.18]} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}><boxGeometry args={[0.8, 1.7, 0.18]} /><meshBasicMaterial transparent opacity={0} /></mesh>}
    <Html center position={[0, 2.65, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">{friendActivity ? 'FRIEND · ENTER' : 'FRIEND · PATCHING SYNTH'}</div></Html>
  </group>;
}

const NPC2_COAT = '#75614f';
const NPC2_SKIN = '#f1d7c9';

/** One of NPC 2's legs: hip and knee joints so the shin can trail behind the thigh mid-stride. */
function Npc2Leg({ hipRef, shinRef, x }: { hipRef: RefObject<THREE.Group | null>; shinRef: RefObject<THREE.Group | null>; x: number }) {
  return <group ref={hipRef} position={[x, 0, 0]}>
    <mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.075, 0.2, 4, 8]} /><meshStandardMaterial color="#3d4450" /></mesh>
    <group ref={shinRef} position={[0, -0.3, 0]}>
      <mesh position={[0, -0.13, 0]} castShadow><capsuleGeometry args={[0.065, 0.18, 4, 8]} /><meshStandardMaterial color="#3d4450" /></mesh>
      <mesh position={[0, -0.26, -0.06]} castShadow><boxGeometry args={[0.16, 0.09, 0.28]} /><meshStandardMaterial color="#17140f" /></mesh>
    </group>
  </group>;
}

/**
 * NPC 2 walks the room on foot instead of sliding along a curve. Hips and knees drive a real stride,
 * the arms counter-swing, the body bounces and rolls slightly on each step, the head sways while
 * walking and drifts around the room while idle — and every transition (idle → walking → turning →
 * stopping) eases through the same `gait` weight, so nothing snaps.
 */
function Npc2() {
  const active = useGameStore((state) => state.npc2Active);
  const selectObject = useGameStore((state) => state.selectObject);
  const figure = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const last = useRef({ x: 0, z: 0, ready: false });
  const phase = useRef(0);
  const facing = useRef(0);
  const gait = useRef(0); // 0 = standing, 1 = full stride
  useFrame(({ clock }, dt) => {
    const state = useGameStore.getState();
    if (!state.npc2Active) { last.current.ready = false; return; }
    if (!figure.current) return;
    const [x, z] = toWorld(state.npc2Pos.x, state.npc2Pos.y);
    if (!last.current.ready) last.current = { x, z, ready: true };
    const dx = x - last.current.x;
    const dz = z - last.current.z;
    last.current.x = x; last.current.z = z;
    figure.current.position.set(x, 0, z);
    const dist = Math.hypot(dx, dz);
    const speed = dt > 0 ? dist / dt : 0;
    const moving = dist > 0.0015;
    if (moving) {
      const target = Math.atan2(-dx, -dz); // the model faces -z by default
      const diff = Math.atan2(Math.sin(target - facing.current), Math.cos(target - facing.current));
      facing.current += diff * Math.min(1, dt * 6); // turns through the corner instead of snapping
      phase.current += dt * (5.2 + Math.min(speed, 8) * 0.9);
    }
    gait.current += ((moving ? 1 : 0) - gait.current) * Math.min(1, dt * 5);
    const g = gait.current;
    const t = phase.current;
    const swing = Math.sin(t);
    const idle = 1 - g;
    figure.current.rotation.y = facing.current;
    if (hipL.current) hipL.current.rotation.x = swing * 0.6 * g;
    if (hipR.current) hipR.current.rotation.x = -swing * 0.6 * g;
    // Only the leg swinging through bends at the knee — this is what keeps the walk from looking stiff.
    if (shinL.current) shinL.current.rotation.x = Math.max(0, -swing) * 0.8 * g;
    if (shinR.current) shinR.current.rotation.x = Math.max(0, swing) * 0.8 * g;
    if (armL.current) { armL.current.rotation.x = -swing * 0.5 * g; armL.current.rotation.z = -0.14 - idle * 0.02; }
    if (armR.current) { armR.current.rotation.x = swing * 0.5 * g; armR.current.rotation.z = 0.14 + idle * 0.02; }
    if (body.current) {
      body.current.position.y = 0.58 + Math.abs(swing) * 0.05 * g + idle * Math.sin(clock.elapsedTime * 1.6) * 0.012; // step bounce, then breathing
      body.current.rotation.z = swing * 0.05 * g;
      body.current.rotation.x = -0.12 * g; // leans into the walk
    }
    if (head.current) {
      head.current.rotation.x = -swing * 0.05 * g; // counter-bob keeps the head level
      head.current.rotation.y = Math.sin(t * 0.5) * 0.14 * g + Math.sin(clock.elapsedTime * 0.5) * 0.28 * idle; // glances around while standing
      head.current.rotation.z = Math.sin(t * 0.5) * 0.04 * g;
    }
  });
  if (!active) return null;
  const start = useGameStore.getState().npc2Pos;
  const [ix, iz] = toWorld(start.x, start.y);
  return <group ref={figure} position={[ix, 0, iz]} scale={1.15} onClick={(event) => { event.stopPropagation(); selectObject('npc2'); }}>
    <group position={[0, 0.58, 0]}>
      <Npc2Leg hipRef={hipL} shinRef={shinL} x={-0.11} />
      <Npc2Leg hipRef={hipR} shinRef={shinR} x={0.11} />
    </group>
    <group ref={body} position={[0, 0.58, 0]}>
      <mesh position={[0, 0.31, 0]} castShadow><boxGeometry args={[0.42, 0.62, 0.28]} /><meshStandardMaterial color={NPC2_COAT} /></mesh>
      {[-0.24, -0.12, 0.12, 0.24].map((bx, i) => <mesh key={i} position={[bx, 0.3, -0.15]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#b73545" /></mesh>)}
      <group ref={armL} position={[-0.26, 0.55, 0]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.06, 0.4, 4, 8]} /><meshStandardMaterial color={NPC2_COAT} /></mesh>
        <mesh position={[0, -0.52, -0.02]}><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
      </group>
      <group ref={armR} position={[0.26, 0.55, 0]} rotation={[0, 0, 0.14]}>
        <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.06, 0.4, 4, 8]} /><meshStandardMaterial color={NPC2_COAT} /></mesh>
        <mesh position={[0, -0.52, -0.02]}><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
      </group>
      <group ref={head} position={[0, 0.66, 0]}>
        <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
        <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.27, 0.27, 0.18, 12]} /><meshStandardMaterial color="#111015" /></mesh>
        <mesh position={[-0.12, 0.16, -0.18]}><boxGeometry args={[0.1, 0.045, 0.02]} /><meshStandardMaterial color="#d8e7ed" /></mesh>
        <mesh position={[0.12, 0.16, -0.18]}><boxGeometry args={[0.1, 0.045, 0.02]} /><meshStandardMaterial color="#d8e7ed" /></mesh>
      </group>
    </group>
    <Html center position={[0, 2.05, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">FRIEND 2 · LISTENING</div></Html>
  </group>;
}

function RoomObject({ object }: { object: StudioObject }) {
  const selected = useGameStore((state) => state.selectedObjectId === object.id);
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  const interact = useGameStore((state) => state.interact);
  const [x, z] = toWorld(object.x + object.width / 2, object.y + object.height / 2);
  const label = interactionById[object.id]?.label ?? object.id;
  const guitarNotesMinutes = useGameStore((state) => state.guitarNotesMinutes);
  const baseY = DESKTOP_IDS.has(object.id) ? DESK_Y : TABLE_IDS.has(object.id) ? TABLE2_Y : 0; // gear sits on its table surface
  const ring = Math.max(0.5, Math.max(object.width, object.height) / 150);
  // Point-and-click: first click walks to the object and selects it; clicking the selected object uses it.
  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (isDrag(event.nativeEvent)) return; // a rotate-drag that ended here, not a click
    if (selected) interact(object.id);
    else setMoveTarget({ x: object.x + object.width / 2, y: object.y + object.height / 2, selectId: object.id });
  };
  return <group position={[x, 0, z]} rotation={[0, object.rotationY ?? 0, 0]} onClick={onSelect}>
    <RoomObjectModel object={object} />
    {(object.id === 'acousticGuitar' || object.id === 'electricGuitar') && guitarNotesMinutes > 0 && <group position={[0, 1.4, 0]}><Sparkles count={26} scale={[1.3, 1.7, 1.2]} size={2.5} speed={1.2} color="#ffd25a" /><Html center position={[0.35, 1.15, 0]} distanceFactor={8}><span className="text-2xl text-[#ffd25a] drop-shadow-[0_0_8px_#d6a447]">♪</span></Html></group>}
    {selected && <>
      <mesh position={[0, baseY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[ring * 0.9, ring * 1.15, 40]} /><meshBasicMaterial color="#e6c34c" transparent opacity={0.85} /></mesh>
      <Html center position={[0, baseY + 1.7, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">{label} · CLICK / ENTER</div></Html>
    </>}
  </group>;
}

function Room() {
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  const activeLocationId = useGameStore((state) => state.activeLocationId);
  // Quantised to whole game-minutes: the light still eases smoothly but the room stops re-rendering every frame.
  const minute = useGameStore((state) => Math.floor(state.clock.minuteOfDay));
  const weather = useGameStore((state) => state.weather);
  const activeVideoId = useGameStore((state) => state.activeVideoId);
  const { daylight, golden } = dayCycle(minute);
  const wet = weather === 'rain' || weather === 'hail';
  // Overcast weather pulls the outdoor contribution down without touching the room's own practical lights.
  const outdoor = daylight * (wet ? 0.55 : 1);
  const sky = new THREE.Color('#071024')
    .lerp(new THREE.Color('#8dc7e5'), daylight)
    .lerp(new THREE.Color('#e08f4c'), golden * (0.15 + daylight * 0.45)) // warm, but the sky only floods once the sun is actually up
    .lerp(new THREE.Color(wet ? '#22364a' : weather === 'rainbow' ? '#7799b6' : '#000000'), weather === 'clear' ? 0 : wet ? 0.5 : 0.35)
    .getStyle();
  // Sunrise light arrives warm and turns neutral as the morning fills in.
  const sunColor = new THREE.Color('#9bb9ff').lerp(new THREE.Color('#ffb877'), golden).lerp(new THREE.Color('#fff1d0'), Math.max(0, daylight - golden)).getStyle();
  if (activeLocationId === 'apartment-corridor') return <Corridor sky={sky} />;
  return <>
    <color attach="background" args={[sky]} /><fog attach="fog" args={[sky, 9, 24]} />
    <ambientLight intensity={0.55 + outdoor * 0.7} color={new THREE.Color('#7183ad').lerp(new THREE.Color('#e8a877'), golden).lerp(new THREE.Color('#b8dcf0'), Math.max(0, daylight - golden)).getStyle()} /><directionalLight castShadow position={[3, 8, 4]} intensity={1.5 + outdoor * 2.2} color={sunColor} shadow-mapSize={[1024, 1024]} />
    <pointLight position={[-3, 4.2, -2]} intensity={activeVideoId === 'anime' ? 13 : 9} color={activeVideoId === 'anime' ? '#5e8fe8' : '#b73545'} distance={7} /><pointLight position={[2, 3.5, 1]} intensity={5} color={activeVideoId === 'anime' ? '#d26fa7' : '#d6a447'} distance={5} />
    {/* Soft red-tone wash for a warm nocturnal mood without washing out the blue night. */}
    <hemisphereLight args={['#3a2530', '#0c1018', 0.4]} />
    <pointLight position={[4, 3, 4]} intensity={3.4} color="#c0394a" distance={12} />
    <pointLight position={[-5, 2.4, 3]} intensity={2.6} color="#a8384a" distance={11} />
    <mesh receiveShadow position={[0, -0.08, 0]} onClick={(event) => { event.stopPropagation(); if (isDrag(event.nativeEvent)) return; setMoveTarget(toLogical(event.point.x, event.point.z)); }}><boxGeometry args={[14, 0.16, 10]} /><meshStandardMaterial color="#17263a" roughness={0.84} /></mesh>
    {/* Walls are translucent so they never block the view when the camera orbits (depthWrite off = no occlusion). */}
    <mesh position={[0, 3.1, -5]}><boxGeometry args={[14, 6.2, 0.18]} /><meshStandardMaterial color="#243146" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[-7, 3.1, 0]}><boxGeometry args={[0.18, 6.2, 10]} /><meshStandardMaterial color="#202c42" transparent opacity={0.16} depthWrite={false} /></mesh>
    {/* Right wall the closet is mounted against. */}
    <mesh position={[7, 3.1, 0]}><boxGeometry args={[0.18, 6.2, 10]} /><meshStandardMaterial color="#202c42" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[0, 6.15, 0]}><boxGeometry args={[14, 0.12, 10]} /><meshStandardMaterial color="#33507a" transparent opacity={0.22} depthWrite={false} /></mesh>
    {/* Weather stays outdoors: rain is drawn inside the window unit, never in the room volume. */}
    {STUDIO_OBJECTS.map((object) => <RoomObject key={object.id} object={object} />)}<Player /><Visitor /><Npc2 /><CameraRig />
  </>;
}

/** A compact exterior corridor destination with a working elevator return point. */
function Corridor({ sky }: { sky: string }) {
  const returnToStudio = useGameStore((state) => state.returnToStudio);
  return <>
    <color attach="background" args={['#292018']} /><ambientLight intensity={0.72} color="#d58b52" /><pointLight position={[-1.8, 3.5, 1]} color="#f0a35b" intensity={10} distance={10} /><pointLight position={[2.8, 4.4, -2.5]} color="#ffd08a" intensity={7} distance={8} />
    <mesh receiveShadow position={[0, -0.08, 0]}><boxGeometry args={[9, 0.16, 12]} /><meshStandardMaterial color="#3b4149" roughness={0.82} /></mesh>
    <mesh position={[0, 3, -4.5]}><boxGeometry args={[9, 6, 0.2]} /><meshStandardMaterial color="#50515a" /></mesh>
    <mesh position={[-4.4, 3, 0]}><boxGeometry args={[0.2, 6, 12]} /><meshStandardMaterial color="#484b54" /></mesh>
    <mesh position={[4.4, 3, 0]}><boxGeometry args={[0.2, 6, 12]} /><meshStandardMaterial color="#484b54" /></mesh>
    {/* Studio door on the left: it is distinct from the elevator and always returns to the same room. */}
    <group position={[-2.4, 0, -4.25]}>
      <mesh position={[0, 1.4, 0]} castShadow onClick={(event) => { event.stopPropagation(); returnToStudio(); }}><boxGeometry args={[1.5, 2.8, 0.18]} /><meshStandardMaterial color="#b73545" /></mesh>
      <mesh position={[0.5, 1.32, 0.14]}><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#d6a447" metalness={0.7} /></mesh>
      <Html center position={[0, 3.0, 0]} distanceFactor={9}>
        <button type="button" onClick={returnToStudio} className="pointer-events-auto rounded border border-paper/40 bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap hover:bg-red/50">STUDIO · ENTER</button>
      </Html>
    </group>
    {/* Elevator placed to the corridor's right side. */}
    <group position={[1.45, 0, -4.25]}>
      <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[2.8, 3.2, 0.2]} /><meshStandardMaterial color="#20262f" metalness={0.5} /></mesh>
      <mesh position={[-0.72, 1.55, 0.12]}><boxGeometry args={[1.2, 2.7, 0.04]} /><meshStandardMaterial color="#78818c" metalness={0.75} /></mesh>
      <mesh position={[0.72, 1.55, 0.12]}><boxGeometry args={[1.2, 2.7, 0.04]} /><meshStandardMaterial color="#78818c" metalness={0.75} /></mesh>
      <mesh position={[1.7, 1.2, 0.15]}><boxGeometry args={[0.22, 0.42, 0.08]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={1.2} /></mesh>
      <Html center position={[0, 3.55, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">ELEVATOR</div></Html>
    </group>
    <Player /><CameraRig />
  </>;
}

export function ThreeStudio() {
  return <div className="absolute inset-0"><Canvas shadows camera={{ position: [7.8, 8.6, 9.5], fov: 48 }} style={{ width: '100%', height: '100%' }} onPointerDown={(event) => { pointerDownAt = { x: event.clientX, y: event.clientY }; }}>
    <Room />
    {/* Bloom only catches bright emissives — screens, LEDs, the crystal — per the Art Bible's "only emissives bloom" rule. */}
    <EffectComposer>
      <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.85} intensity={0.7} mipmapBlur />
    </EffectComposer>
  </Canvas></div>;
}
