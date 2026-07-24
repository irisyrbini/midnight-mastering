'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import type { StudioObject } from '@/data/studio-layout';
import { useGameStore } from '@/store/game-store';
import { dayCycle } from '@/game/simulation/day-cycle';
import type { CrystalState } from '@/types/game';

/** A real waisted guitar-body outline (figure-8 with a concave waist), extruded thin so it reads as a guitar. */
const GUITAR_SHAPE = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.7);
  s.bezierCurveTo(0.45, -0.72, 0.56, -0.4, 0.5, -0.12);
  s.bezierCurveTo(0.46, 0.06, 0.3, 0.04, 0.27, 0.16);
  s.bezierCurveTo(0.25, 0.26, 0.33, 0.32, 0.4, 0.42);
  s.bezierCurveTo(0.5, 0.58, 0.34, 0.74, 0, 0.74);
  s.bezierCurveTo(-0.34, 0.74, -0.5, 0.58, -0.4, 0.42);
  s.bezierCurveTo(-0.33, 0.32, -0.25, 0.26, -0.27, 0.16);
  s.bezierCurveTo(-0.3, 0.04, -0.46, 0.06, -0.5, -0.12);
  s.bezierCurveTo(-0.56, -0.4, -0.45, -0.72, 0, -0.7);
  return s;
})();
const GUITAR_EXTRUDE = { depth: 0.15, bevelEnabled: false };

/**
 * Recognizable primitive models for each studio object, keyed by id.
 * Positions/sizes come from src/data/studio-layout.ts and are NOT changed here — only how each object is drawn.
 * Desk gear renders on a shared surface height so it reads as sitting on the desk (see docs/LevelDesign.md).
 */
export const DESK_Y = 1.2;
export const DESKTOP_IDS = new Set([
  'dualMonitors', 'laptop', 'studioMonitors', 'audioInterface', 'lyricNotebook', 'ashtray', 'cigarettes', 'vodka', 'redBull', 'pillBottle', 'mic', 'phone',
]);

/** Second table: synths/keyboards (every instrument except the guitars) sit on this surface. */
export const TABLE2_Y = 1.0;
export const TABLE_IDS = new Set(['modularSynths', 'portasound', 'sk5']);

function Bottle({ color, height = 1.0, cap = '#d8d2c4' }: { color: string; height?: number; cap?: string }) {
  return <group position={[0, DESK_Y, 0]}>
    <mesh position={[0, height * 0.33, 0]} castShadow><cylinderGeometry args={[0.14, 0.15, height * 0.66, 16]} /><meshStandardMaterial color={color} transparent opacity={0.82} roughness={0.15} /></mesh>
    <mesh position={[0, height * 0.75, 0]}><cylinderGeometry args={[0.055, 0.12, height * 0.28, 16]} /><meshStandardMaterial color={color} transparent opacity={0.82} /></mesh>
    <mesh position={[0, height * 0.9, 0]}><cylinderGeometry args={[0.055, 0.055, 0.09, 12]} /><meshStandardMaterial color={cap} /></mesh>
    <mesh position={[0, height * 0.34, 0.15]}><planeGeometry args={[0.18, 0.28]} /><meshStandardMaterial color="#e7e1d5" /></mesh>
  </group>;
}

function KeyStrip({ y, width }: { y: number; width: number }) {
  const count = Math.max(6, Math.floor(width / 0.13));
  return <group position={[0, y, 0.12]}>
    <mesh castShadow><boxGeometry args={[width, 0.03, 0.22]} /><meshStandardMaterial color="#f4f1e8" /></mesh>
    {Array.from({ length: count }).map((_, i) => (i % 7 === 2 || i % 7 === 4 || i % 7 === 6) ? null : <mesh key={i} position={[-width / 2 + 0.07 + i * (width / count), 0.025, -0.03]}><boxGeometry args={[0.05, 0.03, 0.13]} /><meshStandardMaterial color="#15151b" /></mesh>)}
  </group>;
}

function KnobGrid({ rows, cols, width, height }: { rows: number; cols: number; width: number; height: number }) {
  const items = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) items.push(
    <mesh key={`${r}-${c}`} position={[-width / 2 + (c + 0.5) * (width / cols), height / 2 - (r + 0.5) * (height / rows), 0.05]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.035, 0.035, 0.06, 8]} />
      <meshStandardMaterial color={(r + c) % 3 === 0 ? '#d6a447' : '#c9c4b8'} emissive={(r + c) % 4 === 0 ? '#4f8f9c' : '#000000'} emissiveIntensity={0.6} />
    </mesh>,
  );
  return <>{items}</>;
}

/** Extruded guitar with a real waisted body, sound hole / pickguard, neck, fretboard and headstock. */
function Guitar({ body, solid }: { body: string; solid?: boolean }) {
  return <group rotation={[0.16, 0, 0.08]}>
    <mesh position={[0, 0.78, -0.075]} castShadow><extrudeGeometry args={[GUITAR_SHAPE, GUITAR_EXTRUDE]} /><meshStandardMaterial color={body} roughness={solid ? 0.4 : 0.55} /></mesh>
    {!solid
      ? <mesh position={[0, 0.7, 0.085]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.05, 20]} /><meshStandardMaterial color="#160f0a" /></mesh>
      : <mesh position={[0.13, 0.62, 0.085]} rotation={[0, 0, 0.35]}><boxGeometry args={[0.26, 0.42, 0.02]} /><meshStandardMaterial color="#15151b" /></mesh>}
    <mesh position={[0, 1.62, 0]} castShadow><boxGeometry args={[0.1, 1.1, 0.07]} /><meshStandardMaterial color="#2a2019" /></mesh>
    <mesh position={[0, 1.62, 0.04]}><boxGeometry args={[0.08, 1.08, 0.02]} /><meshStandardMaterial color="#15100b" /></mesh>
    <mesh position={[0, 2.2, 0]}><boxGeometry args={[0.16, 0.3, 0.05]} /><meshStandardMaterial color="#15100b" /></mesh>
  </group>;
}

function Door({ color }: { color: string }) {
  return <group>
    <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.25, 2.4, 0.14]} /><meshStandardMaterial color="#2a2f38" /></mesh>
    <mesh position={[0, 1.2, 0.06]}><boxGeometry args={[1.0, 2.15, 0.08]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0.38, 1.12, 0.12]}><sphereGeometry args={[0.06, 12, 12]} /><meshStandardMaterial color="#d6a447" metalness={0.6} /></mesh>
  </group>;
}

/** LED strip that recolours with the emotional crystal (red → yellow → green). */
const CRYSTAL_GLOW: Record<CrystalState, string> = { red: '#ff4d5e', yellow: '#ffd24a', green: '#5fe08a' };
function LedStrip() {
  const crystal = useGameStore((state) => state.crystal);
  const color = CRYSTAL_GLOW[crystal];
  return <group position={[0, 3.8, 0]}>
    <mesh><boxGeometry args={[3.8, 0.1, 0.1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} toneMapped={false} /></mesh>
    <pointLight color={color} intensity={3.4} distance={6} />
  </group>;
}

/** Wardrobe with two overlapping panels on top/bottom tracks — a sliding-door closet. */
function SlidingCloset() {
  return <group>
    <mesh position={[0, 1.25, -0.14]} castShadow><boxGeometry args={[1.5, 2.5, 0.5]} /><meshStandardMaterial color="#3a4152" /></mesh>
    <mesh position={[0, 2.5, 0.13]}><boxGeometry args={[1.52, 0.06, 0.12]} /><meshStandardMaterial color="#20242c" /></mesh>
    <mesh position={[0, 0.06, 0.13]}><boxGeometry args={[1.52, 0.06, 0.12]} /><meshStandardMaterial color="#20242c" /></mesh>
    <mesh position={[-0.36, 1.28, 0.15]}><boxGeometry args={[0.78, 2.34, 0.05]} /><meshStandardMaterial color="#4a5568" metalness={0.2} roughness={0.6} /></mesh>
    <mesh position={[0.38, 1.28, 0.2]}><boxGeometry args={[0.78, 2.34, 0.05]} /><meshStandardMaterial color="#54617a" metalness={0.2} roughness={0.6} /></mesh>
    <mesh position={[-0.03, 1.28, 0.18]}><boxGeometry args={[0.03, 1.3, 0.05]} /><meshStandardMaterial color="#181c24" /></mesh>
    <mesh position={[0.03, 1.28, 0.23]}><boxGeometry args={[0.03, 1.3, 0.05]} /><meshStandardMaterial color="#181c24" /></mesh>
  </group>;
}

/** Mini fridge: the door swings open and a warm orange interior light glows while `fridgeOpen`. */
function Fridge() {
  const open = useGameStore((state) => state.fridgeOpen);
  const door = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (door.current) door.current.rotation.y += ((open ? -Math.PI * 0.6 : 0) - door.current.rotation.y) * 0.16;
    if (glow.current) glow.current.intensity += ((open ? 6 : 0) - glow.current.intensity) * 0.18;
  });
  return <group>
    {/* cabinet + dark interior */}
    <mesh position={[0, 0.7, -0.02]} castShadow><boxGeometry args={[0.9, 1.4, 0.8]} /><meshStandardMaterial color="#a8aeb6" metalness={0.3} roughness={0.4} /></mesh>
    <mesh position={[0, 0.7, 0.18]}><boxGeometry args={[0.78, 1.24, 0.5]} /><meshStandardMaterial color="#161a1e" /></mesh>
    {/* interior shelf + a row of beer bottles (amber glass, yellow liquid), lit orange when open */}
    <mesh position={[0, 0.98, 0.2]}><boxGeometry args={[0.7, 0.03, 0.42]} /><meshStandardMaterial color="#2a2f34" /></mesh>
    {[-0.22, -0.07, 0.08, 0.23].map((bx, i) => <group key={i} position={[bx, 0.55, 0.2]}>
      <mesh><cylinderGeometry args={[0.055, 0.055, 0.3, 12]} /><meshStandardMaterial color="#6b4a10" transparent opacity={0.85} roughness={0.25} /></mesh>
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.05, 0.05, 0.22, 12]} /><meshStandardMaterial color="#e8c74a" emissive="#8a6a12" emissiveIntensity={0.35} /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.02, 0.045, 0.1, 10]} /><meshStandardMaterial color="#5a3f10" /></mesh>
    </group>)}
    {[-0.15, 0.1].map((bx, i) => <group key={`t${i}`} position={[bx, 1.12, 0.2]}>
      <mesh><cylinderGeometry args={[0.055, 0.055, 0.3, 12]} /><meshStandardMaterial color="#6b4a10" transparent opacity={0.85} roughness={0.25} /></mesh>
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.05, 0.05, 0.22, 12]} /><meshStandardMaterial color="#e8c74a" emissive="#8a6a12" emissiveIntensity={0.35} /></mesh>
    </group>)}
    <pointLight ref={glow} position={[0, 0.75, 0.34]} color="#ff8a2a" intensity={0} distance={2.4} />
    {/* hinged door on the left, opaque metal */}
    <group ref={door} position={[-0.45, 0.7, 0.42]}>
      <mesh position={[0.45, 0, 0]} castShadow><boxGeometry args={[0.9, 1.36, 0.08]} /><meshStandardMaterial color="#b9bfc6" metalness={0.35} roughness={0.4} /></mesh>
      <mesh position={[0.8, 0.1, 0.06]}><boxGeometry args={[0.05, 0.4, 0.05]} /><meshStandardMaterial color="#3a3f46" metalness={0.5} /></mesh>
    </group>
  </group>;
}

/** Entrance door: swings open when `entranceOpen`, goes translucent while open, and auto-closes after a while. */
const ENTRANCE_AUTOCLOSE_MS = 5000;
function EntranceDoor() {
  const open = useGameStore((state) => state.entranceOpen);
  const setEntranceOpen = useGameStore((state) => state.setEntranceOpen);
  const leaf = useRef<THREE.Group>(null);
  const leafMat = useRef<THREE.MeshStandardMaterial>(null);
  // Auto-close a while after opening.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setEntranceOpen(false), ENTRANCE_AUTOCLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, setEntranceOpen]);
  useFrame(() => {
    if (leaf.current) {
      const target = open ? -Math.PI * 0.62 : 0;
      leaf.current.rotation.y += (target - leaf.current.rotation.y) * 0.16;
    }
    if (leafMat.current) {
      const target = open ? 0.28 : 1; // fade the open door to translucent
      leafMat.current.opacity += (target - leafMat.current.opacity) * 0.16;
    }
  });
  return <group>
    <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.25, 2.4, 0.14]} /><meshStandardMaterial color="#2a2f38" /></mesh>
    <mesh position={[0, 1.2, -0.05]}><planeGeometry args={[1.02, 2.16]} /><meshStandardMaterial color="#05070c" /></mesh>
    <group ref={leaf} position={[-0.52, 1.2, 0.06]}>
      <mesh position={[0.5, 0, 0]} castShadow><boxGeometry args={[1.0, 2.15, 0.08]} /><meshStandardMaterial ref={leafMat} color="#b73545" transparent opacity={1} /></mesh>
      <mesh position={[0.9, -0.08, 0.06]}><sphereGeometry args={[0.06, 12, 12]} /><meshStandardMaterial color="#d6a447" metalness={0.6} transparent /></mesh>
    </group>
  </group>;
}

/** Night window with a starfield; its glass pane tilts open (awning-style) while `windowOpen`. */
/**
 * Rain seen through the glass. Straight vertical streaks, recycled inside the window opening only —
 * the curtain is a thin slab clipped to the pane, so nothing ever falls into the room.
 */
function RainCurtain({ hail }: { hail: boolean }) {
  const group = useRef<THREE.Group>(null);
  const drops = useMemo(() => Array.from({ length: hail ? 46 : 70 }, () => ({
    x: (Math.random() - 0.5) * 3.3,
    y: (Math.random() - 0.5) * 2.15,
    speed: (hail ? 3.6 : 2.4) + Math.random() * (hail ? 1.8 : 1.4),
    length: hail ? 0.05 + Math.random() * 0.04 : 0.15 + Math.random() * 0.24,
  })), [hail]);
  useFrame((_, delta) => {
    const meshes = group.current?.children;
    if (!meshes) return;
    for (let i = 0; i < drops.length; i += 1) {
      const drop = drops[i];
      drop.y -= drop.speed * delta;
      if (drop.y < -1.1) { drop.y = 1.1; drop.x = (Math.random() - 0.5) * 3.3; } // recycle at the top
      meshes[i].position.set(drop.x, drop.y, -0.005);
    }
  });
  return <group ref={group}>
    {drops.map((drop, index) => <mesh key={index} position={[drop.x, drop.y, -0.005]}>
      <boxGeometry args={[hail ? 0.04 : 0.018, drop.length, 0.01]} />
      <meshBasicMaterial color={hail ? '#eaf6ff' : '#a6d4f7'} transparent opacity={hail ? 0.85 : 0.5} />
    </mesh>)}
  </group>;
}

/**
 * A window onto the shared outdoor world. Both windows call this, driven by the same `dayCycle` +
 * `weather`, so they always show the exact same sky, time and weather — the second window is just
 * another viewpoint, not a separate environment.
 *
 * `celestial` decides whether this window draws the sun/moon disc. Only ONE window (the main one) does,
 * so there is never a second sun. Every disc and layer is recessed **behind the front frame face**
 * (all z ≤ 0), so the sun/moon can never clip through the glass into the room — sunlight enters, the
 * sun itself stays outside.
 */
function WindowUnit({ width = 3.8, celestial = true }: { width?: number; celestial?: boolean }) {
  const open = useGameStore((state) => state.windowOpen);
  const minute = useGameStore((state) => Math.floor(state.clock.minuteOfDay));
  const weather = useGameStore((state) => state.weather);
  const pane = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Group>(null);
  const { daylight, golden, sunProgress } = dayCycle(minute);
  const wet = weather === 'rain' || weather === 'hail';
  // Night → day, warmed through the golden hour, then dulled and darkened while it rains.
  const sky = new THREE.Color('#09142b')
    .lerp(new THREE.Color('#91cde7'), daylight)
    .lerp(new THREE.Color('#e79a54'), golden * 0.5)
    .lerp(new THREE.Color(wet ? '#2b3d4f' : '#0b1426'), weather === 'clear' ? 0 : wet ? 0.45 : 0.32)
    .getStyle();
  useFrame((_, delta) => {
    if (pane.current) pane.current.rotation.x += ((open ? -0.5 : 0) - pane.current.rotation.x) * 0.14;
    if (clouds.current) { clouds.current.position.x = ((clouds.current.position.x + delta * 0.08 + 2) % 4) - 2; } // slow drift, wrapped
  });
  return <group position={[0, 2.2, 0]}>
    <mesh><boxGeometry args={[width, 2.6, 0.12]} /><meshStandardMaterial color="#2a3a4d" /></mesh>
    {/* Sky backdrop recessed to the back of the frame opening. */}
    <mesh position={[0, 0, -0.05]}><planeGeometry args={[width - 0.3, 2.25]} /><meshStandardMaterial color={sky} emissive={sky} emissiveIntensity={(open ? 0.9 : 0.45) * (wet ? 0.7 : 1)} toneMapped={false} /></mesh>
    {/* Everything below is inside the opening (z ≤ 0), so nothing protrudes into the room. */}
    <group scale={[width / 3.8, 1, 1]}>
      {/* The single sun: only the main window draws it, and it stays recessed behind the glass. */}
      {celestial && daylight > 0.02 && <mesh position={[-1.0 + sunProgress * 2.0, -0.85 + sunProgress * 1.35, -0.03]}><sphereGeometry args={[0.16 + daylight * 0.1, 16, 12]} /><meshStandardMaterial color={golden > 0.2 ? '#ffb05a' : '#ffd98a'} emissive={golden > 0.2 ? '#ff8c3a' : '#ffb84d'} emissiveIntensity={(3 + daylight * 2) * (wet ? 0.45 : 1)} toneMapped={false} /></mesh>}
      {/* The moon takes the same window at night, opposite the sun. */}
      {celestial && daylight < 0.35 && <mesh position={[0.95, 0.6, -0.03]}><sphereGeometry args={[0.15, 16, 12]} /><meshStandardMaterial color="#e8ecf5" emissive="#cfd8ec" emissiveIntensity={1.5} toneMapped={false} /></mesh>}
      {daylight < 0.42 && <group position={[0, 0.2, -0.02]}><Sparkles count={46} scale={[3.2, 1.9, 0.2]} size={2.6} speed={0.35} color="#dfe8ff" /></group>}
      {daylight < 0.42 && [[-0.9, 0.42], [0.7, 0.55], [-0.3, -0.15], [1.0, -0.05], [0.25, 0.6], [-1.1, -0.4], [0.5, 0.2]].map(([sx, sy], i) => <mesh key={`s${i}`} position={[sx, sy, -0.02]}><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} toneMapped={false} /></mesh>)}
      {/* Drifting clouds, faint by day and lit by the city glow at night. */}
      <group ref={clouds} position={[0, 0.6, -0.025]}>
        {[[-1.3, 0.1], [0.2, 0.35], [1.5, -0.1]].map(([cx, cy], i) => <mesh key={`cl${i}`} position={[cx, cy, 0]}><boxGeometry args={[0.9, 0.22, 0.02]} /><meshStandardMaterial color={daylight > 0.4 ? '#e9f1fb' : '#3a4a63'} emissive={daylight > 0.4 ? '#cddcf0' : '#26364f'} emissiveIntensity={daylight > 0.4 ? 0.3 : 0.5} transparent opacity={0.75} /></mesh>)}
      </group>
      {Array.from({ length: 10 }).map((_, i) => <mesh key={`c${i}`} position={[-1.25 + i * 0.27, -0.62 - (i % 3) * 0.05, -0.01]}><boxGeometry args={[0.14, 0.22 + (i % 3) * 0.1, 0.02]} /><meshStandardMaterial color="#3a5a7a" emissive="#4f8f9c" emissiveIntensity={0.5} /></mesh>)}
      {wet && <RainCurtain hail={weather === 'hail'} />}
    </group>
    {/* openable glass pane, hinged at the bottom */}
    <group ref={pane} position={[0, -0.75, 0.05]}>
      <mesh position={[0, 0.75, 0]}><boxGeometry args={[width - 1.3, 1.5, 0.04]} /><meshStandardMaterial color="#6f9fc0" transparent opacity={0.22} metalness={0.3} roughness={0.1} /></mesh>
      <mesh position={[0, 0.75, 0.02]}><boxGeometry args={[0.05, 1.5, 0.05]} /><meshStandardMaterial color="#16202e" /></mesh>
      <mesh position={[0, 0.75, 0.02]}><boxGeometry args={[width - 1.3, 0.05, 0.05]} /><meshStandardMaterial color="#16202e" /></mesh>
    </group>
  </group>;
}

const BEDDING_PINK = '#f2c3ce'; // soft pastel pink duvet
const BEDDING_GREEN = '#7fae86'; // the stripe running across it
const BED_WOOD = '#7a5a41';

/**
 * A complete bed rather than a bare mattress: a wooden frame on legs, a slatted headboard, a mattress,
 * two pillows, and a pastel-pink duvet with green stripes folded back over the foot.
 * The head of the bed is at −x, matching where the producer's head rests when lying down.
 */
function Bed() {
  return <group>
    {/* Frame and legs. */}
    <mesh position={[0, 0.3, 0]} castShadow receiveShadow><boxGeometry args={[2.34, 0.22, 1.72]} /><meshStandardMaterial color={BED_WOOD} roughness={0.75} /></mesh>
    {[[-1.05, -0.72], [1.05, -0.72], [-1.05, 0.72], [1.05, 0.72]].map(([lx, lz], i) => (
      <mesh key={i} position={[lx, 0.1, lz]} castShadow><boxGeometry args={[0.15, 0.2, 0.15]} /><meshStandardMaterial color="#5b4130" roughness={0.8} /></mesh>
    ))}
    {/* Headboard: a panel with vertical slats. */}
    <group position={[-1.18, 0, 0]}>
      <mesh position={[0, 0.82, 0]} castShadow><boxGeometry args={[0.14, 1.1, 1.72]} /><meshStandardMaterial color={BED_WOOD} roughness={0.72} /></mesh>
      {[-0.6, -0.3, 0, 0.3, 0.6].map((sz) => (
        <mesh key={sz} position={[0.05, 0.86, sz]}><boxGeometry args={[0.06, 0.82, 0.12]} /><meshStandardMaterial color="#947051" roughness={0.7} /></mesh>
      ))}
      <mesh position={[0, 1.42, 0]} castShadow><boxGeometry args={[0.2, 0.14, 1.84]} /><meshStandardMaterial color="#5b4130" roughness={0.75} /></mesh>
    </group>
    {/* Footboard, lower than the headboard. */}
    <mesh position={[1.18, 0.56, 0]} castShadow><boxGeometry args={[0.14, 0.56, 1.72]} /><meshStandardMaterial color={BED_WOOD} roughness={0.72} /></mesh>
    {/* Mattress. */}
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[2.18, 0.22, 1.6]} /><meshStandardMaterial color="#efe9dd" roughness={0.9} /></mesh>
    {/* Pastel-pink duvet with green stripes running across the bed. */}
    <mesh position={[0.16, 0.66, 0]} castShadow><boxGeometry args={[1.84, 0.14, 1.62]} /><meshStandardMaterial color={BEDDING_PINK} roughness={0.95} /></mesh>
    {[-0.34, 0.18, 0.7].map((sx) => (
      <mesh key={sx} position={[sx, 0.735, 0]}><boxGeometry args={[0.2, 0.005, 1.63]} /><meshStandardMaterial color={BEDDING_GREEN} roughness={0.95} /></mesh>
    ))}
    {/* Turned-back top sheet at the head end. */}
    <mesh position={[-0.82, 0.68, 0]} castShadow><boxGeometry args={[0.34, 0.1, 1.62]} /><meshStandardMaterial color="#fbeef1" roughness={0.95} /></mesh>
    {/* Two pillows side by side against the headboard. Kept low (top ≈ 0.77) so a lying head rests
        ON them rather than beside a pillow that towers over it. */}
    {[-0.36, 0.36].map((pz) => (
      <mesh key={pz} position={[-0.82, 0.70, pz]} rotation={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[0.5, 0.14, 0.66]} /><meshStandardMaterial color="#fdf6f2" roughness={0.96} />
      </mesh>
    ))}
    {[-0.36, 0.36].map((pz) => (
      <mesh key={`s${pz}`} position={[-0.82, 0.775, pz]}><boxGeometry args={[0.5, 0.005, 0.16]} /><meshStandardMaterial color={BEDDING_GREEN} roughness={0.95} /></mesh>
    ))}
  </group>;
}

/** Wall poster with two colour panels. */
function Poster({ top, bottom }: { top: string; bottom: string }) {
  return <group position={[0, 2.05, 0]}>
    <mesh><boxGeometry args={[1.1, 1.4, 0.05]} /><meshStandardMaterial color="#241b2b" /></mesh>
    <mesh position={[0, 0.24, 0.03]}><planeGeometry args={[0.9, 0.72]} /><meshStandardMaterial color={top} emissive={top} emissiveIntensity={0.14} /></mesh>
    <mesh position={[0, -0.42, 0.03]}><planeGeometry args={[0.9, 0.42]} /><meshStandardMaterial color={bottom} /></mesh>
  </group>;
}

/** Returns the recognizable geometry for one object. Falls back to a shaped block for anything unmapped. */
export function RoomObjectModel({ object }: { object: StudioObject }) {
  switch (object.id) {
    case 'musicDesk': return <group>
      <mesh position={[0, DESK_Y, 0]} castShadow receiveShadow><boxGeometry args={[5.3, 0.14, 2.95]} /><meshStandardMaterial color="#6d5a59" roughness={0.55} /></mesh>
      {[[-2.45, -1.32], [2.45, -1.32], [-2.45, 1.32], [2.45, 1.32]].map(([lx, lz], i) => <mesh key={i} position={[lx, (DESK_Y - 0.07) / 2, lz]} castShadow><boxGeometry args={[0.16, DESK_Y - 0.07, 0.16]} /><meshStandardMaterial color="#3f3944" /></mesh>)}
    </group>;

    case 'instrumentTable': return <group>
      <mesh position={[0, TABLE2_Y, 0]} castShadow receiveShadow><boxGeometry args={[2.9, 0.12, 1.9]} /><meshStandardMaterial color="#5a4a4c" roughness={0.6} /></mesh>
      {[[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]].map(([lx, lz], i) => <mesh key={i} position={[lx, (TABLE2_Y - 0.06) / 2, lz]} castShadow><boxGeometry args={[0.14, TABLE2_Y - 0.06, 0.14]} /><meshStandardMaterial color="#33292b" /></mesh>)}
    </group>;

    // Office chair: seat + backrest (toward the camera) + post + wheeled star base. The producer sits here.
    case 'chair':
    case 'friendChair': return <group>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.52, 0.1, 0.5]} /><meshStandardMaterial color="#20242c" roughness={0.7} /></mesh>
      <mesh position={[0, 0.92, 0.23]} castShadow><boxGeometry args={[0.5, 0.66, 0.09]} /><meshStandardMaterial color="#191c23" roughness={0.7} /></mesh>
      <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.05, 0.05, 0.5, 10]} /><meshStandardMaterial color="#15151b" metalness={0.5} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => <group key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
        <mesh position={[0, 0.09, 0.22]}><boxGeometry args={[0.06, 0.05, 0.4]} /><meshStandardMaterial color="#15151b" /></mesh>
        <mesh position={[0, 0.05, 0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#0a0c12" /></mesh>
      </group>)}
    </group>;

    case 'dualMonitors': return <group position={[0, DESK_Y, 0]}>
      {[{ x: -0.72, screen: '#e0a94a' }, { x: 0.72, screen: '#3fa6c0' }].map((m) => <group key={m.x} position={[m.x, 0, 0]}>
        <mesh position={[0, 0.58, 0]} castShadow><boxGeometry args={[1.28, 0.82, 0.08]} /><meshStandardMaterial color="#0e1622" /></mesh>
        <mesh position={[0, 0.58, 0.05]}><planeGeometry args={[1.12, 0.66]} /><meshStandardMaterial color={m.screen} emissive={m.screen} emissiveIntensity={2.4} toneMapped={false} /></mesh>
        <pointLight position={[0, 0.58, 0.35]} color={m.screen} intensity={1.1} distance={2.2} />
        <mesh position={[0, 0.14, -0.02]}><boxGeometry args={[0.1, 0.32, 0.1]} /><meshStandardMaterial color="#20303f" /></mesh>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.5, 0.05, 0.3]} /><meshStandardMaterial color="#20303f" /></mesh>
      </group>)}
    </group>;

    // Two studio monitor speakers flanking the screens (left + right of the monitor).
    case 'studioMonitors': return <group position={[0, DESK_Y, 0]}>
      {[-1.85, 1.85].map((sx) => <group key={sx} position={[sx, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.6, 1.0, 0.5]} /><meshStandardMaterial color="#d9d9d0" roughness={0.5} /></mesh>
        <mesh position={[0, 0.4, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.03, 20]} /><meshStandardMaterial color="#20242c" /></mesh>
        <mesh position={[0, 0.4, 0.28]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 0.03, 20]} /><meshStandardMaterial color="#d6a447" emissive="#6f4b10" emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, 0.78, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.03, 16]} /><meshStandardMaterial color="#15151b" /></mesh>
      </group>)}
    </group>;

    case 'laptop': return <group position={[0, DESK_Y + 0.02, 0]}>
      <mesh position={[0, 0.02, 0.06]} castShadow><boxGeometry args={[0.9, 0.04, 0.6]} /><meshStandardMaterial color="#3a4351" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[0, 0.045, 0.08]}><boxGeometry args={[0.8, 0.008, 0.46]} /><meshStandardMaterial color="#0b1018" /></mesh>
      <group position={[0, 0.02, -0.24]} rotation={[-Math.PI * 0.42, 0, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.9, 0.6, 0.03]} /><meshStandardMaterial color="#2a3340" /></mesh>
        <mesh position={[0, 0.3, 0.02]}><planeGeometry args={[0.8, 0.5]} /><meshStandardMaterial color="#255a72" emissive="#255a72" emissiveIntensity={1.0} /></mesh>
      </group>
    </group>;

    // Metallic red audio interface.
    case 'audioInterface': return <group position={[0, DESK_Y, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.52, 0.22, 0.4]} /><meshStandardMaterial color="#c0392b" metalness={0.85} roughness={0.28} /></mesh>
      <mesh position={[0.15, 0.24, 0.1]}><cylinderGeometry args={[0.06, 0.06, 0.05, 12]} /><meshStandardMaterial color="#e7e1d5" metalness={0.4} /></mesh>
      <mesh position={[-0.1, 0.24, 0.1]}><cylinderGeometry args={[0.05, 0.05, 0.05, 12]} /><meshStandardMaterial color="#d6a447" /></mesh>
      <mesh position={[0.22, 0.24, -0.06]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#5fe08a" emissive="#5fe08a" emissiveIntensity={2} toneMapped={false} /></mesh>
    </group>;

    // Condenser mic on a small desk stand, with a record LED.
    case 'mic': return <group position={[0, DESK_Y, 0]}>
      <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.14, 0.16, 0.06, 16]} /><meshStandardMaterial color="#20242c" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.025, 0.025, 0.55, 10]} /><meshStandardMaterial color="#3a3f46" metalness={0.6} /></mesh>
      <mesh position={[0, 0.68, 0.02]} castShadow><cylinderGeometry args={[0.09, 0.09, 0.34, 16]} /><meshStandardMaterial color="#2b2f36" metalness={0.5} roughness={0.35} /></mesh>
      <mesh position={[0, 0.86, 0.02]}><sphereGeometry args={[0.095, 14, 12]} /><meshStandardMaterial color="#5a5f66" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0.6, 0.11]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={2} toneMapped={false} /></mesh>
    </group>;

    // Phone lying flat on the desk, screen glowing.
    case 'phone': return <group position={[0, DESK_Y, 0]} rotation={[0, 0.2, 0]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow><boxGeometry args={[0.34, 0.7, 0.03]} /><meshStandardMaterial color="#0c0e14" metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.3, 0.64]} /><meshStandardMaterial color="#2a3550" emissive="#3a4a70" emissiveIntensity={0.9} toneMapped={false} /></mesh>
      <mesh position={[-0.1, 0.03, -0.22]}><boxGeometry args={[0.1, 0.02, 0.1]} /><meshStandardMaterial color="#1a1d24" /></mesh>
    </group>;

    // Phone resting ON TOP of the duvet (blanket top ≈ 0.73 world), not sunk into the mattress.
    // The flat body sits a hair above the bedding and the lit screen a further hair above that,
    // so it reads as casually dropped on the bed with no clipping or z-fighting.
    case 'bedPhone': return <group position={[0, 0.78, 0]} rotation={[0, -0.4, 0]}>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow><boxGeometry args={[0.32, 0.66, 0.03]} /><meshStandardMaterial color="#0c0e14" metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.28, 0.6]} /><meshStandardMaterial color="#3a4a70" emissive="#4a5c8a" emissiveIntensity={1.1} toneMapped={false} /></mesh>
      <pointLight position={[0, 0.2, 0]} color="#6a7fb8" intensity={0.5} distance={1.4} />
    </group>;

    case 'lyricNotebook': return <group position={[0, DESK_Y, 0]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.04, 0]} castShadow><boxGeometry args={[0.5, 0.06, 0.66]} /><meshStandardMaterial color="#e7e1d5" /></mesh>
      <mesh position={[0.26, 0.09, 0.12]} rotation={[0, 0, 0.5]}><cylinderGeometry args={[0.02, 0.02, 0.4, 8]} /><meshStandardMaterial color="#20242c" /></mesh>
    </group>;

    case 'ashtray': return <group position={[0, DESK_Y, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.22, 0.18, 0.1, 18]} /><meshStandardMaterial color="#3a3f47" /></mesh>
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.15, 0.15, 0.04, 18]} /><meshStandardMaterial color="#191c22" /></mesh>
    </group>;

    case 'cigarettes': return <group position={[0, DESK_Y, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[0.26, 0.34, 0.14]} /><meshStandardMaterial color="#d8d0c2" /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.27, 0.09, 0.15]} /><meshStandardMaterial color="#b73545" /></mesh>
    </group>;

    case 'vodka': return <Bottle color="#8fb9c9" height={1.05} />;
    case 'pillBottle': return <group position={[0, DESK_Y, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.13, 0.13, 0.4, 14]} /><meshStandardMaterial color="#d9b64d" /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.14, 0.14, 0.06, 14]} /><meshStandardMaterial color="#e7e1d5" /></mesh>
    </group>;
    case 'redBull': return <mesh position={[0, DESK_Y + 0.24, 0]} castShadow><cylinderGeometry args={[0.13, 0.13, 0.46, 16]} /><meshStandardMaterial color="#d05e55" metalness={0.3} roughness={0.4} /></mesh>;

    case 'window': return <WindowUnit />;
    // Second window on the bed side; narrower, and it reads the same day-cycle and weather state.
    // Same shared world, but it does NOT draw the sun/moon — there is only one sun, in the main window.
    case 'window2': return <WindowUnit width={2.6} celestial={false} />;

    case 'posters': return <Poster top="#b8708a" bottom="#4f6f8c" />;
    case 'posters2': return <Poster top="#5a86a0" bottom="#2f4a5a" />;
    case 'posters3': return <Poster top="#c0993f" bottom="#5c4a2e" />;
    case 'posters4': return <Poster top="#8a6fb0" bottom="#453560" />;

    case 'ledLights': return <LedStrip />;

    case 'shelves': return <group>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[1.2, 1.8, 0.5]} /><meshStandardMaterial color="#5e5560" /></mesh>
      {[0.4, 0.96, 1.5].map((sy, i) => <mesh key={i} position={[0, sy, 0.02]}><boxGeometry args={[1.12, 0.05, 0.5]} /><meshStandardMaterial color="#3d3742" /></mesh>)}
      {[['#b87882', -0.3, 0.6], ['#6d9c7b', 0.1, 0.6], ['#d6a447', -0.15, 1.16], ['#4f8f9c', 0.28, 1.68]].map(([col, bx, by], i) => <mesh key={`b${i}`} position={[bx as number, by as number, 0.06]}><boxGeometry args={[0.13, 0.3, 0.34]} /><meshStandardMaterial color={col as string} /></mesh>)}
    </group>;

    // Synths + keyboards now rest on the instrument table (TABLE2_Y), so they sit flat with no floor stands.
    case 'modularSynths': return <group position={[0, TABLE2_Y, 0]}>
      <mesh position={[0, 0.06, 0.05]}><boxGeometry args={[1.75, 0.12, 0.5]} /><meshStandardMaterial color="#1a1a22" /></mesh>
      <group position={[0, 0.42, -0.08]} rotation={[-0.42, 0, 0]}>
        <mesh castShadow><boxGeometry args={[1.7, 0.8, 0.16]} /><meshStandardMaterial color="#2a2531" /></mesh>
        <group position={[0, 0, 0.1]}><KnobGrid rows={3} cols={9} width={1.5} height={0.64} /></group>
      </group>
    </group>;

    case 'portasound': return <group position={[0, TABLE2_Y, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[1.5, 0.14, 0.5]} /><meshStandardMaterial color="#d8c6a4" /></mesh>
      <KeyStrip y={0.15} width={1.4} />
    </group>;

    case 'sk5': return <group position={[0, TABLE2_Y, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[1.1, 0.14, 0.46]} /><meshStandardMaterial color="#aeb2b3" /></mesh>
      <KeyStrip y={0.15} width={1.0} />
    </group>;

    case 'acousticGuitar': return <Guitar body="#ba8653" />;
    case 'electricGuitar': return <Guitar body="#e9e8df" solid />;

    case 'bed': return <Bed />;

    case 'miniFridge': return <Fridge />;

    case 'bathroom': return <Door color="#456473" />;
    case 'entrance': return <EntranceDoor />;
    case 'closet': return <SlidingCloset />;

    case 'cables': return <group>
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.08, 10, 24]} /><meshStandardMaterial color="#20242c" /></mesh>
      <mesh position={[0.12, 0.11, 0.12]} rotation={[Math.PI / 2, 0.5, 0]}><torusGeometry args={[0.25, 0.07, 10, 24]} /><meshStandardMaterial color="#2a2e36" /></mesh>
    </group>;

    case 'switch': return <group position={[0, 0.06, 0]} rotation={[-Math.PI / 2 + 0.2, 0, 0]}>
      <mesh castShadow><boxGeometry args={[0.7, 0.42, 0.04]} /><meshStandardMaterial color="#20242c" /></mesh>
      <mesh position={[0, 0, 0.03]}><planeGeometry args={[0.5, 0.34]} /><meshStandardMaterial color="#2b6f86" emissive="#2b6f86" emissiveIntensity={0.9} /></mesh>
      <mesh position={[-0.3, 0, 0]}><boxGeometry args={[0.1, 0.42, 0.05]} /><meshStandardMaterial color="#d05e55" /></mesh>
      <mesh position={[0.3, 0, 0]}><boxGeometry args={[0.1, 0.42, 0.05]} /><meshStandardMaterial color="#4f8f9c" /></mesh>
    </group>;

    default: return <mesh position={[0, 0.4, 0]} castShadow receiveShadow><boxGeometry args={[0.8, 0.8, 0.8]} /><meshStandardMaterial color={object.color} roughness={0.7} /></mesh>;
  }
}
