'use client';

import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Sparkles, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useRef, type ComponentRef, type RefObject } from 'react';
import { STUDIO_OBJECTS, type StudioObject } from '@/data/studio-layout';
import { interactionById } from '@/data/interactions';
import { useGameStore } from '@/store/game-store';
import { RoomObjectModel, DESK_Y, DESKTOP_IDS, TABLE2_Y, TABLE_IDS } from './RoomObjectModel';

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

/** Everything from the hips up, shared by the standing and seated poses (offsets are relative to hip height). */
function UpperBody({ hipY, cloth = CLOTH }: { hipY: number; cloth?: string }) {
  return <group position={[0, hipY, 0]}>
    <mesh castShadow><boxGeometry args={[0.48, 0.3, 0.3]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
    <mesh position={[0, 0.42, 0]} castShadow><capsuleGeometry args={[0.29, 0.42, 6, 12]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
    <mesh position={[0, 0.68, 0]} scale={[1, 0.62, 0.9]} castShadow><sphereGeometry args={[0.36, 18, 14]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
    <mesh position={[-0.36, 0.36, 0.02]} rotation={[0.1, 0, 0.16]} castShadow><capsuleGeometry args={[0.1, 0.5, 4, 8]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
    <mesh position={[0.36, 0.36, 0.02]} rotation={[0.1, 0, -0.16]} castShadow><capsuleGeometry args={[0.1, 0.5, 4, 8]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
    {/* jacket: zip up the front + a raised collar */}
    <mesh position={[0, 0.42, -0.28]}><boxGeometry args={[0.045, 0.52, 0.03]} /><meshStandardMaterial color="#05070c" metalness={0.4} roughness={0.5} /></mesh>
    <mesh position={[0, 0.66, -0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.19, 0.06, 8, 16]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[0, 0.82, -0.03]}><cylinderGeometry args={[0.09, 0.11, 0.12, 10]} /><meshStandardMaterial color="#20242f" /></mesh>
    {/* head/face — sits at the FRONT (−z, toward the desk); lighter so the face reads clearly */}
    <mesh position={[0, 1.0, -0.05]} castShadow><sphereGeometry args={[0.2, 20, 16]} /><meshStandardMaterial color="#37303a" roughness={0.9} /></mesh>
    {/* hood worn UP over the head — a cloth shell pushed back so the face shows through the opening at the front */}
    <mesh position={[0, 1.07, 0.09]} scale={[1.34, 1.4, 1.32]} castShadow><sphereGeometry args={[0.2, 20, 16]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh>
    <mesh position={[0, 1.02, -0.16]} rotation={[Math.PI / 2 - 0.3, 0, 0]}><torusGeometry args={[0.185, 0.05, 8, 20]} /><meshStandardMaterial color={cloth} roughness={0.95} /></mesh>
    {/* headphones worn OVER the hood: band + ear cups at a radius larger than the hood */}
    <mesh position={[0, 1.14, 0.03]} rotation={[0.08, 0, 0]}><torusGeometry args={[0.32, 0.05, 8, 24, Math.PI]} /><meshStandardMaterial color="#0a0c12" roughness={0.6} /></mesh>
    <mesh position={[-0.32, 1.0, 0.03]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.09, 16]} /><meshStandardMaterial color="#0a0c12" /></mesh>
    <mesh position={[0.32, 1.0, 0.03]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.09, 16]} /><meshStandardMaterial color="#0a0c12" /></mesh>
    <mesh position={[-0.375, 1.0, 0.03]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.02, 14]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.4} /></mesh>
    <mesh position={[0.375, 1.0, 0.03]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.02, 14]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.4} /></mesh>
  </group>;
}

function StandingLegs() {
  return <>
    <mesh position={[-0.15, 0.42, 0]} castShadow><capsuleGeometry args={[0.13, 0.5, 4, 8]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
    <mesh position={[0.15, 0.42, 0]} castShadow><capsuleGeometry args={[0.13, 0.5, 4, 8]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
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
    <mesh position={[0, -0.43, 0]} castShadow><capsuleGeometry args={[0.13, 0.5, 4, 8]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.9} /></mesh>
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

/** A stylised human silhouette. Swaps between standing/walking, seated and lying poses. */
function Player() {
  const position = useGameStore((state) => state.playerPosition);
  const seated = useGameStore((state) => state.seated);
  const lyingDown = useGameStore((state) => state.lyingDown);
  const scrolling = useGameStore((state) => state.scrolling);
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
      <UpperBody hipY={0.62} />
      <EmotionalCrystal y={2.22} />
    </group>;
  }
  return <group position={[x, 0, z]}>
    <WalkingFigure />
    <EmotionalCrystal y={2.72} />
  </group>;
}

/** The called-over friend: a taller figure in a different coat who walks in and faces the producer. */
function Visitor() {
  const active = useGameStore((state) => state.visitorActive);
  const vpos = useGameStore((state) => state.visitorPos);
  const ppos = useGameStore((state) => state.playerPosition);
  if (!active) return null;
  const [vx, vz] = toWorld(vpos.x, vpos.y);
  const [px, pz] = toWorld(ppos.x, ppos.y);
  const facing = Math.atan2(-(px - vx), -(pz - vz));
  return <group position={[vx, 0, vz]} rotation={[0, facing, 0]} scale={1.28}>
    <StandingLegs />
    <UpperBody hipY={0.82} cloth="#3f5a4c" />
  </group>;
}

function RoomObject({ object }: { object: StudioObject }) {
  const selected = useGameStore((state) => state.selectedObjectId === object.id);
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  const interact = useGameStore((state) => state.interact);
  const [x, z] = toWorld(object.x + object.width / 2, object.y + object.height / 2);
  const label = interactionById[object.id]?.label ?? object.id;
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
    {selected && <>
      <mesh position={[0, baseY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[ring * 0.9, ring * 1.15, 40]} /><meshBasicMaterial color="#e6c34c" transparent opacity={0.85} /></mesh>
      <Html center position={[0, baseY + 1.7, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">{label} · CLICK / ENTER</div></Html>
    </>}
  </group>;
}

function Room() {
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  return <>
    <color attach="background" args={['#080d18']} /><fog attach="fog" args={['#080d18', 9, 24]} />
    <ambientLight intensity={0.9} color="#7183ad" /><directionalLight castShadow position={[3, 8, 4]} intensity={2.0} color="#9bb9ff" shadow-mapSize={[1024, 1024]} />
    <pointLight position={[-3, 4.2, -2]} intensity={9} color="#b73545" distance={7} /><pointLight position={[2, 3.5, 1]} intensity={5} color="#d6a447" distance={5} />
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
    {STUDIO_OBJECTS.map((object) => <RoomObject key={object.id} object={object} />)}<Player /><Visitor /><CameraRig />
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
