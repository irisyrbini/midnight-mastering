'use client';

import { Canvas, useFrame, useThree, useLoader, type ThreeEvent } from '@react-three/fiber';
import { Html, Sparkles, OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { STUDIO_OBJECTS, SYNTH_CENTER, type StudioObject } from '@/data/studio-layout';
import { interactionById } from '@/data/interactions';
import { ELEVATOR_DING_MS, ELEVATOR_DOOR_MS, ELEVATOR_RIDE_MS, useGameStore } from '@/store/game-store';
import { RoomObjectModel, DESK_Y, DESK_Z_OFFSET, DESKTOP_IDS, TABLE2_Y, TABLE_IDS } from './RoomObjectModel';
import { playElevatorDing, playModularPatch } from '@/game/audio/sfx';
import { dayCycle } from '@/game/simulation/day-cycle';

/**
 * Logical layout units per world unit. Lowering this spreads the same layout across more floor, which
 * is how the studio was enlarged: furniture keeps its modelled size while the gaps between pieces (and
 * the walls, floor and ceiling below, which all scale by ROOM_SCALE) grow around it.
 */
const UNITS_PER_WORLD = 72;
// Room shell size. Kept SEPARATE from UNITS_PER_WORLD on purpose: lowering UNITS_PER_WORLD would spread
// every prop apart (scattering the desktop off the desk), whereas raising this only pushes the walls /
// floor / ceiling outward around the same furniture cluster — a bigger room without disturbing layout.
const ROOM_SCALE = 104 / UNITS_PER_WORLD;

// Wall planes, derived from the same ROOM_SCALE the wall meshes below use, so anything anchored to a
// wall moves with it if the room is resized. The 0.09 is half the 0.18 wall thickness — its inner
// (room-facing) face.
const WALL_BACK_INNER_Z = -5 * ROOM_SCALE + 0.09;
const WALL_FRONT_INNER_Z = 5 * ROOM_SCALE - 0.09;
const WALL_RIGHT_INNER_X = 7 * ROOM_SCALE - 0.09;
const WALL_LEFT_INNER_X = -7.5 * ROOM_SCALE + 0.17;
const WALL_GAP = 0.01; // hair of clearance so a mounted object never z-fights the wall
/** Each wall-mounted model's distance from its own origin to its wall-facing back face. */
const WALL_MOUNT_DEPTH: Record<string, number> = {
  window: 0.06, window2: 0.06, // frame is 0.12 deep
  posters: 0.025, posters2: 0.025, posters3: 0.025, posters4: 0.025, // thin backing board
  shelves: 0.25, // deep shelf box
  miniFridge: 0.4,
  sofa: 0.66,
  ledLights: 0.05,
  closet: 0.39, // sliding wardrobe body sits back from its origin
  bathroom: 0.07, // door frame
};
/** Tabletop half-thickness: the desk mesh is 0.14 tall anchored at its centre DESK_Y, so its surface
 *  sits this far above DESK_Y. Desk props are modelled from DESK_Y and lifted by this to rest on top. */
const DESKTOP_LIFT = 0.07;
const toWorld = (x: number, y: number): [number, number] => [(x - 640) / UNITS_PER_WORLD, (y - 510) / UNITS_PER_WORLD];
/** Inverse of toWorld: a floor click's world point back to the logical room coordinate the sim uses. */
const toLogical = (worldX: number, worldZ: number) => ({ x: worldX * UNITS_PER_WORLD + 640, y: worldZ * UNITS_PER_WORLD + 510 });
const crystalColor = { red: '#d84f59', yellow: '#e6c34c', green: '#62cf86' } as const;

/** Distinguish a click from an orbit-drag so releasing a rotation over an object doesn't select or use it. */
let pointerDownAt: { x: number; y: number } | null = null;
const isDrag = (event: MouseEvent) => (pointerDownAt ? Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y) > 6 : false);

/** Mouse-drag orbits the view around a fixed room-centre axis, so WASD/click movement visibly walks the producer across the room. */
function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const setCameraYaw = useGameStore((state) => state.setCameraYaw);
  useFrame(() => {
    controls.current?.update();
    const target = controls.current?.target;
    if (target) setCameraYaw(Math.atan2(camera.position.x - target.x, camera.position.z - target.z));
  });
  return <OrbitControls ref={controls} makeDefault target={[0, 1.2, -1]} enablePan={false} enableZoom minDistance={7 * ROOM_SCALE} maxDistance={24 * ROOM_SCALE} minPolarAngle={Math.PI * 0.16} maxPolarAngle={Math.PI * 0.46} enableDamping dampingFactor={0.12} />;
}

/**
 * The emotional crystal that floats over the producer's head: the original 6-point asterisk (three
 * crossed bars), recoloured with the crystal state (red → yellow → green) and glowing so it blooms.
 * Gentle in-plane twinkle + hover; sized to sit above the head.
 */
function EmotionalCrystal({ y }: { y: number }) {
  const state = useGameStore((store) => store.crystal);
  const color = crystalColor[state];
  const spin = useRef<THREE.Group>(null);
  const float = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (spin.current) spin.current.rotation.z = t * 0.5; // slow in-plane twinkle
    if (float.current) float.current.position.y = y + Math.sin(t * 1.5) * 0.06; // gentle hover
  });
  return <group ref={float} position={[0, y, 0]}>
    <group ref={spin}>
      {[0, Math.PI / 3, -Math.PI / 3].map((r) => <mesh key={r} rotation={[0, 0, r]} castShadow>
        <boxGeometry args={[0.05, 0.32, 0.05]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>)}
    </group>
    <pointLight color={color} intensity={2.2} distance={3} /><Sparkles count={8} scale={0.5} size={1.1} color={color} />
  </group>;
}

const HALLWAY_CAM: [number, number, number] = [0, 6.4, 6.2];
const HALLWAY_TARGET: [number, number, number] = [0, 1.4, -2.4];
const LOBBY_CAM: [number, number, number] = [0, 8.0, 8.6];
const LOBBY_TARGET: [number, number, number] = [0, 1.5, -0.8];
const ROOFTOP_CAM: [number, number, number] = [0, 8.2, 10.5];
const ROOFTOP_TARGET: [number, number, number] = [0, 1.0, -1.5];

// Player palette — value-blocked so the layered graphic silhouette reads: each major region sits at a
// distinct dark value rather than one flat black. Lifted off pure black so the producer never merges
// into the night room. Ordered darkest → lightest: hair, shoes, then the two garment families (a
// blue-charcoal hoodie and a violet-gray trouser), each with a one-step-down "shadow plane" value for
// the under-masses, then the muted warm skin and the near-black headphones with a warm accent.
const CLOTH = '#2b3350'; // oversized hoodie / outerwear — dark blue-charcoal, the lightest garment value
const CLOTH_DARK = '#241f33'; // trousers — muted dark violet-gray, clearly separated from the hoodie
const OUTER_DK = '#1c2338'; // hoodie shadow planes (yoke ends, hem, cuffs, back drape)
const PANTS_DK = '#181327'; // trouser shadow planes (the slim leg under the shell)
const HAIR = '#16131b'; // darkest — hair chunks
const SHOE = '#0a0b10'; // near-black shoes
const HP_DARK = '#0b0d13'; // headphones body (dark, with a warm amber accent)
const SKIN = '#bd9c80'; // hands / face plane — restrained muted warmth, low-poly to match NPC2

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
 * forward and back on the beat, the arms swing side to side, the shoulders lift alternately and the
 * head nods. Every few bars the groove escalates into a **hype burst** — both hands punch up above
 * shoulder height as if celebrating the drop — then settles back into the low swing, so the loop
 * alternates between low and high arm work instead of repeating one motion.
 * `grooveOffset` keeps the two figures off each other's phase so they read as two people.
 */
function useGroove(active: boolean, refs: GrooveRefs, pose: GroovePose, grooveOffset: number) {
  const amount = useRef(0);
  useFrame(({ clock }, delta) => {
    amount.current += ((active ? 1 : 0) - amount.current) * Math.min(1, delta * 3); // eases in and out, never snaps
    const k = amount.current;
    if (k < 0.002) return;
    const t = clock.elapsedTime + grooveOffset;
    const beat = t * 5.6;
    const nodBurst = Math.pow(Math.max(0, Math.sin(t * 0.4)), 8); // an emphatic nod every few bars
    // 0 → low swing, 1 → both hands up. Rides a slow wave so the hype arrives and leaves smoothly.
    const hype = Math.pow(Math.max(0, Math.sin(t * 0.28)), 6);
    if (refs.torso.current) {
      // Rocks harder in the low groove; straightens up and lifts as the hands go over the shoulders.
      refs.torso.current.rotation.x = Math.sin(beat) * (0.22 - hype * 0.14) * k;
      refs.torso.current.rotation.z = Math.sin(beat * 0.5) * 0.08 * k;
      refs.torso.current.position.y = pose.hipY + (Math.abs(Math.sin(beat)) * 0.06 + hype * 0.05) * k;
    }
    if (refs.head.current) {
      refs.head.current.rotation.x = (Math.sin(beat) * 0.1 + nodBurst * Math.sin(beat * 2) * 0.3 - hype * 0.22) * k; // chin lifts on the hype
      refs.head.current.rotation.y = Math.sin(beat * 0.33) * 0.18 * k;
    }
    const swingArm = (upper: THREE.Group | null, fore: THREE.Group | null, side: number) => {
      if (upper) {
        // Low groove swings the arm forward/back; the hype rotates it up and out past the shoulder.
        const low = -0.6 + Math.sin(beat) * 0.5 * side;
        const high = -2.5 + Math.sin(beat * 2) * 0.35; // negative X = raised in front of / above the head
        upper.rotation.x = pose.armX + (low * (1 - hype) + high * hype) * k;
        upper.rotation.z = pose.armZ * side + ((0.34 + Math.sin(beat * 0.5) * 0.22) * (1 - hype) + (0.75 + Math.sin(beat * 2) * 0.16) * hype) * k * side;
        upper.position.y = pose.shoulderY + (Math.sin(beat + (side > 0 ? Math.PI : 0)) * 0.03 + hype * 0.04) * k;
      }
      if (fore) {
        // Forearms sweep left/right on the beat, and straighten out overhead during the hype.
        fore.rotation.x = -(0.62 + Math.sin(beat) * 0.32) * (1 - hype) * k;
        fore.rotation.z = (Math.sin(beat + side * 0.6) * 0.6 * (1 - hype) + Math.sin(beat * 2) * 0.24 * hype) * k * side;
      }
    };
    swingArm(refs.armL.current, refs.foreL.current, -1);
    swingArm(refs.armR.current, refs.foreR.current, 1);
  });
}

/**
 * Emotional body language (Patch 0.2: the body carries the feeling). Reads the live `stress`, `energy`
 * and `crystal` from the store and eases the upper body into a posture — no faces needed:
 *   high stress  → slouch/curl in, head lower, shoulders up a touch, arms tucked
 *   low energy   → deeper slump, head heavier
 *   green crystal → opens up, head lifts, a slow easy glance around
 * Everything is additive over the base pose and blends through the `amount` weight, so it never snaps.
 * Applied to the standing and seated bodies (not while grooving to a tune — that loop owns the arms).
 */
function useEmotionalPosture(active: boolean, refs: GrooveRefs) {
  const amount = useRef(0);
  useFrame(({ clock }, delta) => {
    amount.current += ((active ? 1 : 0) - amount.current) * Math.min(1, delta * 2.5);
    const k = amount.current;
    if (k < 0.002) return; // inactive: leave the base pose untouched
    const s = useGameStore.getState();
    const stress = Math.min(1, Math.max(0, s.stress / 100));
    const tired = 1 - Math.min(1, Math.max(0, s.needs.energy / 100));
    const green = s.crystal === 'green' ? 1 : 0;
    const et = clock.elapsedTime;
    const ease = Math.min(1, delta * 2.5);
    const slouch = 0.05 + stress * 0.14 + tired * 0.12 - green * 0.1;
    const headDown = stress * 0.2 + tired * 0.12 - green * 0.08;
    const shoulderRaise = stress * 0.045;
    const armTuck = stress * 0.1;
    if (refs.torso.current) refs.torso.current.rotation.x += (slouch * k - refs.torso.current.rotation.x) * ease;
    if (refs.head.current) {
      refs.head.current.rotation.x += (headDown * k - refs.head.current.rotation.x) * ease;
      refs.head.current.rotation.y += (Math.sin(et * 0.13) * 0.1 * green * k - refs.head.current.rotation.y) * Math.min(1, delta * 1.5);
    }
    if (refs.armL.current) { refs.armL.current.position.y += ((0.66 + shoulderRaise * k) - refs.armL.current.position.y) * ease; refs.armL.current.rotation.z += ((0.12 + armTuck * k) - refs.armL.current.rotation.z) * ease; }
    if (refs.armR.current) { refs.armR.current.position.y += ((0.66 + shoulderRaise * k) - refs.armR.current.position.y) * ease; refs.armR.current.rotation.z += ((-0.12 - armTuck * k) - refs.armR.current.rotation.z) * ease; }
  });
}

/** Everything from the hips up, shared by the standing and seated poses (offsets are relative to hip height). */
function UpperBody({ hipY, cloth = CLOTH, groove = false, grooveOffset = 0, posture = false }: { hipY: number; cloth?: string; groove?: boolean; grooveOffset?: number; posture?: boolean }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const refs = { torso, head, armL, armR, foreL, foreR };
  useGroove(groove, refs, { hipY, shoulderY: 0.66, armX: 0.05, armZ: -0.12 }, grooveOffset);
  // Emotional posture runs when NOT grooving (the tune loop owns the arms/torso while it's active).
  useEmotionalPosture(posture && !groove, refs);
  // ── Layered graphic silhouette. The animation SKELETON is the six ref'd groups (torso/head/armL/armR/
  //    foreL/foreR) at their fixed pivots — the clothing masses below just hang off those bones, so pose
  //    and posture keep working. Front faces −z (toward the face/shoes). ──
  return <group ref={torso} position={[0, hipY, 0]}>
    {/* ===== TORSO: a draped oversized cowl-cloak (matching the reference turnaround) — a raised collar,
         steeply sloped shoulders, a wide bell that hangs long, and an asymmetric hip sash. ===== */}
    {/* Raised cowl collar pooling around the neck and rising at the back — the garment's signature. */}
    <mesh position={[0, 0.74, 0.03]} rotation={[0.18, 0, 0]} castShadow><cylinderGeometry args={[0.3, 0.44, 0.36, 7, 1, true]} /><meshStandardMaterial color={cloth} roughness={1} side={THREE.DoubleSide} flatShading /></mesh>
    <mesh position={[0, 0.82, 0.17]} rotation={[0.5, 0, 0]} castShadow><boxGeometry args={[0.44, 0.3, 0.18]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
    {/* Steeply sloped shoulders — no squared yoke; the cloak falls from here. */}
    <mesh position={[-0.4, 0.66, 0]} rotation={[0, 0, 0.6]} castShadow><boxGeometry args={[0.34, 0.24, 0.44]} /><meshStandardMaterial color={cloth} roughness={0.98} flatShading /></mesh>
    <mesh position={[0.4, 0.66, 0]} rotation={[0, 0, -0.6]} castShadow><boxGeometry args={[0.34, 0.24, 0.44]} /><meshStandardMaterial color={cloth} roughness={0.98} flatShading /></mesh>
    {/* Wide draped chest / upper cloak. */}
    <mesh position={[0, 0.46, -0.02]} rotation={[0.05, 0, 0]} castShadow><boxGeometry args={[0.86, 0.52, 0.44]} /><meshStandardMaterial color={cloth} roughness={0.97} flatShading /></mesh>
    {/* Angled side folds flare the bell out from the body (the cloak hangs over the arms). */}
    <mesh position={[-0.44, 0.26, 0.02]} rotation={[0, 0, 0.4]} castShadow><boxGeometry args={[0.26, 0.58, 0.4]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
    <mesh position={[0.44, 0.26, 0.02]} rotation={[0, 0, -0.4]} castShadow><boxGeometry args={[0.26, 0.58, 0.4]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
    {/* Mid drape stays wide (not tapered) — the cloak hangs long toward the thighs. */}
    <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[0.66, 0.5, 0.38]} /><meshStandardMaterial color={cloth} roughness={0.97} flatShading /></mesh>
    {/* Asymmetric wrapped sash across the hips — the reference's diagonal fabric band + a knotted fold. */}
    <mesh position={[0.02, -0.08, -0.02]} rotation={[0, 0, -0.3]} castShadow><boxGeometry args={[0.8, 0.2, 0.42]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
    <mesh position={[-0.18, -0.18, -0.19]} rotation={[0, 0, -0.3]} castShadow><boxGeometry args={[0.3, 0.18, 0.08]} /><meshStandardMaterial color={cloth} roughness={1} flatShading /></mesh>
    {/* Long hem drop, one value darker. */}
    <mesh position={[0, -0.32, 0.02]} castShadow><boxGeometry args={[0.6, 0.22, 0.38]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
    {/* Back drape (+z) so the cowl silhouette reads from behind. */}
    <mesh position={[0, 0.3, 0.22]} rotation={[Math.PI, 0, 0]} castShadow><coneGeometry args={[0.42, 0.9, 6, 1, true]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading side={THREE.DoubleSide} /></mesh>
    {/* ===== ARMS: oversized sleeve shell over an articulated arm. Shoulder pivot stays at y=0.66 (the
         posture/groove hooks drive these bones), so only the geometry is oversized. ===== */}
    <group ref={armL} position={[-0.44, 0.66, 0.01]} rotation={[0.05, 0, 0.12]}>
      {/* Upper sleeve — a faceted frustum, wide at the shoulder, tapering to the elbow, hung slightly out. */}
      <mesh position={[0.02, -0.18, 0.01]} rotation={[0, 0, -0.12]} castShadow><cylinderGeometry args={[0.2, 0.14, 0.46, 5]} /><meshStandardMaterial color={cloth} roughness={0.98} flatShading /></mesh>
      <group ref={foreL} position={[0, -0.32, 0]} rotation={[-0.18, 0, 0]}>
        {/* Forearm cuff (narrower, darker) + a small sphere hand that stays visible while playing/holding. */}
        <mesh position={[0, -0.14, 0]} castShadow><cylinderGeometry args={[0.13, 0.1, 0.32, 5]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
        <mesh position={[0, -0.31, 0]} castShadow><sphereGeometry args={[0.075, 8, 6]} /><meshStandardMaterial color={SKIN} roughness={0.85} flatShading /></mesh>
      </group>
    </group>
    <group ref={armR} position={[0.44, 0.66, 0.01]} rotation={[0.05, 0, -0.12]}>
      <mesh position={[-0.02, -0.18, 0.01]} rotation={[0, 0, 0.12]} castShadow><cylinderGeometry args={[0.2, 0.14, 0.46, 5]} /><meshStandardMaterial color={cloth} roughness={0.98} flatShading /></mesh>
      <group ref={foreR} position={[0, -0.32, 0]} rotation={[-0.18, 0, 0]}>
        <mesh position={[0, -0.14, 0]} castShadow><cylinderGeometry args={[0.13, 0.1, 0.32, 5]} /><meshStandardMaterial color={OUTER_DK} roughness={1} flatShading /></mesh>
        <mesh position={[0, -0.31, 0]} castShadow><sphereGeometry args={[0.075, 8, 6]} /><meshStandardMaterial color={SKIN} roughness={0.85} flatShading /></mesh>
      </group>
    </group>
    {/* ===== HEAD: small faceted skull + jaw wedge + face plane + hair chunks + hood + headphones. The
         group pivots at the neck and leans a touch forward (−z) for a relaxed posture; only its ROTATION
         is animated, so its position carries the lean. ===== */}
    <group ref={head} position={[0, 0.8, -0.06]}>
      {/* Small faceted skull + a jaw wedge narrowing to the chin (bare head — the cowl is at the neck). */}
      <mesh position={[0, 0.3, 0]} castShadow><icosahedronGeometry args={[0.155, 0]} /><meshStandardMaterial color="#3f3437" roughness={0.95} flatShading /></mesh>
      <mesh position={[0, 0.19, -0.05]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[0.19, 0.16, 0.2]} /><meshStandardMaterial color="#3f3437" roughness={0.95} flatShading /></mesh>
      {/* Minimal inset face plane, a restrained step lighter. */}
      <mesh position={[0, 0.28, -0.12]}><boxGeometry args={[0.2, 0.2, 0.04]} /><meshStandardMaterial color={SKIN} roughness={0.9} flatShading /></mesh>
      {/* Short twisted locs: a close dark cap over the crown, then a scatter of stubby twists pointing
          up-and-back — irregular, not anime spikes (reference hair). */}
      <mesh position={[0, 0.36, 0.04]} castShadow><icosahedronGeometry args={[0.17, 0]} /><meshStandardMaterial color={HAIR} roughness={1} flatShading /></mesh>
      {([[-0.1, 0.52, 0.02, 0.15, 0.2], [0.03, 0.55, 0.03, 0.1, -0.05], [0.13, 0.5, 0, 0.15, -0.28], [-0.14, 0.48, 0.05, 0.2, 0.4], [0.14, 0.47, 0.05, 0.2, -0.4], [-0.03, 0.53, 0.12, 0.45, 0.05], [0.08, 0.5, 0.12, 0.4, -0.15], [-0.15, 0.4, -0.04, 0, 0.5], [0.16, 0.39, -0.03, 0, -0.5], [0, 0.44, -0.12, -0.4, 0]] as const).map(([hx, hy, hz, rx, rz], i) =>
        <mesh key={i} position={[hx, hy, hz]} rotation={[rx, 0, rz]} castShadow><boxGeometry args={[0.052, 0.17, 0.052]} /><meshStandardMaterial color={HAIR} roughness={1} flatShading /></mesh>)}
      {/* Squared headphones — band + chunky ear cups + warm amber accent, sized to the smaller skull. */}
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.44, 0.1, 0.16]} /><meshStandardMaterial color={HP_DARK} /></mesh>
      <mesh position={[-0.25, 0.28, 0]}><boxGeometry args={[0.12, 0.22, 0.17]} /><meshStandardMaterial color={HP_DARK} /></mesh>
      <mesh position={[0.25, 0.28, 0]}><boxGeometry args={[0.12, 0.22, 0.17]} /><meshStandardMaterial color={HP_DARK} /></mesh>
      <mesh position={[-0.31, 0.28, 0]}><boxGeometry args={[0.04, 0.11, 0.13]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.31, 0.28, 0]}><boxGeometry args={[0.04, 0.11, 0.13]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.5} /></mesh>
    </group>
  </group>;
}

/** A shoe as three primitive masses — heel, main body, long low toe wedge — toe pointing −z (forward).
 *  `y` is the ankle height the shoe hangs from so the standing/seated/walking legs can share one build. */
function Shoe({ y }: { y: number }) {
  return <group position={[0, y, 0]}>
    {/* chunky sneaker: ankle + main body + toe wedge riding on a wide low sole slab (toe −z) */}
    <mesh position={[0, 0.04, 0.09]} castShadow><boxGeometry args={[0.26, 0.17, 0.16]} /><meshStandardMaterial color={SHOE} roughness={0.8} flatShading /></mesh>
    <mesh position={[0, 0.02, -0.08]} castShadow><boxGeometry args={[0.28, 0.16, 0.34]} /><meshStandardMaterial color={SHOE} roughness={0.8} flatShading /></mesh>
    <mesh position={[0, -0.02, -0.28]} rotation={[0.12, 0, 0]} castShadow><boxGeometry args={[0.25, 0.11, 0.2]} /><meshStandardMaterial color={SHOE} roughness={0.8} flatShading /></mesh>
    <mesh position={[0, -0.06, -0.06]} castShadow><boxGeometry args={[0.29, 0.07, 0.52]} /><meshStandardMaterial color="#141620" roughness={0.7} flatShading /></mesh>
  </group>;
}

/** Standing legs (used lying down): a wider trouser shell over a slim leg, tapering to the ankle + shoe. */
function StandingLegs() {
  return <>{[-0.15, 0.15].map((lx) => <group key={lx} position={[lx, 0, 0]}>
    <mesh position={[0, 0.6, 0.01]} castShadow><boxGeometry args={[0.3, 0.5, 0.3]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.97} flatShading /></mesh>
    <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[0.24, 0.44, 0.24]} /><meshStandardMaterial color={PANTS_DK} roughness={1} flatShading /></mesh>
    <Shoe y={0.06} />
  </group>)}</>;
}

/** Seated facing the desk (−z): thighs run forward under the desk, shins drop to the floor. Skeleton
 *  positions (thigh z −0.28, shin z −0.52, shoe z −0.6) are preserved so chair/desk alignment is unchanged. */
function SittingLegs() {
  return <>{[-0.15, 0.15].map((lx) => <group key={lx} position={[lx, 0, 0]}>
    <mesh position={[0, 0.6, -0.28]} castShadow><boxGeometry args={[0.24, 0.2, 0.58]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.97} flatShading /></mesh>
    <mesh position={[0, 0.32, -0.52]} castShadow><boxGeometry args={[0.22, 0.6, 0.22]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.97} flatShading /></mesh>
    <mesh position={[0, 0.3, -0.52]} castShadow><boxGeometry args={[0.17, 0.52, 0.17]} /><meshStandardMaterial color={PANTS_DK} roughness={1} flatShading /></mesh>
    <group position={[0, 0, -0.6]}><Shoe y={0.06} /></group>
  </group>)}</>;
}

/** One leg with a hip and a knee, so the shin can trail/fold during the walk cycle instead of swinging
 *  rigid. Bone pivots (hip @0.93, shin @−0.48) are unchanged; the trouser shell hangs off them. */
function WalkLeg({ hipRef, shinRef, x }: { hipRef: RefObject<THREE.Group | null>; shinRef: RefObject<THREE.Group | null>; x: number }) {
  return <group ref={hipRef} position={[x, 0.93, 0]}>
    {/* thigh: baggy angular trouser shell over a slim thigh */}
    <mesh position={[0, -0.24, 0.02]} rotation={[0, 0, x < 0 ? -0.05 : 0.05]} castShadow><boxGeometry args={[0.34, 0.54, 0.34]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.97} flatShading /></mesh>
    <mesh position={[0, -0.24, 0]} castShadow><boxGeometry args={[0.2, 0.48, 0.2]} /><meshStandardMaterial color={PANTS_DK} roughness={1} flatShading /></mesh>
    <group ref={shinRef} position={[0, -0.48, 0]}>
      {/* calf: baggy trouser shell that gathers into a cuff at the ankle */}
      <mesh position={[0, -0.2, 0.01]} rotation={[0, 0, x < 0 ? 0.03 : -0.03]} castShadow><boxGeometry args={[0.3, 0.44, 0.31]} /><meshStandardMaterial color={CLOTH_DARK} roughness={0.97} flatShading /></mesh>
      <mesh position={[0, -0.42, 0.01]} castShadow><boxGeometry args={[0.24, 0.16, 0.26]} /><meshStandardMaterial color={CLOTH_DARK} roughness={1} flatShading /></mesh>
      <mesh position={[0, -0.24, 0]} castShadow><boxGeometry args={[0.18, 0.46, 0.18]} /><meshStandardMaterial color={PANTS_DK} roughness={1} flatShading /></mesh>
      <Shoe y={-0.48} />
    </group>
  </group>;
}

/** Standing/walking figure: turns to face the direction of travel and plays a bob + leg-swing cycle scaled by speed. */
function WalkingFigure() {
  const figure = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const last = useRef({ x: 0, z: 0, ready: false });
  const phase = useRef(0);
  const facing = useRef(0);
  const swing = useRef(0);
  const gait = useRef(0);
  useFrame(({ clock }, dt) => {
    const s = useGameStore.getState();
    const [x, z] = toWorld(s.playerPosition.x, s.playerPosition.y);
    if (!last.current.ready) last.current = { x, z, ready: true };
    const dx = x - last.current.x;
    const dz = z - last.current.z;
    last.current.x = x; last.current.z = z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.0015;
    // Stride is DISTANCE-locked, not time-locked, so the feet plant instead of sliding: a step's worth of
    // travel is a step's worth of phase, at any speed.
    if (moving) {
      const target = Math.atan2(-dx, -dz); // model faces -z by default; turn toward travel
      const diff = Math.atan2(Math.sin(target - facing.current), Math.cos(target - facing.current));
      facing.current += diff * Math.min(1, dt * 14);
      phase.current += dist * 9.0;
    }
    gait.current += ((moving ? 1 : 0) - gait.current) * Math.min(1, dt * 8);
    const g = gait.current;
    // Low energy shortens the stride and softens the bob (heavier steps); a bit of stress tightens it too.
    const energy = Math.min(1, Math.max(0, s.needs.energy / 100));
    const stress = Math.min(1, Math.max(0, s.stress / 100));
    const amp = (0.42 + energy * 0.24 - stress * 0.06) * g;
    const targetSwing = Math.sin(phase.current) * amp;
    swing.current += (targetSwing - swing.current) * Math.min(1, dt * 12);
    if (figure.current) figure.current.rotation.y = facing.current;
    if (bob.current) {
      if (moving) {
        bob.current.position.y += (Math.abs(Math.sin(phase.current)) * (0.05 + energy * 0.03) * g - bob.current.position.y) * Math.min(1, dt * 12);
        bob.current.rotation.x += (-0.16 * g - bob.current.rotation.x) * Math.min(1, dt * 10); // lean forward while walking
        bob.current.rotation.z += (0 - bob.current.rotation.z) * Math.min(1, dt * 8);
        bob.current.rotation.y += (0 - bob.current.rotation.y) * Math.min(1, dt * 8);
      } else {
        // Subtle idle life — alive, not restless. The breath quickens a little under stress.
        const et = clock.elapsedTime;
        const breathHz = 1.1 + stress * 0.8;
        const breath = 0.004 + Math.sin(et * breathHz) * (0.006 + stress * 0.004);
        const sway = Math.sin(et * 0.21) * 0.017 + Math.sin(et * 0.083 + 1.3) * 0.011; // weight shift
        const settle = Math.sin(et * 0.15 + 0.6) * 0.04; // very small head/upper drift
        bob.current.position.y += (breath - bob.current.position.y) * Math.min(1, dt * 3);
        bob.current.rotation.x += (0 - bob.current.rotation.x) * Math.min(1, dt * 4);
        bob.current.rotation.z += (sway - bob.current.rotation.z) * Math.min(1, dt * 2.5);
        bob.current.rotation.y += (settle - bob.current.rotation.y) * Math.min(1, dt * 2.5);
      }
    }
    // Hip swings the whole leg; the knee (shin) only folds on the leg swinging back, which is what stops
    // the walk looking stiff-legged.
    if (hipL.current) hipL.current.rotation.x = swing.current;
    if (hipR.current) hipR.current.rotation.x = -swing.current;
    if (shinL.current) shinL.current.rotation.x = Math.max(0, -swing.current) * 0.9;
    if (shinR.current) shinR.current.rotation.x = Math.max(0, swing.current) * 0.9;
  });
  return <group ref={figure}>
    <WalkLeg hipRef={hipL} shinRef={shinL} x={-0.15} />
    <WalkLeg hipRef={hipR} shinRef={shinR} x={0.15} />
    {/* The smoking layer sits inside the bobbing group, so the upper-body animation blends over the
        walk cycle: the legs keep striding while the cigarette turns and bobs with the body. */}
    <group ref={bob}><UpperBody hipY={0.82} posture /><SmokingEffect hipY={0.82} /></group>
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
  // Pin this group's world matrix to the identity so its children live in WORLD space even though the
  // component is mounted inside the (turning, bobbing) body rig. Puffs then hang in the air where they
  // were exhaled and the producer walks out of them, instead of the cloud swinging around on every turn.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.matrixAutoUpdate = false;
    g.matrixWorldAutoUpdate = false;
    g.matrix.identity();
    g.matrixWorld.identity();
  }, []);
  useFrame((_, delta) => {
    const meshes = group.current?.children;
    if (!meshes) return;
    const emit = (x: number, y: number, z: number, strength: number) => {
      const free = puffs.find((puff) => puff.life <= 0);
      if (!free) return;
      free.x = x + (Math.random() - 0.5) * 0.05;
      free.y = y;
      free.z = z + (Math.random() - 0.5) * 0.05;
      free.vx = (Math.random() - 0.5) * 0.15 * strength;
      free.vy = 0.16 + Math.random() * 0.14 * strength;
      free.vz = (Math.random() - 0.5) * 0.15 * strength;
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

// One drag runs about five seconds end to end, which is exactly how long `smokingMinutes` lasts —
// so the cigarette is raised, drawn on, exhaled and lowered once, then put away.
const SMOKE_RAISE = 1.1; // hand travels up to the mouth
const SMOKE_INHALE = 0.9; // held at the lips, drawing
const SMOKE_HOLD = 0.5; // breath held before letting go
const SMOKE_LOWER = 1.2; // hand comes back down while exhaling
const SMOKE_REST = 1.3; // held at the side afterwards
const SMOKE_CYCLE = SMOKE_RAISE + SMOKE_INHALE + SMOKE_HOLD + SMOKE_LOWER + SMOKE_REST;

/**
 * Upper-body smoking layer. This is deliberately just the arm and the smoke — it is mounted *inside*
 * the body rig (the bobbing/turning group of the walking figure, or the seated torso) so it blends
 * over whatever the lower body is doing: the producer can walk, run and steer while smoking, and the
 * cigarette turns and bobs with them. One drag plays through in the ~5s the timer lasts, then the
 * cigarette scales away and the body returns to plain locomotion.
 */
function SmokingEffect({ hipY }: { hipY: number }) {
  const smoking = useGameStore((state) => state.smokingMinutes > 0);
  const [mounted, setMounted] = useState(false);
  const arm = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Object3D>(null);
  const ember = useRef<THREE.Mesh>(null);
  const emberLight = useRef<THREE.PointLight>(null);
  const phase = useRef(0); // one pass through the cycle, starting from the hand at the side
  const exhale = useRef(0);
  const tipTrickle = useRef(0);
  const fade = useRef(0); // eases the cigarette in when lit and out when it is done
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const smoothing = (from: number, to: number, t: number) => from + (to - from) * (t * t * (3 - 2 * t));
  const restPos: [number, number, number] = [0.34, hipY + 0.16, -0.16];
  const mouthPos: [number, number, number] = [0.13, hipY + 0.92, -0.24];
  // Light up: restart the drag. Stub out: linger briefly so the fade-out can play before unmounting.
  useEffect(() => {
    if (smoking) { phase.current = 0; exhale.current = 0; setMounted(true); return; }
    if (!mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 600);
    return () => window.clearTimeout(timer);
  }, [smoking, mounted]);
  useFrame((_, delta) => {
    if (!arm.current) return;
    fade.current += ((smoking ? 1 : 0) - fade.current) * Math.min(1, delta * 7);
    arm.current.scale.setScalar(Math.max(0.001, fade.current));
    if (!smoking) return;
    // Clamps rather than wraps: the animation plays through once and finishes with the hand lowered.
    phase.current = Math.min(phase.current + delta, SMOKE_CYCLE);
    const t = phase.current;
    let lift = 0; // 0 = hand at the side, 1 = cigarette at the lips
    let drawing = false;
    const inhaleEnd = SMOKE_RAISE + SMOKE_INHALE;
    const holdEnd = inhaleEnd + SMOKE_HOLD;
    if (t < SMOKE_RAISE) lift = smoothing(0, 1, t / SMOKE_RAISE);
    else if (t < inhaleEnd) { lift = 1; drawing = true; }
    else if (t < holdEnd) lift = 1; // breath held, cigarette still at the lips
    else if (t < holdEnd + SMOKE_LOWER) lift = smoothing(1, 0, (t - holdEnd) / SMOKE_LOWER);
    arm.current.position.set(
      restPos[0] + (mouthPos[0] - restPos[0]) * lift,
      restPos[1] + (mouthPos[1] - restPos[1]) * lift,
      restPos[2] + (mouthPos[2] - restPos[2]) * lift,
    );
    arm.current.rotation.z = -0.35 + lift * 0.95; // wrist turns in as it reaches the mouth
    arm.current.rotation.x = lift * -0.45;
    // The tip burns bright red while drawing, and idles at a dull ember otherwise.
    const glow = drawing ? 5.5 : 2.2;
    if (ember.current) {
      const material = ember.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity += (glow - material.emissiveIntensity) * Math.min(1, delta * 6);
    }
    if (emberLight.current) emberLight.current.intensity += ((drawing ? 0.9 : 0.35) - emberLight.current.intensity) * Math.min(1, delta * 6);
    // The exhale window opens the moment the held breath is released.
    exhale.current = t >= holdEnd && t < holdEnd + 1.0 ? exhale.current + delta : 0;
    tipTrickle.current += delta;
  });
  if (!mounted) return null;
  // Emission points are resolved in world space, because the puff pool is world-anchored.
  const emitter = (emit: (x: number, y: number, z: number, strength: number) => void, delta: number) => {
    if (!arm.current || !smoking) return;
    // A thin wisp keeps rising off the lit tip the whole time the cigarette is in hand.
    if (tipTrickle.current > 0.22) {
      tipTrickle.current = 0;
      scratch.set(0, 0.15, 0);
      arm.current.localToWorld(scratch);
      emit(scratch.x, scratch.y, scratch.z, 0.35);
    }
    // Exhale: a slower, wider cloud leaving the mouth after each inhale.
    if (exhale.current > 0 && exhale.current < 1.0 && mouth.current && Math.random() < delta * 26) {
      mouth.current.getWorldPosition(scratch);
      emit(scratch.x, scratch.y, scratch.z, 1);
    }
  };
  return <group>
    <group ref={arm} position={restPos} rotation={[0, 0, -0.35]}>
      {/* Plain white paper stick with a buff filter, and a red coal burning at the tip. */}
      <mesh><cylinderGeometry args={[0.017, 0.017, 0.26, 10]} /><meshStandardMaterial color="#f7f7f4" roughness={0.85} /></mesh>
      <mesh position={[0, -0.1, 0]}><cylinderGeometry args={[0.0175, 0.0175, 0.07, 10]} /><meshStandardMaterial color="#c9a15e" roughness={0.9} /></mesh>
      <mesh ref={ember} position={[0, 0.145, 0]}><cylinderGeometry args={[0.018, 0.018, 0.035, 10]} /><meshStandardMaterial color="#ff3b18" emissive="#ff2a0c" emissiveIntensity={2.2} toneMapped={false} /></mesh>
      <mesh position={[0, 0.125, 0]}><cylinderGeometry args={[0.0182, 0.0182, 0.02, 10]} /><meshStandardMaterial color="#4a3b34" roughness={1} /></mesh>
      <pointLight ref={emberLight} position={[0, 0.15, 0]} color="#ff5a26" intensity={0.35} distance={0.7} />
    </group>
    {/* Invisible anchor marking the mouth, so the exhale starts from the right place in world space. */}
    <object3D ref={mouth} position={[0.06, hipY + 0.9, -0.3]} />
    <SmokePuffs emitter={emitter} />
  </group>;
}

/**
 * Ambient thought bubble. The producer never speaks — this is mood, not dialogue: a tiny symbol
 * (rarely a word) that fades in above the head, holds for a couple of seconds and fades out again.
 * The store picks the content on a long cooldown; this only owns the fade.
 */
function ThoughtBubble({ y }: { y: number }) {
  const thought = useGameStore((state) => state.thought);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!thought) { setVisible(false); return; }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, [thought]);
  if (!thought) return null;
  return <Html center position={[0.55, y, 0]} distanceFactor={9} zIndexRange={[20, 0]}>
    <div
      className="pointer-events-none select-none rounded-2xl bg-paper/90 px-3 py-1.5 text-[15px] leading-none text-night shadow-lg transition-all duration-700 ease-out"
      style={{ opacity: visible ? 1 : 0, transform: `translateY(${visible ? 0 : 6}px) scale(${visible ? 1 : 0.85})` }}
    >
      {thought.text}
    </div>
  </Html>;
}

// ── Rigged GLB player (Meshy "Midnight Listener"). Loads the skinned mesh once and drives it from the
//    same store state as the procedural figure: follows playerPosition, faces travel, crossfades
//    idle/walk/run. Jonny's export has no sit/lie clip, so the seated & lying poses are produced by
//    posing the GLB's own bones (never by reverting to the old procedural body). ──
const GLB_IDLE = '/models/idle.glb';
const GLB_WALK = '/models/walking.glb';
const GLB_RUN = '/models/running.glb';
const GLB_SIT = '/models/sit.glb'; // Step_to_Sit_Transition (plays once, holds the seated end pose)
const GLB_LIE = '/models/lie.glb'; // Knock_Down (plays once, holds the lying end pose)
// Interaction poses, re-exported as FBX (the GLB versions had their motion stuck on an unusable rigify
// track). These carry real motion on the Armature bones, so they drive Jonny's seated / lying activities:
// NOTE: the maketune/drink FBX clips keep Hips translation on a rig whose rest doesn't map onto this GLB
// skeleton (they render displaced/invisible), so those SEATED activities use the GLB sit pose + FX overlays.
// The scroll + ukulele FBX are quaternion-only (no foreign translation), so they bind cleanly.
const FBX_SCROLL = '/models/scroll.fbx'; // Doomscroll (lying, thumbing the phone)
const FBX_MAKETUNE = '/models/maketune.fbx'; // seated collaboration performance
const FBX_UKULELE = '/models/ukulele.fbx'; // Ukulele performance (standing, strumming)
const MODEL_SCALE = 1.7; // tuned so the model reads as human-scale against the furniture
const MODEL_FORWARD = 0; // yaw offset if the model's front axis isn't −z (tuned after first view)
// Root placement for the real seated / lying clips (the clip poses the body; we only place the root).
// Raised to meet the enlarged (FURNITURE_SCALE) chair seat and mattress.
// Per-pose seat height: the GLB `sit` clip and the FBX `tune`/`drink` clips lower the pelvis to DIFFERENT
// heights, so each gets its own root Y to land the butt on the chair seat (~0.84 world) with feet ~on the
// floor. Tuned by eye against the current chair + character scale.
const SEAT_ROOT_Y = 0.24; // GLB sit clip — raised to meet the enlarged (CHAIR_SCALE) seat
const SEAT_ROOT_Z = -0.1; // settle back into the chair
const LIE_ROOT_Y = 0.72; // scaled root rests just above the duvet so the body no longer intersects the bed
const LIE_ROOT_Z = 0.2; // slide toward the pillow / headboard end
const LIE_YAW = Math.PI; // rotate lying + doom-scroll another 90° so Jonny's head points toward the pillow end

// ── Silhouette material pass. The GLB ships as ONE SkinnedMesh with one textured material; for the MMHA
//    look we override it at runtime with a matte near-black material so the character reads as a moving
//    black graphic figure rather than a textured 3D person. It's REVERSIBLE — the original material is
//    stashed on userData and 'original' mode restores it — and it never touches bones/skin/clips, only
//    the material slot, so animation is unaffected. Dev-only art-direction toggle (not player-facing). ──
type CharacterRenderMode = 'original' | 'silhouette' | 'unlit-silhouette';
const CHARACTER_RENDER_MODE: CharacterRenderMode = 'silhouette';
const SILHOUETTE_COLOR = '#0e1119'; // dark blue-black charcoal (in the #080A0F–#111520 range)

/** One shared silhouette material for the character. 'silhouette' = matte MeshStandard that still takes
 *  the room light (so shoulders/locs/legs keep subtle form); 'unlit-silhouette' = flat MeshBasic black
 *  contour for comparison. Created once and reused — never per frame. */
function createMMHASilhouetteMaterial(mode: CharacterRenderMode, color: string = SILHOUETTE_COLOR): THREE.Material {
  if (mode === 'unlit-silhouette') return new THREE.MeshBasicMaterial({ color });
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
}

/** Swap every character mesh's material for `mat` (silhouette) or restore the stashed original, in place.
 *  Only touches meshes inside the passed player-character root, so environment assets are never affected. */
function applyCharacterSilhouette(root: THREE.Object3D, mode: CharacterRenderMode, mat: THREE.Material) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData.originalMaterial === undefined) m.userData.originalMaterial = m.material; // stash once for restore
    m.material = mode === 'original' ? (m.userData.originalMaterial as THREE.Material) : mat;
  });
}

/** Grab one clip from a GLB and rename it to a stable key. The idle.glb (Meshy `019ff778` canonical)
 *  ships TWO clips — a `rigify_clip` test motion and the `clip0`/baselayer STATIC base pose — so we
 *  prefer the base-layer/clip0 pose and never the rigify motion. Single-clip files just take [0]. */
function pickClip(g: { animations: THREE.AnimationClip[] }, name: string, basePose = false): THREE.AnimationClip | undefined {
  const anims = g.animations ?? [];
  const src = basePose
    ? (anims.find((a) => /baselayer|clip0/i.test(a.name)) ?? anims.find((a) => !/rigify/i.test(a.name)) ?? anims[0])
    : anims[0];
  const c = src?.clone(); if (c) c.name = name; return c;
}

// ── FBX clips. Unlike the GLB exports (whose usable motion was stuck on an unusable rigify track), the
//    FBX re-exports keep every clip on the real Armature bone names, so they drive the GLB- OR FBX-skinned
//    character by bone name. We keep ONLY the quaternion tracks: rotation is unit-agnostic (a clip authored
//    in centimetres poses a metre-scaled mesh correctly) and dropping the position/scale tracks removes the
//    cm-scale root drift — the sim places the root itself. ──
function fbxRotationClip(src: THREE.AnimationClip | undefined, name: string, dropRoot = false, keepPosition = false, posScale = 1): THREE.AnimationClip | undefined {
  if (!src) return undefined;
  const c = src.clone();
  // Keep rotation (and, for a seated/lying pose, `keepPosition` also keeps the bone TRANSLATION so the
  // pelvis actually lowers onto the seat instead of bending at standing hip height). Scale tracks are
  // always dropped. `dropRoot` drops the Hips (root) track for clips lifted from a different-axis export.
  // `posScale` rescales the position VALUES: these FBX clips store translation in CENTIMETRES, but they're
  // bound to the metre-scale GLB skeleton, so they must be scaled by 0.01 or the hips fly ~100 units up.
  c.tracks = c.tracks.filter((t) => {
    if (dropRoot && /^Hips\./.test(t.name)) return false;
    if (/\.quaternion$/.test(t.name)) return true;
    // Keep ONLY the Hips (root) translation — never other bones' positions, whose FBX bone-lengths would
    // distort the GLB skeleton. The quaternions pose the limbs; this just drops the pelvis onto the seat.
    if (keepPosition && /^Hips\.position$/.test(t.name)) return true;
    return false;
  });
  if (keepPosition && posScale !== 1) {
    for (const t of c.tracks) {
      if (/^Hips\.position$/.test(t.name)) { const v = t.values; for (let i = 0; i < v.length; i += 1) v[i] *= posScale; }
    }
  }
  c.name = name;
  return c;
}
/** Pick the meaningful clip from an FBX group: the one carrying motion (skip the 0.07s `clip0` base pose
 *  unless `basePose` explicitly wants that static standing pose), then reduce its tracks. */
function fbxPick(g: { animations: THREE.AnimationClip[] }, name: string, basePose = false, dropRoot = false, keepPosition = false, posScale = 1): THREE.AnimationClip | undefined {
  const anims = g.animations ?? [];
  const src = basePose
    ? (anims.find((a) => /clip0|baselayer/i.test(a.name)) ?? anims[0])
    : (anims.find((a) => !/clip0/i.test(a.name)) ?? anims[0]);
  return fbxRotationClip(src, name, dropRoot, keepPosition, posScale);
}
/** Anchor an in-place pose (sit / lie / tune / drink): zero the Hips (root) X and Z translation so the clip
 *  no longer walks the body FORWARD off the chair/bed spot (Step-to-Sit etc. bake a step-in), while keeping
 *  the Hips Y so the pelvis still drops onto the seat. The sim already places the root at the chair/bed. */
function anchorHipsInPlace(clip: THREE.AnimationClip | undefined): THREE.AnimationClip | undefined {
  if (!clip) return clip;
  const t = clip.tracks.find((tr) => /Hips\.position$/.test(tr.name));
  if (t) { const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; } }
  return clip;
}

/** Scale factor that makes `root` stand `targetHeight` world units tall, whatever units the source used
 *  (FBX often imports in centimetres). Measured from the world-space bounding box after cloning. */
function heightScale(root: THREE.Object3D, targetHeight: number): number {
  const box = new THREE.Box3().setFromObject(root);
  const h = box.max.y - box.min.y;
  return h > 0.0001 ? targetHeight / h : 1;
}

// Bone handles used to pose the GLB skeleton procedurally (seated legs, arms-down idle) on top of / in
// place of a clip. Shared by all three characters (identical 24-bone rig).
type PoseBones = { ulL?: THREE.Object3D; ulR?: THREE.Object3D; lL?: THREE.Object3D; lR?: THREE.Object3D; spine?: THREE.Object3D; aL?: THREE.Object3D; aR?: THREE.Object3D; fL?: THREE.Object3D; fR?: THREE.Object3D; hL?: THREE.Object3D; hR?: THREE.Object3D };
function grabPoseBones(root: THREE.Object3D): PoseBones {
  const g = (n: string) => root.getObjectByName(n) ?? undefined;
  return { ulL: g('LeftUpLeg'), ulR: g('RightUpLeg'), lL: g('LeftLeg'), lR: g('RightLeg'), spine: g('Spine'), aL: g('LeftArm'), aR: g('RightArm'), fL: g('LeftForeArm'), fR: g('RightForeArm'), hL: g('LeftHand'), hR: g('RightHand') };
}

/** Ukulele held across the chest while performing (an overlay, so it's always visible — reliably shown
 *  in front of the standing strum pose rather than parented to a hand bone). Faces the camera-ish. */
function HeldUkulele() {
  return <group position={[0.12, 1.6, 0.34]} rotation={[0.15, 0.2, -0.5]}>
    <mesh position={[0, 0, 0]} scale={[1, 1.25, 0.42]} castShadow><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color="#c68a4e" roughness={0.5} /></mesh>
    <mesh position={[0, 0.02, 0.09]}><circleGeometry args={[0.06, 14]} /><meshStandardMaterial color="#2a1c12" /></mesh>
    <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.06, 0.56, 0.045]} /><meshStandardMaterial color="#7a5a41" roughness={0.6} /></mesh>
    <mesh position={[0, 0.82, 0.005]} rotation={[0.16, 0, 0]}><boxGeometry args={[0.09, 0.14, 0.035]} /><meshStandardMaterial color="#2a1c12" /></mesh>
  </group>;
}

/** A short cup of vodka held near the seated producer while they drink. */
function HeldCup() {
  return <group position={[0.16, 1.02, -0.34]}>
    <mesh castShadow><cylinderGeometry args={[0.09, 0.1, 0.2, 14]} /><meshStandardMaterial color="#e7e1d5" transparent opacity={0.72} roughness={0.15} /></mesh>
    <mesh position={[0, -0.03, 0]}><cylinderGeometry args={[0.085, 0.085, 0.12, 14]} /><meshStandardMaterial color="#cfd8e6" transparent opacity={0.6} /></mesh>
  </group>;
}

/** A lit cigarette held near the hand while smoking. */
function HeldCigarette() {
  return <group position={[0.22, 1.28, -0.24]} rotation={[0, 0, 0.2]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.016, 0.016, 0.24, 8]} /><meshStandardMaterial color="#efe9dd" /></mesh>
    <mesh position={[0.13, 0, 0]}><sphereGeometry args={[0.022, 8, 8]} /><meshStandardMaterial color="#ff7a3a" emissive="#ff5a1a" emissiveIntensity={2} toneMapped={false} /></mesh>
  </group>;
}

function PlayerModel() {
  const idle = useGLTF(GLB_IDLE);
  const walk = useGLTF(GLB_WALK);
  const run = useGLTF(GLB_RUN);
  const sit = useGLTF(GLB_SIT);
  const lie = useGLTF(GLB_LIE);
  // Interaction poses (FBX): real motion on the Armature bones, bound by bone name to the GLB skeleton.
  const scrollFbx = useLoader(FBXLoader, FBX_SCROLL);
  const maketuneFbx = useLoader(FBXLoader, FBX_MAKETUNE);
  const ukuleleFbx = useLoader(FBXLoader, FBX_UKULELE);
  // One reusable silhouette material for this instance (created once, disposed on unmount).
  const silhouette = useMemo(() => createMMHASilhouetteMaterial(CHARACTER_RENDER_MODE), []);
  useEffect(() => () => silhouette.dispose(), [silhouette]);
  // Clone the mesh from the WALK file (a clean Armature skeleton) so every clip — walk, run, and the
  // idle base pose lifted from idle.glb — binds by bone name. Shadow-enable + apply the silhouette.
  // Bone handles are for procedural seated/lying posing (the export has no sit/lie clip).
  const bones = useRef<PoseBones>({});
  const scene = useMemo(() => {
    const root = cloneSkeleton(walk.scene) as THREE.Object3D;
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    applyCharacterSilhouette(root, CHARACTER_RENDER_MODE, silhouette);
    bones.current = grabPoseBones(root);
    return root;
  }, [walk.scene, silhouette]);
  const clips = useMemo(() => [
    pickClip(idle, 'idle', true), pickClip(walk, 'walk'), pickClip(run, 'run'),
    // sit/lie (GLB) bake a step-in walk into the root — anchor them in place so the body stays on the chair/bed.
    anchorHipsInPlace(pickClip(sit, 'sit')), anchorHipsInPlace(pickClip(lie, 'lie')),
    fbxPick(scrollFbx, 'scroll'), // doomscroll lying pose (quaternion-only)
    fbxPick(maketuneFbx, 'maketune'), // seated collaboration motion
    fbxPick(ukuleleFbx, 'ukulele'), // standing strum performance (quaternion-only, upright)
  ].filter(Boolean) as THREE.AnimationClip[], [idle, walk, run, sit, lie, scrollFbx, maketuneFbx, ukuleleFbx]);
  const group = useRef<THREE.Group>(null);
  const phoneProp = useRef<THREE.Group>(null);
  const { actions } = useAnimations(clips, scene);
  useEffect(() => {
    const hand = bones.current.hR;
    const prop = phoneProp.current;
    if (!hand || !prop) return;
    hand.add(prop);
    prop.position.set(0.02, -0.11, 0.035);
    prop.rotation.set(Math.PI / 2, 0, 0);
    return () => { hand.remove(prop); };
  }, [scene]);
  const st = useRef({ x: 0, z: 0, ready: false, facing: 0, clip: '' });
  useFrame((_, dt) => {
    const s = useGameStore.getState();
    const g = group.current; if (!g) return;
    const seated = s.seated, lying = s.lyingDown;
    if (phoneProp.current) phoneProp.current.visible = lying && s.scrolling;
    const [x, z] = toWorld(s.playerPosition.x, s.playerPosition.y);
    const c = st.current;
    if (!c.ready) { c.x = x; c.z = z; c.ready = true; }
    const dx = x - c.x, dz = z - c.z; c.x = x; c.z = z;
    const moving = !seated && !lying && Math.hypot(dx, dz) > 0.0015;
    const ease = Math.min(1, dt * 10);
    // Clip per state. All SEATED activities (plain sit / make-a-tune / drink-vodka) use the GLB `sit` pose,
    // which reliably seats the body ON the chair; the make-tune/drink FBX clips are authored on a rig whose
    // Hips rest doesn't map onto this GLB skeleton (they render displaced/invisible), so seated activities
    // are differentiated by their FX/prop overlays instead. Lying (sleep / doomscroll) uses the GLB `lie`.
    const want = moving ? (s.running ? 'run' : 'walk')
      : s.playingUkulele ? 'ukulele' // standing strum performance (ukulele.fbx)
      : s.friendActivity === 'tune' ? 'maketune'
      : (lying && s.scrolling) ? 'scroll' // doomscroll: real scroll motion, same lie orientation
      : lying ? 'lie'
      : seated ? 'sit'
      : 'idle';
    if (want !== c.clip) {
      const prev = actions[c.clip]; if (prev) prev.fadeOut(0.2);
      const next = actions[want];
      if (next) {
        next.reset();
        // Locomotion, idle, and the ongoing seated/lying ACTIVITY loops (tune / drink / scroll) cycle;
        // only the one-shot transitions (sit / lie) play once and hold their end frame.
        const once = want === 'sit' || want === 'lie';
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
        next.clampWhenFinished = once;
        next.fadeIn(0.2).play();
      }
      c.clip = want;
    }
    // Root transform per pose. The parent <Player> group already sits at the chair/bed (playerPosition
    // is SIT_POSITION / LIE_POSITION); the clip poses the body, we only place + orient the root.
    if (lying) {
      g.position.set(0, LIE_ROOT_Y, LIE_ROOT_Z);
      c.facing += (LIE_YAW - c.facing) * ease;
      g.rotation.set(0, c.facing, 0);
    } else if (seated) {
      g.position.set(0, SEAT_ROOT_Y, SEAT_ROOT_Z);
      c.facing += (Math.PI - c.facing) * ease; // face the desk (−z)
      g.rotation.set(0, c.facing, 0);
    } else {
      g.position.set(0, 0, 0);
      if (moving) { const target = Math.atan2(dx, dz) + MODEL_FORWARD; const diff = Math.atan2(Math.sin(target - c.facing), Math.cos(target - c.facing)); c.facing += diff * Math.min(1, dt * 14); }
      g.rotation.set(0, c.facing, 0);
    }
  });
  return <group ref={group} scale={MODEL_SCALE}>
    <primitive object={scene} />
    <group ref={phoneProp} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><boxGeometry args={[0.18, 0.34, 0.025]} /><meshStandardMaterial color="#0c0e14" metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0, 0, 0.018]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.15, 0.29]} /><meshStandardMaterial color="#536b9d" emissive="#536b9d" emissiveIntensity={1.35} toneMapped={false} /></mesh>
      <pointLight color="#6a7fb8" intensity={0.5} distance={0.8} />
    </group>
  </group>;
}
useGLTF.preload(GLB_IDLE); useGLTF.preload(GLB_WALK); useGLTF.preload(GLB_RUN);
useGLTF.preload(GLB_SIT); useGLTF.preload(GLB_LIE);
useLoader.preload(FBXLoader, FBX_SCROLL); useLoader.preload(FBXLoader, FBX_MAKETUNE); useLoader.preload(FBXLoader, FBX_UKULELE);

/** Jonny. The GLB stays mounted in EVERY state (walk / idle / seated / lying) — PlayerModel handles the
 *  per-state root transform + pose, so the old procedural body is never swapped back in. This group only
 *  carries the overlays that ride along with him: the cigarette, seated-collab props, the doom-scroll
 *  phone, the crystal, and the thought bubble — each positioned for the current pose. */
function Player({ crystal = true }: { crystal?: boolean } = {}) {
  const position = useGameStore((state) => state.playerPosition);
  const seated = useGameStore((state) => state.seated);
  const lyingDown = useGameStore((state) => state.lyingDown);
  const scrolling = useGameStore((state) => state.scrolling);
  const friendActivity = useGameStore((state) => state.friendActivity);
  const playingUkulele = useGameStore((state) => state.playingUkulele);
  const lastInteractionId = useGameStore((state) => state.lastInteraction?.id);
  const smokingMinutes = useGameStore((state) => state.smokingMinutes);
  const [x, z] = toWorld(position.x, position.y);
  // Overlay anchor heights track the pose: low while lying, mid while seated, high while standing.
  const crystalY = lyingDown ? 1.5 : seated ? 2.5 : 3.25;
  const thoughtY = lyingDown ? 1.9 : seated ? 2.9 : 3.75;
  const smokeHipY = lyingDown ? 0.8 : seated ? 0.72 : 0.95;
  return <group position={[x, 0, z]}>
    {/* Keep the canonical GLB mounted as the only player body; loading never flashes the legacy procedural body. */}
    <Suspense fallback={null}><PlayerModel /></Suspense>
    {/* Smoking rides the body in every state (was lost when the GLB replaced the procedural walker). */}
    <SmokingEffect hipY={smokeHipY} />
    {/* Held props — reliably visible in the hand (overlays, not bone-parented). */}
    {playingUkulele && <HeldUkulele />}
    {seated && lastInteractionId === 'vodka' && <HeldCup />}
    {smokingMinutes > 0 && <HeldCigarette />}
    {/* Seated collaboration props. */}
    {seated && friendActivity === 'tune' && <TunePerformance />}
    {seated && friendActivity === 'video-game' && <mesh position={[0, 1.18, -0.48]} rotation={[-0.28, 0, 0]}><boxGeometry args={[0.54, 0.3, 0.06]} /><meshStandardMaterial color="#263b48" emissive="#315f76" emissiveIntensity={0.8} /></mesh>}
    {crystal && <EmotionalCrystal y={crystalY} />}
    <ThoughtBubble y={thoughtY} />
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
    <mesh position={[0, 0.54, 0]} castShadow><boxGeometry args={[0.46, 1.08, 0.3]} /><meshStandardMaterial color="#232a24" roughness={0.96} /></mesh>
    {/* Long arms hinge at the shoulder and elbow, so they stay attached standing, seated, sipping and grooving. */}
    <group ref={armL} position={[-0.29, 0.98, -0.03]} rotation={[sipping ? -0.7 : 0.12, 0, sipping ? -0.22 : -0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.055, 0.26, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh>
      <group ref={foreL} position={[0, -0.34, 0]} rotation={[sipping ? -0.85 : 0, 0, 0]}><mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.05, 0.22, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh></group>
    </group>
    <group ref={armR} position={[0.29, 0.98, -0.03]} rotation={[sipping ? -0.7 : 0.12, 0, sipping ? 0.22 : 0.12]}>
      <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.055, 0.26, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh>
      <group ref={foreR} position={[0, -0.34, 0]} rotation={[sipping ? -0.85 : 0, 0, 0]}><mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.05, 0.22, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh></group>
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
  return <group ref={body} position={[0, 0.1, -0.28]}><mesh position={[-0.22, 0.48, 0]} rotation={[0.1, 0, -0.26]}><capsuleGeometry args={[0.045, 0.38, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh><mesh position={[0.22, 0.48, 0]} rotation={[0.1, 0, 0.26]}><capsuleGeometry args={[0.045, 0.38, 4, 8]} /><meshStandardMaterial color="#232a24" /></mesh><Sparkles count={10} scale={[0.8, 0.5, 0.4]} size={1.1} speed={0.6} color="#d6a447" /></group>;
}

function TunePerformance() {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (body.current) { body.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 5.2)) * 0.08; body.current.rotation.z = Math.sin(clock.elapsedTime * 5.2) * 0.1; } });
  return <group ref={body}><Sparkles count={8} scale={[0.7, 0.8, 0.5]} size={1.2} speed={1.6} color="#e6c34c" /></group>;
}

/** Procedural fallback body for Path (NPC1) — shown only while the Shadow Frequency GLB streams in. */
function VisitorProcedural() {
  const active = useGameStore((state) => state.visitorActive);
  const vpos = useGameStore((state) => state.visitorPos);
  const ppos = useGameStore((state) => state.playerPosition);
  const selectObject = useGameStore((state) => state.selectObject);
  const friendActivity = useGameStore((state) => state.friendActivity);
  const friendMenuOpen = useGameStore((state) => state.friendMenuOpen);
  const selected = useGameStore((state) => state.selectedObjectId === 'visitor');
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
  if (friendActivity === 'tune' || friendActivity === 'vodka' || friendActivity === 'video-game') return <group position={[vx, 0, vz]} rotation={[0, 0, 0]} scale={1.22} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}><SittingLegs /><FriendTorso hipY={0.62} groove={friendActivity === 'tune'} />{friendActivity === 'vodka' && <group ref={drinkGlass} position={[-0.22, 0.92, -0.32]}><mesh><cylinderGeometry args={[0.09, 0.1, 0.2, 12]} /><meshStandardMaterial color="#e7e1d5" transparent opacity={0.75} /></mesh></group>}</group>;
  return <group position={[vx, 0, vz]} rotation={[0, friendActivity ? facing : synthFacing, 0]} scale={1.22} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}>
    {/* Tall, slender friend: oversized boots, narrow silhouette, and individual dreadlock strands. */}
    <mesh position={[-0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.72, 4, 8]} /><meshStandardMaterial color="#293026" /></mesh>
    <mesh position={[0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.72, 4, 8]} /><meshStandardMaterial color="#293026" /></mesh>
    <mesh position={[-0.14, 0.07, -0.14]} castShadow><boxGeometry args={[0.25, 0.16, 0.48]} /><meshStandardMaterial color="#17140f" /></mesh>
    <mesh position={[0.14, 0.07, -0.14]} castShadow><boxGeometry args={[0.25, 0.16, 0.48]} /><meshStandardMaterial color="#17140f" /></mesh>
    <FriendTorso hipY={0.82} />
    {!friendActivity && !friendMenuOpen && <SynthPerformance />}
    {!friendActivity && <mesh position={[0, 1.15, 0.18]} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}><boxGeometry args={[0.8, 1.7, 0.18]} /><meshBasicMaterial transparent opacity={0} /></mesh>}
    {/* No narration plate — the label only appears as an affordance when the friend is selected. */}
    {selected && <Html center position={[0, 2.65, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">FRIEND · ENTER</div></Html>}
  </group>;
}

// ── Path = NPC1, rendered with the Meshy "Shadow Frequency" GLB (same 24-bone rig as Jonny, so it reuses
//    the GLB-driver + silhouette system). Path is driven ENTIRELY by the existing NPC1 (visitor) store
//    state: walks in to the modular synth, stands/plays it, sits with the producer for activities, then
//    leaves. Path is 190cm vs Jonny's 173cm → ~1.10× Jonny's rendered height. This is NOT Tom (NPC2). ──
const NPC1_WALK = '/models/shadow/walk.glb'; // Path = Shadow Frequency
const NPC1_SIT = '/models/shadow/sit.glb';
const NPC1_IDLE = '/models/shadow/idle.glb'; // canonical base pose (clip0)
const NPC1_MAKETUNE = '/models/maketune.fbx';
// Jonny renders at ~1.7·1.7 = 2.89 units = 173cm (≈59.9 cm/unit); Path 190cm → ~3.17 units. Shadow
// Frequency is 1.88 raw, so scale ≈ 3.17/1.88 ≈ 1.69 (measured bounding box, not a blind ratio).
const NPC1_SCALE = 1.69;
const NPC1_SILHOUETTE = '#0c0f13'; // near-black, its own value distinct from Jonny and Tom

function Npc1Model() {
  const walkGlb = useGLTF(NPC1_WALK);
  const sitGlb = useGLTF(NPC1_SIT);
  const idleGlb = useGLTF(NPC1_IDLE);
  const maketuneFbx = useLoader(FBXLoader, NPC1_MAKETUNE);
  const selectObject = useGameStore((s) => s.selectObject);
  const selected = useGameStore((s) => s.selectedObjectId === 'visitor');
  const friendActivity = useGameStore((s) => s.friendActivity);
  const silhouette = useMemo(() => createMMHASilhouetteMaterial(CHARACTER_RENDER_MODE, NPC1_SILHOUETTE), []);
  useEffect(() => () => silhouette.dispose(), [silhouette]);
  const bones = useRef<PoseBones>({});
  const scene = useMemo(() => {
    const root = cloneSkeleton(walkGlb.scene) as THREE.Object3D;
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    applyCharacterSilhouette(root, CHARACTER_RENDER_MODE, silhouette);
    bones.current = grabPoseBones(root);
    return root;
  }, [walkGlb.scene, silhouette]);
  const clips = useMemo(() => [pickClip(walkGlb, 'walk'), pickClip(sitGlb, 'sit'), pickClip(idleGlb, 'idle', true), fbxPick(maketuneFbx, 'maketune')].filter(Boolean) as THREE.AnimationClip[], [walkGlb, sitGlb, idleGlb, maketuneFbx]);
  const group = useRef<THREE.Group>(null);
  const drinkGlass = useRef<THREE.Group>(null);
  const { actions } = useAnimations(clips, scene);
  const st = useRef({ x: 0, z: 0, ready: false, facing: 0, clip: '' });
  const sip = useRef({ timer: 3.5, progress: 0 });
  // Path patches the modular synth (its SFX) while standing at it, not during a seated activity.
  const atSynth = useGameStore((s) => s.visitorActive && !s.friendActivity && !s.friendMenuOpen);
  useEffect(() => {
    if (!atSynth) return;
    const timer = window.setInterval(() => playModularPatch(), 5200 + Math.random() * 3600);
    return () => window.clearInterval(timer);
  }, [atSynth]);
  useFrame((_, dt) => {
    const s = useGameStore.getState();
    if (!s.visitorActive || !group.current) return;
    const [vx, vz] = toWorld(s.visitorPos.x, s.visitorPos.y);
    const [px, pz] = toWorld(s.playerPosition.x, s.playerPosition.y);
    const [sx, sz] = toWorld(SYNTH_CENTER.x, SYNTH_CENTER.y); // the synth controls NPC1 faces
    const c = st.current;
    if (!c.ready) { c.x = vx; c.z = vz; c.ready = true; }
    const dx = vx - c.x, dz = vz - c.z; c.x = vx; c.z = vz;
    const moving = Math.hypot(dx, dz) > 0.0015 && !s.friendActivity;
    // Face travel while walking, the producer during a seated activity, else the synth controls it plays.
    // NPC1 now stands at the performance anchor IN FRONT of the rack, so it simply faces the synth centre.
    let tx = sx - vx, tz = sz - vz;
    if (s.friendActivity) { tx = px - vx; tz = pz - vz; } else if (moving) { tx = dx; tz = dz; }
    const target = Math.atan2(tx, tz) + MODEL_FORWARD;
    const diff = Math.atan2(Math.sin(target - c.facing), Math.cos(target - c.facing));
    c.facing += diff * Math.min(1, dt * 6);
    group.current.position.set(vx, 0, vz);
    group.current.rotation.y = c.facing;
    // Clip: a held seated pose during any friend activity (tune/vodka differentiated by the FX/prop
    // overlays), walk while moving, else the idle base pose (standing at the synth).
    const want = s.friendActivity === 'tune' ? 'maketune' : s.friendActivity ? 'sit' : moving ? 'walk' : 'idle';
    if (want !== c.clip) {
      if (c.clip) actions[c.clip]?.fadeOut(0.2);
      const a = actions[want];
      if (a) {
        a.reset();
        if (want === 'sit') { a.play(); a.paused = true; a.time = Math.max(0, a.getClip().duration - 0.05); } // hold the seated end frame
        else { const once = want !== 'walk' && want !== 'idle'; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.fadeIn(0.2).play(); }
      }
      c.clip = want;
    }
    // Vodka: raise/tip the glass on a loose timer while drinking.
    if (s.friendActivity === 'vodka' && drinkGlass.current) {
      if (sip.current.progress > 0) { sip.current.progress += dt; if (sip.current.progress > 1.7) sip.current.progress = 0; }
      else { sip.current.timer -= dt; if (sip.current.timer <= 0) { sip.current.progress = 0.01; sip.current.timer = 4 + Math.random() * 7; } }
      const sipping = sip.current.progress > 0.05;
      drinkGlass.current.position.y += ((sipping ? 1.28 : 0.92) - drinkGlass.current.position.y) * Math.min(1, dt * 8);
      drinkGlass.current.rotation.x += ((sipping ? -0.5 : 0) - drinkGlass.current.rotation.x) * Math.min(1, dt * 8);
    }
  });
  // Position/rotation live on the outer group; the model is scaled inside it so props/label stay unscaled.
  return <group ref={group} onClick={(event) => { event.stopPropagation(); selectObject('visitor'); }}>
    <group scale={NPC1_SCALE}><primitive object={scene} /></group>
    {friendActivity === 'vodka' && <group ref={drinkGlass} position={[-0.22, 0.92, -0.32]}><mesh><cylinderGeometry args={[0.09, 0.1, 0.2, 12]} /><meshStandardMaterial color="#e7e1d5" transparent opacity={0.75} /></mesh></group>}
    {friendActivity === 'video-game' && <mesh position={[0, 1.18, -0.48]} rotation={[-0.28, 0, 0]}><boxGeometry args={[0.54, 0.3, 0.06]} /><meshStandardMaterial color="#263b48" emissive="#315f76" emissiveIntensity={0.8} /></mesh>}
    {selected && <Html center position={[0, 2.9, 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">FRIEND · ENTER</div></Html>}
  </group>;
}
useGLTF.preload(NPC1_WALK); useGLTF.preload(NPC1_SIT); useGLTF.preload(NPC1_IDLE); useLoader.preload(FBXLoader, NPC1_MAKETUNE);

/** Path (NPC1). Mounts only while visiting; the Shadow Frequency GLB streams in behind the procedural
 *  fallback so it never falls back to the old geometry once loaded. */
function Visitor() {
  const active = useGameStore((state) => state.visitorActive);
  if (!active) return null;
  // Path is always the Shadow Frequency GLB; the fallback stays empty instead of showing a second procedural body.
  return <Suspense fallback={null}><Npc1Model /></Suspense>;
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
/** NPC2 = Tom — procedural fallback body, shown only while the big Frequency GLB streams in. This is NOT
 *  Path (Path is NPC1 / the Visitor, using Shadow Frequency). Tom uses the big Frequency GLB + its own
 *  179cm scale and wander behaviour — never Path's GLB, scale, or synth logic. */
function Npc2Procedural() {
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
      <group ref={armL} position={[-0.26, 0.55, 0]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.14, 0]} castShadow><capsuleGeometry args={[0.06, 0.2, 4, 8]} /><meshStandardMaterial color={NPC2_COAT} /></mesh>
        <mesh position={[0, -0.36, 0]} castShadow><capsuleGeometry args={[0.055, 0.2, 4, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
        <mesh position={[0, -0.31, -0.065]}><boxGeometry args={[0.09, 0.035, 0.012]} /><meshStandardMaterial color="#252a31" /></mesh>
        <mesh position={[0, -0.4, -0.058]} rotation={[0, 0, -0.4]}><boxGeometry args={[0.07, 0.025, 0.012]} /><meshStandardMaterial color="#252a31" /></mesh>
        <mesh position={[0, -0.52, -0.02]}><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
      </group>
      <group ref={armR} position={[0.26, 0.55, 0]} rotation={[0, 0, 0.14]}>
        <mesh position={[0, -0.14, 0]} castShadow><capsuleGeometry args={[0.06, 0.2, 4, 8]} /><meshStandardMaterial color={NPC2_COAT} /></mesh>
        <mesh position={[0, -0.36, 0]} castShadow><capsuleGeometry args={[0.055, 0.2, 4, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
        <mesh position={[0, -0.31, -0.065]}><boxGeometry args={[0.09, 0.035, 0.012]} /><meshStandardMaterial color="#252a31" /></mesh>
        <mesh position={[0, -0.4, -0.058]} rotation={[0, 0, 0.4]}><boxGeometry args={[0.07, 0.025, 0.012]} /><meshStandardMaterial color="#252a31" /></mesh>
        <mesh position={[0, -0.52, -0.02]}><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
      </group>
      <group ref={head} position={[0, 0.66, 0]}>
        <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={NPC2_SKIN} /></mesh>
        <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.27, 0.27, 0.18, 12]} /><meshStandardMaterial color="#111015" /></mesh>
        <mesh position={[-0.12, 0.16, -0.18]}><boxGeometry args={[0.1, 0.045, 0.02]} /><meshStandardMaterial color="#d8e7ed" /></mesh>
        <mesh position={[0.12, 0.16, -0.18]}><boxGeometry args={[0.1, 0.045, 0.02]} /><meshStandardMaterial color="#d8e7ed" /></mesh>
      </group>
    </group>
  </group>;
}

// ── Tom (NPC2) = the redesigned "Urban Shadow Figure", now an FBX character (mesh + clips both FBX).
//    A separate character from Path (Shadow Frequency). Drives from NPC2's own wander state (npc2Pos),
//    walks toward targets and idles at each pause. The mesh imports in centimetres, so its render scale
//    is measured at load (heightScale) rather than hand-tuned. ──
const NPC2_MESH = '/models/bigfreq/idle.fbx'; // redesigned mesh + idle pose (rigify_clip)
const NPC2_WALK = '/models/bigfreq/Meshy_AI_Urban_Shadow_Figure_biped_Animation_Walking_withSkin.fbx';
const NPC2_CLAP = '/models/bigfreq/Meshy_AI_Urban_Shadow_Figure_biped_Animation_Sitting_Clap_withSkin.fbx';
const NPC2_DRINK = '/models/bigfreq/Meshy_AI_Urban_Shadow_Figure_biped_Animation_Sit_and_Drink_withSkin.fbx';
const NPC2_SEAT_Y = 0.12; // lift the seated FBX onto the sofa cushion
const NPC2_TARGET_HEIGHT = 3.0; // world units — Tom reads a touch taller than Jonny's ~2.89
const NPC2_SILHOUETTE = '#0d0e13'; // near-black, its own value distinct from Jonny and Path

function Npc2Model() {
  const meshFbx = useLoader(FBXLoader, NPC2_MESH);
  const walkFbx = useLoader(FBXLoader, NPC2_WALK);
  const clapFbx = useLoader(FBXLoader, NPC2_CLAP);
  const drinkFbx = useLoader(FBXLoader, NPC2_DRINK);
  const selectObject = useGameStore((s) => s.selectObject);
  const silhouette = useMemo(() => createMMHASilhouetteMaterial(CHARACTER_RENDER_MODE, NPC2_SILHOUETTE), []);
  useEffect(() => () => silhouette.dispose(), [silhouette]);
  const { scene, modelScale } = useMemo(() => {
    const root = cloneSkeleton(meshFbx) as THREE.Object3D;
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    applyCharacterSilhouette(root, CHARACTER_RENDER_MODE, silhouette);
    return { scene: root, modelScale: heightScale(root, NPC2_TARGET_HEIGHT) };
  }, [meshFbx, silhouette]);
  // idle native (root kept); walk lifted from a different-axis export (root dropped, upright); the two
  // seated poses (its own rig) are quaternion-only and placed on the bean bag via NPC2_SEAT_Y.
  const clips = useMemo(() => [fbxPick(meshFbx, 'idle'), fbxPick(walkFbx, 'walk', false, true), fbxPick(clapFbx, 'clap'), fbxPick(drinkFbx, 'drink')].filter(Boolean) as THREE.AnimationClip[], [meshFbx, walkFbx, clapFbx, drinkFbx]);
  const inner = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(clips, scene);
  const st = useRef({ x: 0, z: 0, ready: false, facing: 0, clip: '' });
  useFrame((_, dt) => {
    const s = useGameStore.getState();
    if (!s.npc2Active || !group.current || !inner.current) return;
    const [x, z] = toWorld(s.npc2Pos.x, s.npc2Pos.y);
    const c = st.current;
    if (!c.ready) { c.x = x; c.z = z; c.ready = true; }
    const dx = x - c.x, dz = z - c.z; c.x = x; c.z = z;
    const sitting = s.npc2Sitting;
    const moving = !sitting && Math.hypot(dx, dz) > 0.0015;
    const ease = Math.min(1, dt * 10);
    if (sitting) { c.facing += (Math.PI - c.facing) * ease; inner.current.position.set(0, NPC2_SEAT_Y, 0); } // seated, faces the room
    else {
      inner.current.position.set(0, 0, 0);
      if (moving) { const target = Math.atan2(dx, dz) + MODEL_FORWARD; const diff = Math.atan2(Math.sin(target - c.facing), Math.cos(target - c.facing)); c.facing += diff * Math.min(1, dt * 6); }
    }
    group.current.position.set(x, 0, z);
    group.current.rotation.y = c.facing;
    // Random seated pose (clap / drink) chosen by npc2Pose when it sits.
    const want = sitting ? (s.npc2Pose === 1 ? 'drink' : 'clap') : moving ? 'walk' : 'idle';
    if (want !== c.clip) {
      if (c.clip) actions[c.clip]?.fadeOut(0.2);
      const next = actions[want];
      if (next) { next.reset(); const once = want === 'clap' || want === 'drink'; next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = once; next.fadeIn(0.2).play(); }
      c.clip = want;
    }
  });
  return <group ref={group} onClick={(event) => { event.stopPropagation(); selectObject('npc2'); }}>
    <group ref={inner}><group scale={modelScale}><primitive object={scene} /></group></group>
  </group>;
}
useLoader.preload(FBXLoader, NPC2_MESH); useLoader.preload(FBXLoader, NPC2_WALK);
useLoader.preload(FBXLoader, NPC2_CLAP); useLoader.preload(FBXLoader, NPC2_DRINK);

/** NPC2 = Tom. Mounts only while visiting; the big Frequency GLB streams in behind the procedural
 *  fallback so it never reverts to the old geometry once loaded. */
function Npc2() {
  const active = useGameStore((state) => state.npc2Active);
  if (!active) return null;
  // Tom is always the Frequency GLB; avoid a visual model swap while the asset streams in.
  return <Suspense fallback={null}><Npc2Model /></Suspense>;
}

// ── NPC3 = the smallchill guest (arrives via the phone easter egg). GLB on the same 24-bone Meshy rig, so
//    it reuses the GLB driver + the shared sit clip; wanders and settles on a free sofa/bean-bag seat. ──
const NPC3_WALK = '/models/smallchill/walking.glb';
const NPC3_IDLE = '/models/smallchill/idle.glb';
const NPC3_SIT = '/models/sit.glb'; // shared seated transition (binds by bone name)
// The smallchill GLB imports at a tiny native height (~0.016 units), so it needs a large scale. Jonny is
// 170cm at ~2.89 units; Yebin (NPC3) is 161cm → ~2.74 units → 2.74 / 0.016 ≈ 171.
const NPC3_SCALE = 140; // reduced from 171 so NPC3 reads shorter than Jonny instead of oversized
const NPC3_SILHOUETTE = '#10131a';

function Npc3Model() {
  const walkGlb = useGLTF(NPC3_WALK);
  const idleGlb = useGLTF(NPC3_IDLE);
  const sitGlb = useGLTF(NPC3_SIT);
  const selectObject = useGameStore((s) => s.selectObject);
  const silhouette = useMemo(() => createMMHASilhouetteMaterial(CHARACTER_RENDER_MODE, NPC3_SILHOUETTE), []);
  useEffect(() => () => silhouette.dispose(), [silhouette]);
  const scene = useMemo(() => {
    const root = cloneSkeleton(walkGlb.scene) as THREE.Object3D;
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    applyCharacterSilhouette(root, CHARACTER_RENDER_MODE, silhouette);
    return root;
  }, [walkGlb.scene, silhouette]);
  const modelScale = NPC3_SCALE;
  const clips = useMemo(() => [pickClip(walkGlb, 'walk'), pickClip(idleGlb, 'idle', true), anchorHipsInPlace(pickClip(sitGlb, 'sit'))].filter(Boolean) as THREE.AnimationClip[], [walkGlb, idleGlb, sitGlb]);
  const inner = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(clips, scene);
  const st = useRef({ x: 0, z: 0, ready: false, facing: 0, clip: '' });
  useFrame((_, dt) => {
    const s = useGameStore.getState();
    if (!s.npc3Active || !group.current || !inner.current) return;
    const [x, z] = toWorld(s.npc3Pos.x, s.npc3Pos.y);
    const c = st.current;
    if (!c.ready) { c.x = x; c.z = z; c.ready = true; }
    const dx = x - c.x, dz = z - c.z; c.x = x; c.z = z;
    const sitting = s.npc3Sitting;
    const moving = !sitting && Math.hypot(dx, dz) > 0.0015;
    const ease = Math.min(1, dt * 10);
    group.current.position.set(x, 0, z);
    const want = sitting ? 'sit' : moving ? 'walk' : 'idle';
    if (want !== c.clip) {
      const prev = actions[c.clip]; if (prev) prev.fadeOut(0.2);
      const next = actions[want];
      if (next) { next.reset(); const once = want === 'sit'; next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = once; next.fadeIn(0.2).play(); }
      c.clip = want;
    }
    if (sitting) {
      inner.current.position.set(0, SEAT_ROOT_Y, SEAT_ROOT_Z);
      c.facing += (Math.PI - c.facing) * ease; // seated, facing into the room (−z)
    } else {
      inner.current.position.set(0, 0, 0);
      if (moving) { const target = Math.atan2(dx, dz) + MODEL_FORWARD; const diff = Math.atan2(Math.sin(target - c.facing), Math.cos(target - c.facing)); c.facing += diff * Math.min(1, dt * 8); }
    }
    group.current.rotation.y = c.facing;
  });
  return <group ref={group} onClick={(event) => { event.stopPropagation(); selectObject('npc2'); }}>
    <group ref={inner}><group scale={modelScale}><primitive object={scene} /></group></group>
  </group>;
}
useGLTF.preload(NPC3_WALK); useGLTF.preload(NPC3_IDLE); useGLTF.preload(NPC3_SIT);

function Npc3() {
  const active = useGameStore((state) => state.npc3Active);
  if (!active) return null;
  return <Suspense fallback={null}><Npc3Model /></Suspense>;
}

// Soft contact shadows so floor furniture reads as planted, not floating. One shared radial-gradient
// texture (built lazily on the client) is stamped as a flat plane under each grounded object.
let _contactShadowTex: THREE.Texture | null = null;
function contactShadowTexture(): THREE.Texture | null {
  if (_contactShadowTex) return _contactShadowTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.55, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  _contactShadowTex = new THREE.CanvasTexture(c);
  return _contactShadowTex;
}
// Approx floor footprint radius (world units) per grounded object; absent ids get no contact shadow.
const GROUND_SHADOW_RADIUS: Record<string, number> = {
  acousticGuitar: 0.8, electricGuitar: 0.8, chair: 0.8, friendChair: 0.8,
  bed: 1.9, instrumentTable: 1.8, miniFridge: 0.85, musicDesk: 2.7,
};

// How much to enlarge floor furniture so it matches the human-scale GLB characters (~2.9 units tall).
const FURNITURE_SCALE = 1.4;
const CHAIR_SCALE = 1.7; // chairs sized to the (larger) characters so the seat meets the body
const GUITAR_SCALE = 1.05; // floor guitars stay readable without dominating the walkway

function RoomObject({ object }: { object: StudioObject }) {
  const selected = useGameStore((state) => state.selectedObjectId === object.id);
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  const interact = useGameStore((state) => state.interact);
  const [x, z] = toWorld(object.x + object.width / 2, object.y + object.height / 2);
  const label = interactionById[object.id]?.label ?? object.id;
  const guitarNotesMinutes = useGameStore((state) => state.guitarNotesMinutes);
  // Desk gear is modelled with its base at DESK_Y (the tabletop's centre); DESKTOP_LIFT raises it the
  // half-thickness up to the true tabletop surface so props rest ON the desk rather than sunk into it.
  const deskLift = DESKTOP_IDS.has(object.id) ? DESKTOP_LIFT : 0;
  const baseY = DESKTOP_IDS.has(object.id) ? DESK_Y + DESKTOP_LIFT : TABLE_IDS.has(object.id) ? TABLE2_Y : 0; // gear sits on its table surface
  const ring = Math.max(0.5, Math.max(object.width, object.height) / 150);
  // Wall-mounted models are anchored to the room shell's wall plane rather than to their raw layout
  // position, so they stay flush no matter how the room is sized. The offset is applied along the
  // model's local Z, so right-wall objects (rotated a quarter turn) stay flush too. `WALL_MOUNT_DEPTH`
  // is each model's distance from its own origin to its wall-facing back face, so the back sits on the
  // wall (a hair proud, `WALL_GAP`, to avoid z-fighting) and the object extends into the room.
  const mountDepth = WALL_MOUNT_DEPTH[object.id] ?? 0.05;
  const wallOffset = object.wall === 'back'
    ? (WALL_BACK_INNER_Z + mountDepth + WALL_GAP) - z
    : object.wall === 'right'
      ? x - (WALL_RIGHT_INNER_X - mountDepth - WALL_GAP)
      : 0;
  const wallXOffset = object.wall === 'left'
    ? (WALL_LEFT_INNER_X + mountDepth - WALL_GAP) - x
    : 0;
  const wallWorldZOffset = object.wall === 'front'
    ? (WALL_FRONT_INNER_Z - mountDepth - WALL_GAP) - z
    : 0;
  // Point-and-click: first click walks to the object and selects it; clicking the selected object uses it.
  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (isDrag(event.nativeEvent)) return; // a rotate-drag that ended here, not a click
    if (selected) interact(object.id);
    else setMoveTarget({ x: object.x + object.width / 2, y: object.y + object.height / 2, selectId: object.id });
  };
  const localZOffset = object.wall ? wallOffset : DESKTOP_IDS.has(object.id) ? DESK_Z_OFFSET : 0;
  const shadowR = GROUND_SHADOW_RADIUS[object.id];
  const shadowTex = shadowR !== undefined ? contactShadowTexture() : null;
  // Floor furniture is scaled up to read at human scale against the (larger) GLB characters. Wall-mounted
  // pieces stay put (they anchor flush to the wall), and the doors are already sized to the characters.
  // The desk, instrument table and the gear on them grow only in footprint (X/Z) — their HEIGHT stays so
  // a seated player can still rest arms on the desk; everything else scales uniformly.
  const authoredSize = object.id === 'entrance' || object.id === 'ukulele' || object.id === 'sofa';
  const scaled = !object.wall && !authoredSize; // these are modelled at final size
  const worktop = object.id === 'musicDesk' || object.id === 'instrumentTable' || DESKTOP_IDS.has(object.id) || TABLE_IDS.has(object.id);
  const isChair = object.id === 'chair' || object.id === 'friendChair';
  const isFloorGuitar = object.id === 'acousticGuitar' || object.id === 'electricGuitar';
  const uniform = isChair ? CHAIR_SCALE : isFloorGuitar ? GUITAR_SCALE : FURNITURE_SCALE;
  const furnScale: [number, number, number] = !scaled ? [1, 1, 1] : worktop ? [FURNITURE_SCALE, 1, FURNITURE_SCALE] : [uniform, uniform, uniform];
  const shadowMul = isFloorGuitar ? GUITAR_SCALE : scaled ? FURNITURE_SCALE : 1;
  return <group position={[x + wallXOffset, 0, z + wallWorldZOffset]} rotation={[0, object.rotationY ?? 0, 0]} onClick={onSelect}>
    {shadowTex && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[shadowR * shadowMul, shadowR * shadowMul, 1]}>
      <planeGeometry args={[2, 2]} /><meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.85} />
    </mesh>}
    <group scale={furnScale} position={[0, deskLift, localZOffset]}><RoomObjectModel object={object} /></group>
    {(object.id === 'acousticGuitar' || object.id === 'electricGuitar') && guitarNotesMinutes > 0 && <group position={[0, 1.4, 0]}><Sparkles count={26} scale={[1.3, 1.7, 1.2]} size={2.5} speed={1.2} color="#ffd25a" /><Html center position={[0.35, 1.15, 0]} distanceFactor={8}><span className="text-2xl text-[#ffd25a] drop-shadow-[0_0_8px_#d6a447]">♪</span></Html></group>}
    {selected && <>
      {!object.wall && <mesh position={[0, baseY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[ring * 0.9, ring * 1.15, 40]} /><meshBasicMaterial color="#e6c34c" transparent opacity={0.85} /></mesh>}
      <Html center position={[0, object.wall ? 2.25 : baseY + 1.7, object.wall ? wallOffset : 0]} distanceFactor={9}><div className="rounded bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap">{label} · CLICK / ENTER</div></Html>
    </>}
  </group>;
}

/** A small foreground floor cluster (coiled cable, used mug, a couple of dropped lyric pages) that
 *  anchors the empty front-of-room space and adds a trace of daily life. Pure decoration — no collision. */
function ForegroundClutter() {
  const tex = contactShadowTexture();
  return <group position={[-1.5, 0, 2.1]}>
    {tex && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.1, 1.1, 1]}><planeGeometry args={[2, 2]} /><meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.7} /></mesh>}
    {/* coiled cable */}
    <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[0.28, 0.05, 8, 20]} /><meshStandardMaterial color="#1a1e26" roughness={0.85} /></mesh>
    <mesh position={[0.1, 0.07, 0.08]} rotation={[Math.PI / 2, 0.4, 0]}><torusGeometry args={[0.19, 0.045, 8, 18]} /><meshStandardMaterial color="#20242e" roughness={0.85} /></mesh>
    {/* dropped lyric pages */}
    <mesh position={[-0.5, 0.012, 0.32]} rotation={[-Math.PI / 2, 0, 0.35]} castShadow><planeGeometry args={[0.42, 0.56]} /><meshStandardMaterial color="#e7e1d5" roughness={0.95} side={THREE.DoubleSide} /></mesh>
    <mesh position={[-0.33, 0.014, 0.12]} rotation={[-Math.PI / 2, 0, -0.5]}><planeGeometry args={[0.4, 0.54]} /><meshStandardMaterial color="#d8d1c2" roughness={0.95} side={THREE.DoubleSide} /></mesh>
  </group>;
}

/** Desk lamp: a warm amber practical + its little articulated prop, at the desk's back-left corner. It
 *  gives the CREATION zone its own warm pool of light against the cool monitors (lighting hierarchy). */
function DeskLamp() {
  return <group position={[-2.05, 1.39, -4.0]}>
    <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.12, 0.14, 0.06, 16]} /><meshStandardMaterial color="#2a2f38" metalness={0.4} roughness={0.5} /></mesh>
    <mesh position={[0, 0.36, 0]} rotation={[0, 0, 0.16]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.68, 10]} /><meshStandardMaterial color="#3a3f46" metalness={0.5} /></mesh>
    <mesh position={[0.2, 0.66, 0.12]} rotation={[0.6, 0, 0.95]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.44, 10]} /><meshStandardMaterial color="#3a3f46" metalness={0.5} /></mesh>
    <mesh position={[0.38, 0.74, 0.28]} rotation={[1.05, 0, 0.5]} castShadow><coneGeometry args={[0.17, 0.22, 16, 1, true]} /><meshStandardMaterial color="#5a4632" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0.4, 0.68, 0.32]}><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffb45a" emissiveIntensity={2.2} toneMapped={false} /></mesh>
    <pointLight position={[0.5, 0.6, 0.5]} color="#ffb257" intensity={4.5} distance={5.2} />
  </group>;
}

function Room() {
  const setMoveTarget = useGameStore((state) => state.setMoveTarget);
  const activeLocationId = useGameStore((state) => state.activeLocationId);
  // Quantised to whole game-minutes: the light still eases smoothly but the room stops re-rendering every frame.
  const minute = useGameStore((state) => Math.floor(state.clock.minuteOfDay));
  const weather = useGameStore((state) => state.weather);
  const activeVideoId = useGameStore((state) => state.activeVideoId);
  const chapterCelebration = useGameStore((state) => state.phase === 'ending' && state.ending === 'finished');
  const { daylight, golden } = dayCycle(minute);
  const wet = weather === 'rain' || weather === 'hail';
  // Overcast weather pulls the outdoor contribution down without touching the room's own practical lights.
  const outdoor = daylight * (wet ? 0.55 : 1);
  const sky = new THREE.Color('#071024')
    .lerp(new THREE.Color('#8dc7e5'), daylight)
    .lerp(new THREE.Color('#e08f4c'), golden * (0.15 + daylight * 0.45)) // warm, but the sky only floods once the sun is actually up
    .lerp(new THREE.Color(wet ? '#22364a' : weather === 'rainbow' ? '#7799b6' : '#000000'), weather === 'clear' ? 0 : wet ? 0.5 : 0.35)
    .lerp(new THREE.Color('#d879a8'), chapterCelebration ? 0.72 : 0)
    .getStyle();
  // Sunrise light arrives warm and turns neutral as the morning fills in.
  const sunColor = new THREE.Color('#9bb9ff').lerp(new THREE.Color('#ffb877'), golden).lerp(new THREE.Color('#fff1d0'), Math.max(0, daylight - golden)).getStyle();
  if (activeLocationId === 'elevator') return <ElevatorCar />;
  if (activeLocationId === 'apartment-lobby') return <Lobby />;
  if (activeLocationId === 'apartment-rooftop') return <Rooftop />;
  // 'apartment-corridor' is the pre-hallway id kept so older saves still land somewhere sensible.
  if (activeLocationId === 'apartment-hallway' || activeLocationId === 'apartment-corridor') return <Hallway />;
  return <>
    <color attach="background" args={[sky]} /><fog attach="fog" args={[sky, 9 * ROOM_SCALE, 24 * ROOM_SCALE]} />
    <ambientLight intensity={chapterCelebration ? 1.15 : 0.55 + outdoor * 0.7} color={new THREE.Color('#7183ad').lerp(new THREE.Color('#e8a877'), golden).lerp(new THREE.Color('#b8dcf0'), Math.max(0, daylight - golden)).lerp(new THREE.Color('#ffd0e6'), chapterCelebration ? 0.8 : 0).getStyle()} /><directionalLight castShadow position={[3, 8, 4]} intensity={(chapterCelebration ? 2.8 : 1.5) + outdoor * 2.2} color={chapterCelebration ? '#ffb5d3' : sunColor} shadow-mapSize={[1024, 1024]} />
    <pointLight position={[-3, 4.2, -2]} intensity={activeVideoId === 'anime' ? 13 : 9} color={activeVideoId === 'anime' ? '#5e8fe8' : '#b73545'} distance={7} /><pointLight position={[2, 3.5, 1]} intensity={5} color={activeVideoId === 'anime' ? '#d26fa7' : '#d6a447'} distance={5} />
    {/* Soft red-tone wash for a warm nocturnal mood without washing out the blue night. */}
    <hemisphereLight args={['#3a2530', '#0c1018', 0.4]} />
    <pointLight position={[4, 3, 4]} intensity={chapterCelebration ? 8 : 3.4} color={chapterCelebration ? '#ff78b2' : '#c0394a'} distance={12} />
    <pointLight position={[-5, 2.4, 3]} intensity={2.6} color="#a8384a" distance={11} />
    {/* Warm bedside practical so the REST zone (bed, right side) stops reading as dead space. */}
    <pointLight position={[6.2, 1.2, -1.5]} intensity={3.4} color="#ff9a4a" distance={4.8} />
    {/* Soft cool top-fill over the central play area — lifts the dark character off the floor without
        flooding the room (kept local via a short distance and low intensity). */}
    <pointLight position={[0, 4.0, 1.4]} intensity={1.6} color="#8fa2c8" distance={7} />
    {/* The room shell scales with the layout so the enlarged studio keeps its proportions and mood. */}
    <mesh receiveShadow position={[-0.25 * ROOM_SCALE, -0.08, 0]} onClick={(event) => { event.stopPropagation(); if (isDrag(event.nativeEvent)) return; setMoveTarget(toLogical(event.point.x, event.point.z)); }}><boxGeometry args={[14.5 * ROOM_SCALE, 0.16, 10 * ROOM_SCALE]} /><meshStandardMaterial color="#17263a" roughness={0.84} /></mesh>
    {/* Walls are translucent so they never block the view when the camera orbits (depthWrite off = no occlusion). */}
    <mesh position={[-0.25 * ROOM_SCALE, 3.1, -5 * ROOM_SCALE]}><boxGeometry args={[14.5 * ROOM_SCALE, 6.2, 0.18]} /><meshStandardMaterial color="#243146" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[-7.5 * ROOM_SCALE, 3.1, 0]}><boxGeometry args={[0.34, 6.2, 10.2 * ROOM_SCALE]} /><meshStandardMaterial color="#202c42" transparent opacity={0.16} depthWrite={false} /></mesh>
    {/* Right wall the closet and the bedside window are mounted against. */}
    <mesh position={[7 * ROOM_SCALE, 3.1, 0]}><boxGeometry args={[0.18, 6.2, 10 * ROOM_SCALE]} /><meshStandardMaterial color="#202c42" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[-0.25 * ROOM_SCALE, 6.15, 0]}><boxGeometry args={[14.5 * ROOM_SCALE, 0.12, 10 * ROOM_SCALE]} /><meshStandardMaterial color="#33507a" transparent opacity={0.22} depthWrite={false} /></mesh>
    {/* Weather stays outdoors: rain is drawn inside the window unit, never in the room volume. */}
    {STUDIO_OBJECTS.map((object) => <RoomObject key={object.id} object={object} />)}<ForegroundClutter /><DeskLamp /><Player /><Visitor /><Npc2 /><Npc3 /><CelebrationFX active={chapterCelebration} /><CameraRig />
  </>;
}

function CelebrationFX({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pieces = useMemo(() => Array.from({ length: 52 }, (_, i) => ({
    x: ((i * 17) % 100) / 100 * 11 - 5.5,
    y: 1.2 + ((i * 13) % 100) / 100 * 5.4,
    z: ((i * 29) % 100) / 100 * 7 - 3.5,
    color: ['#ff87b8', '#ffd34d', '#62cf86', '#8dc7e5'][i % 4],
    phase: i * 0.37,
  })), []);
  useFrame(({ clock }, delta) => {
    if (!group.current || !active) return;
    group.current.children.forEach((child, i) => {
      child.position.y -= delta * (0.18 + (i % 4) * 0.05);
      child.rotation.x += delta * (1.5 + i % 3);
      child.rotation.z += delta * (1 + i % 2);
      if (child.position.y < 0.25) child.position.y = 5.9 + Math.sin(clock.elapsedTime + pieces[i].phase) * 0.3;
    });
  });
  if (!active) return null;
  return <group ref={group}><pointLight position={[0, 2.5, 0]} color="#ff8fbe" intensity={7} distance={10} />{pieces.map((piece, i) => <mesh key={i} position={[piece.x, piece.y, piece.z]} rotation={[piece.phase, piece.phase * 0.5, 0]}><boxGeometry args={[0.09, 0.18, 0.035]} /><meshStandardMaterial color={piece.color} emissive={piece.color} emissiveIntensity={0.45} /></mesh>)}</group>;
}

/** The call-button panel shared by the lobby and (in fixed form) the elevator car. */
function ElevatorPanel({ onPress, label }: { onPress?: () => void; label?: string }) {
  return <group>
    <mesh><boxGeometry args={[0.26, 0.62, 0.06]} /><meshStandardMaterial color="#9c8459" metalness={0.3} roughness={0.4} /></mesh>
    <mesh position={[0, 0.14, 0.04]} onClick={onPress ? (event) => { event.stopPropagation(); onPress(); } : undefined}>
      <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} /><meshStandardMaterial color="#ffb457" emissive="#ff8c22" emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
    <mesh position={[0, -0.08, 0.04]}><cylinderGeometry args={[0.06, 0.06, 0.03, 16]} /><meshStandardMaterial color="#5b4a34" /></mesh>
    {label && <Html center position={[0, 0.62, 0]} distanceFactor={9}>
      <button type="button" onClick={onPress} className="pointer-events-auto rounded border border-paper/40 bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap hover:bg-ember/50">{label}</button>
    </Html>}
  </group>;
}

/**
 * Camera for the hallway and lobby. These rooms are a different size and shape from the studio, so
 * they get their own framing instead of inheriting the studio's orbit distances (which sit the camera
 * outside the walls). Still orbitable, just bounded to this room.
 */
function PlaceRig({ from, target, min, max }: { from: [number, number, number]; target: [number, number, number]; min: number; max: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const setCameraYaw = useGameStore((state) => state.setCameraYaw);
  useEffect(() => { camera.position.set(...from); }, [camera, from]);
  useFrame(() => { controls.current?.update(); const currentTarget = controls.current?.target; if (currentTarget) setCameraYaw(Math.atan2(camera.position.x - currentTarget.x, camera.position.z - currentTarget.z)); });
  return <OrbitControls ref={controls} makeDefault target={target} enablePan={false} minDistance={min} maxDistance={max} minPolarAngle={Math.PI * 0.16} maxPolarAngle={Math.PI * 0.46} enableDamping dampingFactor={0.12} />;
}

/** Camera fixed inside the car, close enough to read the interior and the doors. */
function ElevatorRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const setCameraYaw = useGameStore((state) => state.setCameraYaw);
  useEffect(() => { camera.position.set(0, 2.5, 2.25); }, [camera]);
  useFrame(() => { controls.current?.update(); const currentTarget = controls.current?.target; if (currentTarget) setCameraYaw(Math.atan2(camera.position.x - currentTarget.x, camera.position.z - currentTarget.z)); });
  return <OrbitControls ref={controls} makeDefault target={[0, 1.4, -2.0]} enablePan={false} minDistance={2.2} maxDistance={4.6} minPolarAngle={Math.PI * 0.18} maxPolarAngle={Math.PI * 0.56} enableDamping dampingFactor={0.12} />;
}

/**
 * Inside the car. Warm orange light, marble tile, brushed-metal walls and a big mirror on the wall the
 * rider faces — cosy and a little dated rather than modern or futuristic. The doors slide shut, the car
 * travels, a chime sounds and the doors part again; `tick` lands the producer on the destination floor.
 */
function ElevatorCar() {
  const arrivesAt = useGameStore((state) => state.elevatorArrivesAt);
  const traveling = useGameStore((state) => state.elevatorTo !== null);
  const doorL = useRef<THREE.Group>(null);
  const doorR = useRef<THREE.Group>(null);
  const dinged = useRef(false);
  useEffect(() => { dinged.current = false; }, [arrivesAt]);
  useFrame(() => {
    // While choosing a floor the car is stationary with its doors open; the ride only runs once a floor
    // is picked (`traveling`). Doors shut over the first second, stay shut, then part over the last.
    let closed = 0;
    if (traveling) {
      const remaining = arrivesAt - useGameStore.getState().elapsedMs;
      const elapsed = ELEVATOR_RIDE_MS - remaining;
      closed = Math.max(0, Math.min(1, elapsed / ELEVATOR_DOOR_MS)) * (remaining > ELEVATOR_DING_MS ? 1 : Math.max(0, remaining / ELEVATOR_DING_MS));
      if (!dinged.current && remaining <= ELEVATOR_DING_MS) { dinged.current = true; playElevatorDing(); }
    }
    if (doorL.current) doorL.current.position.x = -2.32 + closed * 1.2;
    if (doorR.current) doorR.current.position.x = 2.32 - closed * 1.2;
  });
  return <>
    <color attach="background" args={['#0d0905']} />
    <ambientLight intensity={0.8} color="#f0a860" />
    {/* Soft ceiling panel plus a warmer bounce off the rear wall. */}
    <pointLight position={[0, 3.0, 0]} color="#ffb066" intensity={16} distance={11} />
    <pointLight position={[0, 1.5, 2.0]} color="#e08a3c" intensity={6} distance={7} />
    <pointLight position={[0, 2.2, -1.4]} color="#ffc98a" intensity={9} distance={7} />
    {/* Marble tile floor: a pale slab with a checker of veined tiles laid over it. */}
    <mesh receiveShadow position={[0, -0.08, 0]}><boxGeometry args={[4.4, 0.16, 5.2]} /><meshStandardMaterial color="#d9d2c4" roughness={0.26} metalness={0.14} /></mesh>
    {Array.from({ length: 6 }).map((_, r) => Array.from({ length: 5 }).map((__, c) => (
      <mesh key={`t${r}-${c}`} position={[-1.76 + c * 0.88, 0.005, -2.2 + r * 0.88]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.82, 0.82]} /><meshStandardMaterial color={(r + c) % 2 ? '#c4baa7' : '#e8e2d5'} roughness={0.22} metalness={0.22} />
      </mesh>
    )))}
    {/* Brushed-metal side and rear walls with a vintage wood dado rail. */}
    <mesh position={[-2.26, 1.9, 0]}><boxGeometry args={[0.12, 3.8, 5.2]} /><meshStandardMaterial color="#9c9285" metalness={0.28} roughness={0.5} /></mesh>
    <mesh position={[2.26, 1.9, 0]}><boxGeometry args={[0.12, 3.8, 5.2]} /><meshStandardMaterial color="#9c9285" metalness={0.28} roughness={0.5} /></mesh>
    <mesh position={[0, 1.9, 2.6]}><boxGeometry args={[4.4, 3.8, 0.12]} /><meshStandardMaterial color="#8e8577" metalness={0.28} roughness={0.5} /></mesh>
    {[-2.18, 2.18].map((x) => <mesh key={x} position={[x, 1.0, 0]}><boxGeometry args={[0.07, 0.14, 5.1]} /><meshStandardMaterial color="#6b4b2c" roughness={0.6} /></mesh>)}
    <mesh position={[0, 1.0, 2.52]}><boxGeometry args={[4.3, 0.14, 0.07]} /><meshStandardMaterial color="#6b4b2c" roughness={0.6} /></mesh>
    {/* Brass handrail along the rear wall. */}
    <mesh position={[0, 1.28, 2.42]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 3.9, 12]} /><meshStandardMaterial color="#d0a559" metalness={0.35} roughness={0.35} /></mesh>
    {/* The mirror the rider faces, framed in warm brass. */}
    <mesh position={[0, 1.95, 2.5]}><boxGeometry args={[2.7, 2.2, 0.06]} /><meshStandardMaterial color="#b28a44" metalness={0.3} roughness={0.4} /></mesh>
    <mesh position={[0, 1.95, 2.45]}><planeGeometry args={[2.44, 1.94]} /><meshStandardMaterial color="#d4dfe4" metalness={0.2} roughness={0.08} emissive="#93a8b2" emissiveIntensity={0.42} /></mesh>
    {/* Ceiling with a glowing light panel. */}
    <mesh position={[0, 3.82, 0]}><boxGeometry args={[4.4, 0.12, 5.2]} /><meshStandardMaterial color="#4a3d2e" /></mesh>
    <mesh position={[0, 3.7, 0]}><boxGeometry args={[2.0, 0.07, 2.6]} /><meshStandardMaterial color="#ffd9a8" emissive="#ffb066" emissiveIntensity={1.6} toneMapped={false} /></mesh>
    {/* Sliding doors on the front face, with a lintel above them. */}
    <mesh position={[0, 3.56, -2.62]}><boxGeometry args={[4.5, 0.42, 0.14]} /><meshStandardMaterial color="#8a8175" metalness={0.25} roughness={0.55} /></mesh>
    <group ref={doorL} position={[-2.32, 1.7, -2.62]}><mesh><boxGeometry args={[2.24, 3.4, 0.1]} /><meshStandardMaterial color="#b0a596" metalness={0.25} roughness={0.42} /></mesh></group>
    <group ref={doorR} position={[2.32, 1.7, -2.62]}><mesh><boxGeometry args={[2.24, 3.4, 0.1]} /><meshStandardMaterial color="#b0a596" metalness={0.25} roughness={0.42} /></mesh></group>
    {/* Button panel on the side wall by the doors. */}
    <group position={[2.12, 1.5, -1.7]} rotation={[0, -Math.PI / 2, 0]}><ElevatorPanel /></group>
    <group position={[0, 0, -1.5]}><Player crystal={false} /></group>
    <ElevatorRig />
  </>;
}

/**
 * The studio-floor hallway. This is the original corridor, restored: the studio's own door on the
 * left, the elevator on the right. It is the landing between the room and the rest of the building —
 * Studio door → Hallway → Elevator → Lobby.
 */
function Hallway() {
  const returnToStudio = useGameStore((state) => state.returnToStudio);
  const enterElevator = useGameStore((state) => state.enterElevator);
  return <>
    <color attach="background" args={['#292018']} /><ambientLight intensity={0.72} color="#d58b52" /><pointLight position={[-1.8, 3.5, 1]} color="#f0a35b" intensity={10} distance={10} /><pointLight position={[2.8, 4.4, -2.5]} color="#ffd08a" intensity={7} distance={8} />
    <mesh receiveShadow position={[0, -0.08, 0]}><boxGeometry args={[9, 0.16, 12]} /><meshStandardMaterial color="#3b4149" roughness={0.82} /></mesh>
    {/* Walls use the same auto-clearing transparency as the studio: translucent with depthWrite off, so
        a wall between the camera and the player never blocks the view and restores as the camera moves. */}
    <mesh position={[0, 3, -4.5]}><boxGeometry args={[9, 6, 0.2]} /><meshStandardMaterial color="#50515a" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[-4.4, 3, 0]}><boxGeometry args={[0.2, 6, 12]} /><meshStandardMaterial color="#484b54" transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[4.4, 3, 0]}><boxGeometry args={[0.2, 6, 12]} /><meshStandardMaterial color="#484b54" transparent opacity={0.16} depthWrite={false} /></mesh>
    {/* Worn runner down the middle of the corridor. */}
    <mesh position={[0, 0.01, 0.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.6, 10]} /><meshStandardMaterial color="#6d4740" roughness={0.95} /></mesh>
    {/* Studio door on the left: distinct from the elevator, and always returns to the same room. */}
    <group position={[-2.4, 0, -4.25]}>
      <mesh position={[0, 1.8, 0]} castShadow onClick={(event) => { event.stopPropagation(); returnToStudio(); }}><boxGeometry args={[1.6, 3.6, 0.18]} /><meshStandardMaterial color="#b73545" /></mesh>
      <mesh position={[0.55, 1.5, 0.14]}><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#d6a447" metalness={0.6} /></mesh>
      <Html center position={[0, 3.8, 0]} distanceFactor={9}>
        <button type="button" onClick={returnToStudio} className="pointer-events-auto rounded border border-paper/40 bg-night/90 px-2 py-1 text-[10px] text-paper whitespace-nowrap hover:bg-ember/50">STUDIO · ENTER</button>
      </Html>
    </group>
    {/* Elevator on the right: down to the ground-floor lobby. */}
    <group position={[1.45, 0, -4.25]}>
      <mesh position={[0, 1.85, 0]} castShadow><boxGeometry args={[2.9, 3.7, 0.2]} /><meshStandardMaterial color="#20262f" metalness={0.35} roughness={0.5} /></mesh>
      <mesh position={[-0.74, 1.68, 0.12]}><boxGeometry args={[1.26, 3.35, 0.04]} /><meshStandardMaterial color="#8a939e" metalness={0.3} roughness={0.45} /></mesh>
      <mesh position={[0.74, 1.68, 0.12]}><boxGeometry args={[1.26, 3.35, 0.04]} /><meshStandardMaterial color="#8a939e" metalness={0.3} roughness={0.45} /></mesh>
      <group position={[1.78, 1.5, 0.15]}><ElevatorPanel onPress={enterElevator} label="ELEVATOR" /></group>
    </group>
    <Player /><PlaceRig from={HALLWAY_CAM} target={HALLWAY_TARGET} min={7} max={16} />
  </>;
}

/**
 * The ground-floor lobby of an older apartment block: terrazzo floor, a wall of brass mailboxes, a
 * radiator, a worn bench and a potted palm, with the street doors glowing at the far end. The
 * elevator is only how you get here — the lobby is its own space to walk around.
 */
function Lobby() {
  const enterElevator = useGameStore((state) => state.enterElevator);
  const chapter1Unlocked = useGameStore((state) => state.chapter1Unlocked);
  const openVideo = useGameStore((state) => state.openVideo);
  return <>
    <color attach="background" args={['#241b14']} />
    <ambientLight intensity={0.66} color="#d8955c" />
    <pointLight position={[-2.2, 3.6, 1.5]} color="#f0a35b" intensity={11} distance={12} />
    <pointLight position={[2.6, 4.2, -2.0]} color="#ffd08a" intensity={7} distance={9} />
    {/* Daylight spilling in from the street doors behind the camera-facing wall. */}
    <pointLight position={[0, 2.4, 5.4]} color="#cfe0f0" intensity={9} distance={12} />
    {/* Terrazzo floor: a warm slab with a scatter of paler chips. */}
    <mesh receiveShadow position={[0, -0.08, 0]}><boxGeometry args={[11, 0.16, 14]} /><meshStandardMaterial color="#9b8f7d" roughness={0.45} /></mesh>
    {Array.from({ length: 7 }).map((_, r) => Array.from({ length: 5 }).map((__, c) => (
      <mesh key={`f${r}-${c}`} position={[-4.2 + c * 2.1, 0.005, -5.4 + r * 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.0, 1.7]} /><meshStandardMaterial color={(r + c) % 2 ? '#8e836f' : '#a89b86'} roughness={0.42} />
      </mesh>
    )))}
    {/* Walls with a dark green dado and a cream upper, the way these buildings were painted. They use
        the same translucent-with-depthWrite-off treatment as the studio so they never block the camera. */}
    <mesh position={[0, 3.2, -5.2]}><boxGeometry args={[11, 6.4, 0.2]} /><meshStandardMaterial color="#cbbda4" roughness={0.9} transparent opacity={0.18} depthWrite={false} /></mesh>
    <mesh position={[0, 0.95, -5.05]}><boxGeometry args={[11, 1.9, 0.08]} /><meshStandardMaterial color="#3f5449" roughness={0.85} transparent opacity={0.18} depthWrite={false} /></mesh>
    <mesh position={[-5.4, 3.2, 0]}><boxGeometry args={[0.2, 6.4, 14]} /><meshStandardMaterial color="#c2b499" roughness={0.9} transparent opacity={0.18} depthWrite={false} /></mesh>
    <mesh position={[-5.25, 0.95, 0]}><boxGeometry args={[0.08, 1.9, 14]} /><meshStandardMaterial color="#3f5449" roughness={0.85} transparent opacity={0.18} depthWrite={false} /></mesh>
    <mesh position={[5.4, 3.2, 0]}><boxGeometry args={[0.2, 6.4, 14]} /><meshStandardMaterial color="#c2b499" roughness={0.9} transparent opacity={0.18} depthWrite={false} /></mesh>
    <mesh position={[5.25, 0.95, 0]}><boxGeometry args={[0.08, 1.9, 14]} /><meshStandardMaterial color="#3f5449" roughness={0.85} transparent opacity={0.18} depthWrite={false} /></mesh>
    {/* Street doors at the far end: dark frames with panes lit from outside. */}
    <group position={[0, 0, 6.6]}>
      <mesh position={[0, 2.3, 0]}><boxGeometry args={[4.4, 4.6, 0.2]} /><meshStandardMaterial color="#33291f" roughness={0.7} /></mesh>
      {[-1.0, 1.0].map((dx) => (
        <mesh key={dx} position={[dx, 1.9, -0.12]}><planeGeometry args={[1.7, 3.4]} /><meshStandardMaterial color="#a9c4da" emissive="#8fb3d0" emissiveIntensity={0.75} toneMapped={false} /></mesh>
      ))}
      <mesh position={[0, 1.9, -0.14]}><boxGeometry args={[0.16, 3.5, 0.06]} /><meshStandardMaterial color="#33291f" /></mesh>
      {[-0.28, 0.28].map((dx) => <mesh key={`h${dx}`} position={[dx, 1.5, -0.2]}><cylinderGeometry args={[0.035, 0.035, 0.7, 10]} /><meshStandardMaterial color="#c79a4e" metalness={0.4} roughness={0.35} /></mesh>)}
    </group>
    {/* Chapter 2 gateway: unlocked by the Chapter 1 ending, but intentionally still a Coming Soon door. */}
    <group position={[-3.0, 0, 6.52]} onClick={(event) => { event.stopPropagation(); if (chapter1Unlocked) openVideo('greenhouse'); }}>
      <mesh position={[0, 2.3, 0.04]}><boxGeometry args={[1.9, 4.6, 0.2]} /><meshStandardMaterial color={chapter1Unlocked ? '#5e3751' : '#33291f'} roughness={0.7} /></mesh>
      <mesh position={[0, 2.0, -0.1]}><planeGeometry args={[1.45, 3.5]} /><meshStandardMaterial color={chapter1Unlocked ? '#d487aa' : '#5c554d'} emissive={chapter1Unlocked ? '#c75d91' : '#000000'} emissiveIntensity={chapter1Unlocked ? 0.55 : 0} /></mesh>
      <Html center position={[0, 4.9, 0]} distanceFactor={9}><span className={`rounded border px-2 py-1 text-[10px] whitespace-nowrap ${chapter1Unlocked ? 'border-[#ffb7d4]/70 bg-[#321b38]/90 text-[#ffb7d4]' : 'border-paper/25 bg-night/80 text-paper/55'}`}>{chapter1Unlocked ? 'NEW CHAPTER UNLOCKED · GREENHOUSE' : 'GREENHOUSE · COMING SOON'}</span></Html>
    </group>
    {/* Wall of brass mailboxes — the signature of an old apartment lobby. */}
    <group position={[-5.05, 0, 0.6]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 1.65, 0]}><boxGeometry args={[4.2, 1.9, 0.22]} /><meshStandardMaterial color="#6b5636" roughness={0.55} /></mesh>
      {Array.from({ length: 4 }).map((_, r) => Array.from({ length: 8 }).map((__, c) => (
        <mesh key={`m${r}-${c}`} position={[-1.85 + c * 0.53, 2.32 - r * 0.44, 0.13]}>
          <boxGeometry args={[0.46, 0.37, 0.05]} /><meshStandardMaterial color={(r * 8 + c) % 5 === 0 ? '#b8933f' : '#a8873c'} metalness={0.35} roughness={0.42} />
        </mesh>
      )))}
    </group>
    {/* Cast-iron radiator, a worn bench and a potted palm. */}
    <group position={[4.9, 0, 1.8]}>
      {Array.from({ length: 9 }).map((_, i) => <mesh key={i} position={[0, 0.55, -1.0 + i * 0.25]}><boxGeometry args={[0.22, 1.0, 0.16]} /><meshStandardMaterial color="#b8ac97" roughness={0.7} /></mesh>)}
    </group>
    <group position={[-3.4, 0, 2.9]}>
      <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[2.4, 0.16, 0.7]} /><meshStandardMaterial color="#6b4b2c" roughness={0.8} /></mesh>
      {[-1.0, 1.0].map((lx) => <mesh key={lx} position={[lx, 0.19, 0]}><boxGeometry args={[0.16, 0.38, 0.6]} /><meshStandardMaterial color="#4d361f" roughness={0.85} /></mesh>)}
      <mesh position={[0, 0.86, -0.28]}><boxGeometry args={[2.4, 0.66, 0.12]} /><meshStandardMaterial color="#6b4b2c" roughness={0.8} /></mesh>
    </group>
    <group position={[3.4, 0, 4.0]}>
      <mesh position={[0, 0.36, 0]} castShadow><cylinderGeometry args={[0.42, 0.34, 0.72, 14]} /><meshStandardMaterial color="#9a5a3a" roughness={0.8} /></mesh>
      {[0, 1.2, 2.4, 3.6, 4.8].map((a, i) => (
        <mesh key={a} position={[Math.cos(a) * 0.36, 1.1 + (i % 2) * 0.22, Math.sin(a) * 0.36]} rotation={[Math.cos(a) * 0.5, a, Math.sin(a) * 0.5]}>
          <boxGeometry args={[0.12, 1.1, 0.5]} /><meshStandardMaterial color="#3f6b4a" roughness={0.9} />
        </mesh>
      ))}
    </group>
    {/* The elevator: the one way back up to the studio floor. */}
    <group position={[1.6, 0, -5.0]}>
      <mesh position={[0, 1.95, 0]} castShadow><boxGeometry args={[3.0, 3.9, 0.24]} /><meshStandardMaterial color="#4a3a28" roughness={0.6} /></mesh>
      <mesh position={[-0.76, 1.7, 0.14]}><boxGeometry args={[1.3, 3.35, 0.05]} /><meshStandardMaterial color="#9a8a6a" metalness={0.32} roughness={0.45} /></mesh>
      <mesh position={[0.76, 1.7, 0.14]}><boxGeometry args={[1.3, 3.35, 0.05]} /><meshStandardMaterial color="#9a8a6a" metalness={0.32} roughness={0.45} /></mesh>
      {/* Floor-indicator dial above the doors. */}
      <mesh position={[0, 3.66, 0.16]}><boxGeometry args={[0.9, 0.34, 0.06]} /><meshStandardMaterial color="#2b2118" /></mesh>
      <mesh position={[0, 3.66, 0.2]}><planeGeometry args={[0.74, 0.2]} /><meshStandardMaterial color="#ffb457" emissive="#ff8c22" emissiveIntensity={1.3} toneMapped={false} /></mesh>
      <group position={[1.85, 1.4, 0.16]}><ElevatorPanel onPress={enterElevator} label="ELEVATOR" /></group>
    </group>
    <Player /><PlaceRig from={LOBBY_CAM} target={LOBBY_TARGET} min={8} max={19} />
  </>;
}

/**
 * The rooftop — a new explorable floor reached only by the elevator. It is genuinely outdoors, so it
 * shares the same world as the windows: one sun / moon driven by the same `dayCycle`, the same weather
 * and time of day. Parapet on all sides, a water tank, roof vents, a string of festoon lights and the
 * elevator head-house you arrived through.
 */
function Rooftop() {
  const enterElevator = useGameStore((state) => state.enterElevator);
  const minute = useGameStore((state) => Math.floor(state.clock.minuteOfDay));
  const weather = useGameStore((state) => state.weather);
  const { daylight, golden, sunProgress } = dayCycle(minute);
  const wet = weather === 'rain' || weather === 'hail';
  const sky = new THREE.Color('#0a1430')
    .lerp(new THREE.Color('#8ec6e6'), daylight)
    .lerp(new THREE.Color('#e79a54'), golden * (0.2 + daylight * 0.5))
    .lerp(new THREE.Color(wet ? '#33485d' : weather === 'rainbow' ? '#7799b6' : '#0a1430'), weather === 'clear' ? 0 : wet ? 0.5 : 0.3)
    .getStyle();
  // The single shared sun climbs from the 4:30 AM horizon exactly as it does in the window.
  const sunX = -7 + sunProgress * 14;
  const sunY = 1.4 + sunProgress * 6.5;
  const sunColor = golden > 0.2 ? '#ff8c3a' : '#ffd98a';
  return <>
    <color attach="background" args={[sky]} /><fog attach="fog" args={[sky, 14, 40]} />
    <ambientLight intensity={0.5 + daylight * 0.8} color={new THREE.Color('#6a80b0').lerp(new THREE.Color('#ffdca8'), golden).lerp(new THREE.Color('#bcd8ef'), Math.max(0, daylight - golden)).getStyle()} />
    <directionalLight castShadow position={[sunX, sunY + 1, -6]} intensity={0.6 + daylight * 2.4} color={new THREE.Color('#9bb9ff').lerp(new THREE.Color('#ffb877'), golden).lerp(new THREE.Color('#fff1d0'), Math.max(0, daylight - golden)).getStyle()} />
    {/* One sun, high and far beyond the parapet; it never enters the deck. Blooms. */}
    {daylight > 0.02 && <mesh position={[sunX, sunY, -13]}><sphereGeometry args={[0.7 + daylight * 0.35, 20, 16]} /><meshStandardMaterial color={sunColor} emissive={sunColor} emissiveIntensity={(3 + daylight * 2) * (wet ? 0.45 : 1)} toneMapped={false} /></mesh>}
    {/* The moon takes the sky at night, opposite the sun. */}
    {daylight < 0.35 && <mesh position={[4.5, 6.2, -13]}><sphereGeometry args={[0.5, 18, 14]} /><meshStandardMaterial color="#e8ecf5" emissive="#cfd8ec" emissiveIntensity={1.4} toneMapped={false} /></mesh>}
    {daylight < 0.4 && <group position={[0, 5, -12]}><Sparkles count={80} scale={[26, 9, 3]} size={2.4} speed={0.25} color="#dfe8ff" /></group>}
    {wet && <group position={[0, 4, -6]}><Sparkles count={weather === 'hail' ? 120 : 90} scale={[24, 9, 10]} size={weather === 'hail' ? 2.2 : 1.0} speed={weather === 'hail' ? 3 : 1.9} color={weather === 'hail' ? '#eaf6ff' : '#a6d4f7'} /></group>}
    {/* Distant city skyline silhouette beyond the parapet. */}
    {Array.from({ length: 16 }).map((_, i) => (
      <mesh key={`sk${i}`} position={[-11 + i * 1.5, 0.5 + (i % 4) * 0.8, -10.5]}><boxGeometry args={[1.2, 2 + (i % 4) * 1.6, 0.6]} /><meshStandardMaterial color="#161f38" emissive="#26406a" emissiveIntensity={daylight < 0.4 ? 0.5 : 0.1} /></mesh>
    ))}
    {/* Rooftop deck. */}
    <mesh receiveShadow position={[0, -0.08, 0]} rotation={[0, 0, 0]}><boxGeometry args={[13, 0.16, 12]} /><meshStandardMaterial color="#3a3d44" roughness={0.92} /></mesh>
    {Array.from({ length: 6 }).map((_, i) => <mesh key={`seam${i}`} position={[-5 + i * 2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.05, 11.5]} /><meshStandardMaterial color="#2a2d33" /></mesh>)}
    {/* Parapet wall running the four edges (kept low so it never blocks the camera). */}
    <mesh position={[0, 0.55, -5.9]}><boxGeometry args={[13, 1.1, 0.3]} /><meshStandardMaterial color="#4a4e57" roughness={0.85} /></mesh>
    <mesh position={[-6.4, 0.55, 0]}><boxGeometry args={[0.3, 1.1, 12]} /><meshStandardMaterial color="#4a4e57" roughness={0.85} /></mesh>
    <mesh position={[6.4, 0.55, 0]}><boxGeometry args={[0.3, 1.1, 12]} /><meshStandardMaterial color="#4a4e57" roughness={0.85} /></mesh>
    <mesh position={[0, 0.55, 5.9]}><boxGeometry args={[13, 1.1, 0.3]} /><meshStandardMaterial color="#4a4e57" roughness={0.85} /></mesh>
    {/* Water tank on stilts. */}
    <group position={[-4.2, 0, -3.6]}>
      <mesh position={[0, 2.4, 0]} castShadow><cylinderGeometry args={[1.05, 1.05, 1.6, 16]} /><meshStandardMaterial color="#6b5136" roughness={0.8} /></mesh>
      <mesh position={[0, 3.35, 0]}><coneGeometry args={[1.15, 0.6, 16]} /><meshStandardMaterial color="#4a3a28" roughness={0.8} /></mesh>
      {[[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([lx, lz], i) => <mesh key={i} position={[lx, 0.8, lz]}><boxGeometry args={[0.12, 1.6, 0.12]} /><meshStandardMaterial color="#2f3641" metalness={0.4} /></mesh>)}
    </group>
    {/* A couple of roof vents / AC units. */}
    <mesh position={[3.6, 0.42, 2.6]} castShadow><boxGeometry args={[1.4, 0.9, 1.1]} /><meshStandardMaterial color="#8b9099" metalness={0.5} roughness={0.5} /></mesh>
    <mesh position={[3.6, 0.92, 2.6]}><cylinderGeometry args={[0.35, 0.35, 0.14, 16]} /><meshStandardMaterial color="#2b2f36" /></mesh>
    <mesh position={[-2.4, 0.3, 3.4]} castShadow><boxGeometry args={[0.8, 0.6, 0.8]} /><meshStandardMaterial color="#5a5f68" metalness={0.4} roughness={0.6} /></mesh>
    {/* Festoon string lights between the tank and the head-house. */}
    {Array.from({ length: 8 }).map((_, i) => <mesh key={`fl${i}`} position={[-3.6 + i * 0.9, 2.4 - Math.sin((i / 7) * Math.PI) * 0.5, -1.5]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffdca0" emissive="#ffbe63" emissiveIntensity={1.6} toneMapped={false} /></mesh>)}
    {/* Elevator head-house: the way back down. */}
    <group position={[2.2, 0, -4.6]}>
      <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[2.6, 3.0, 1.6]} /><meshStandardMaterial color="#3c4049" roughness={0.8} /></mesh>
      <mesh position={[-0.62, 1.4, 0.82]}><boxGeometry args={[1.02, 2.4, 0.06]} /><meshStandardMaterial color="#8a939e" metalness={0.3} roughness={0.45} /></mesh>
      <mesh position={[0.62, 1.4, 0.82]}><boxGeometry args={[1.02, 2.4, 0.06]} /><meshStandardMaterial color="#8a939e" metalness={0.3} roughness={0.45} /></mesh>
      <group position={[1.5, 1.35, 0.82]}><ElevatorPanel onPress={enterElevator} label="ELEVATOR" /></group>
    </group>
    <Player /><PlaceRig from={ROOFTOP_CAM} target={ROOFTOP_TARGET} min={8} max={22} />
  </>;
}

export function ThreeStudio() {
  return <div className="absolute inset-0"><Canvas shadows camera={{ position: [7.8 * ROOM_SCALE, 8.6 * ROOM_SCALE, 9.5 * ROOM_SCALE], fov: 48 }} style={{ width: '100%', height: '100%' }} onPointerDown={(event) => { pointerDownAt = { x: event.clientX, y: event.clientY }; }}>
    <Room />
    {/* Bloom only catches bright emissives — screens, LEDs, the crystal — per the Art Bible's "only emissives bloom" rule. */}
    <EffectComposer>
      <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.85} intensity={0.7} mipmapBlur />
    </EffectComposer>
  </Canvas></div>;
}
