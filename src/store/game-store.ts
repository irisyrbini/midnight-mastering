import { create } from 'zustand';
import { interactionById } from '@/data/interactions';
import { STUDIO_OBJECTS } from '@/data/studio-layout';
import { crystalState, emotionalNeedDrift, INITIAL_EMOTIONAL_GRAPH, resolveEmotionGraph } from '@/game/simulation/emotionalGraph';
import type { CrystalState, Ending, EmotionalGraphState, GamePhase, GameSnapshot, Interaction, NeedChange, ProducerNeeds } from '@/types/game';

type GameState = GameSnapshot & {
  setPhase: (phase: GamePhase) => void;
  hydrateSession: (snapshot: Partial<GameSnapshot>) => void;
  elapsedMs: number;
  lastInteraction?: Interaction;
  dawOpen: boolean;
  workingOnMusic: boolean;
  musicQuality: number;
  inspirationMinutes: number;
  inspirationCheckMinutes: number;
  emotionalGraph: EmotionalGraphState;
  emotionalResolutionMinutes: number;
  albumProgress: number;
  albumCompleted: boolean;
  crystal: CrystalState;
  playerPosition: { x: number; y: number };
  moveTarget: MoveTarget;
  seated: boolean;
  lyingDown: boolean;
  running: boolean;
  entranceOpen: boolean;
  selectedObjectId?: string;
  activeVideoId?: string;
  ending: Ending;
  collapseMinutes: number;
  setDawOpen: (open: boolean) => void;
  setWorkingOnMusic: (working: boolean) => void;
  movePlayer: (direction: { x: number; y: number }) => void;
  setMoveTarget: (target: { x: number; y: number; selectId?: string }) => void;
  setRunning: (running: boolean) => void;
  stepMovement: (deltaMs: number) => void;
  selectObject: (id?: string) => void;
  closeVideo: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  tick: (deltaMs: number) => void;
  interact: (interactionId: string) => void;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const decayPerGameMinute: ProducerNeeds = { hunger: 0.16, energy: 0.12, hygiene: 0.06, social: 0.08, creativity: 0.09, love: 0.05 };

/** Point-and-click navigation target. `selectId` keeps a clicked object selected while walking to it. */
type MoveTarget = { x: number; y: number; selectId?: string } | null;
const WALK_SPEED = 340; // logical px per real second
const SELECT_RADIUS = 105;
type Point = { x: number; y: number };

/** Walkable floor. Widened so the producer can roam the open front and walk behind the desk to the window. */
const clampToRoom = (p: Point): Point => ({ x: Math.max(70, Math.min(1240, p.x)), y: Math.max(150, Math.min(780, p.y)) });

const nearestObjectId = (p: Point): string | undefined =>
  STUDIO_OBJECTS.reduce<{ id?: string; distance: number }>((best, object) => {
    const distance = Math.hypot(p.x - (object.x + object.width / 2), p.y - (object.y + object.height / 2));
    return distance < best.distance ? { id: object.id, distance } : best;
  }, { distance: SELECT_RADIUS }).id;

/** Where the producer sits / lies when using the chair / bed. */
const centerOf = (id: string, fallback: Point): Point => {
  const object = STUDIO_OBJECTS.find((o) => o.id === id);
  return object ? { x: object.x + object.width / 2, y: object.y + object.height / 2 } : fallback;
};
const SIT_POSITION = centerOf('chair', { x: 640, y: 510 });
const LIE_POSITION = centerOf('bed', { x: 950, y: 300 });

/** Sustained-wellbeing collapse. See docs/Gameplay.md §6 and docs/GDD.md §5. */
const COLLAPSE_WELLBEING_FLOOR = 15;
const COLLAPSE_SUSTAIN_MINUTES = 90;
const wellbeing = (needs: ProducerNeeds) => Object.values(needs).reduce((sum, value) => sum + value, 0) / 6;

/** Durable session defaults, reused by initial boot and restart so a new run is a clean slate. */
const initialSession = () => ({
  clock: { day: 1, minuteOfDay: 540 },
  needs: { hunger: 72, energy: 70, hygiene: 66, social: 48, creativity: 62, love: 54 } as ProducerNeeds,
  activeLocationId: 'apartment-studio',
  elapsedMs: 0,
  lastInteraction: undefined as Interaction | undefined,
  dawOpen: false,
  workingOnMusic: false,
  musicQuality: 0,
  inspirationMinutes: 0,
  inspirationCheckMinutes: 0,
  emotionalGraph: INITIAL_EMOTIONAL_GRAPH,
  emotionalResolutionMinutes: 0,
  albumProgress: 0,
  albumCompleted: false,
  crystal: crystalState(INITIAL_EMOTIONAL_GRAPH),
  playerPosition: { x: 640, y: 510 },
  moveTarget: null as MoveTarget,
  seated: false,
  lyingDown: false,
  running: false,
  entranceOpen: false,
  selectedObjectId: undefined as string | undefined,
  activeVideoId: undefined as string | undefined,
  ending: null as Ending,
  collapseMinutes: 0,
});

function applyNeedChange(needs: ProducerNeeds, changes: NeedChange): ProducerNeeds {
  return Object.fromEntries(Object.entries(needs).map(([key, value]) => [key, clamp(value + (changes[key as keyof ProducerNeeds] ?? 0))])) as ProducerNeeds;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'booting',
  ...initialSession(),
  setPhase: (phase) => set({ phase }),
  hydrateSession: (snapshot) => set(snapshot),
  setDawOpen: (dawOpen) => set({ dawOpen, workingOnMusic: dawOpen ? false : false }),
  setWorkingOnMusic: (workingOnMusic) => set((state) => ({ workingOnMusic: state.dawOpen ? workingOnMusic : false })),
  pause: () => set((state) => (state.phase === 'playing' ? { phase: 'paused' } : state)),
  resume: () => set((state) => (state.phase === 'paused' ? { phase: 'playing' } : state)),
  restart: () => set({ phase: 'playing', ...initialSession() }),
  movePlayer: (direction) => set((state) => {
    if (state.phase !== 'playing') return state;
    // Keyboard steps cancel any active click-to-move target so input stays predictable, and stand the producer up.
    const playerPosition = clampToRoom({ x: state.playerPosition.x + direction.x, y: state.playerPosition.y + direction.y });
    return { playerPosition, moveTarget: null, seated: false, lyingDown: false, selectedObjectId: nearestObjectId(playerPosition) };
  }),
  setMoveTarget: (target) => set((state) => (state.phase === 'playing' ? { moveTarget: { ...clampToRoom(target), selectId: target.selectId }, seated: false, lyingDown: false } : state)),
  setRunning: (running) => set((state) => (state.running === running ? state : { running })),
  stepMovement: (deltaMs) => set((state) => {
    if (state.phase !== 'playing' || !state.moveTarget) return state;
    const step = WALK_SPEED * (state.running ? 1.85 : 1) * (deltaMs / 1000);
    const dx = state.moveTarget.x - state.playerPosition.x;
    const dy = state.moveTarget.y - state.playerPosition.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= Math.max(step, 3)) {
      const playerPosition = clampToRoom(state.moveTarget);
      return { playerPosition, moveTarget: null, selectedObjectId: state.moveTarget.selectId ?? nearestObjectId(playerPosition) };
    }
    const playerPosition = clampToRoom({ x: state.playerPosition.x + (dx / distance) * step, y: state.playerPosition.y + (dy / distance) * step });
    return { playerPosition, selectedObjectId: state.moveTarget.selectId ?? nearestObjectId(playerPosition) };
  }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  closeVideo: () => set({ activeVideoId: undefined }),
  tick: (deltaMs) => set((state) => {
    if (state.phase !== 'playing') return state;
    // 1 real second is 1 game minute: visible, continuous decline without an idle flood.
    const gameMinutes = deltaMs / 1000;
    let needs = applyNeedChange(state.needs, Object.fromEntries(Object.entries(decayPerGameMinute).map(([key, value]) => [key, -value * gameMinutes])));
    needs = applyNeedChange(needs, Object.fromEntries(Object.entries(emotionalNeedDrift(state.emotionalGraph)).map(([key, value]) => [key, value * gameMinutes])));
    const totalMinutes = state.clock.minuteOfDay + gameMinutes;
    const base = {
      elapsedMs: state.elapsedMs + deltaMs,
      needs,
      clock: { day: state.clock.day + Math.floor(totalMinutes / 1440), minuteOfDay: totalMinutes % 1440 },
    };
    // Session-frame outcome: a win halts the run immediately; sustained rock-bottom wellbeing collapses it.
    const sessionFrame = (finalNeeds: ProducerNeeds, won: boolean) => {
      if (won) return { phase: 'ending' as GamePhase, ending: 'finished' as Ending };
      const collapseMinutes = wellbeing(finalNeeds) <= COLLAPSE_WELLBEING_FLOOR ? state.collapseMinutes + gameMinutes : 0;
      if (collapseMinutes >= COLLAPSE_SUSTAIN_MINUTES) return { phase: 'ending' as GamePhase, ending: 'collapse' as Ending, collapseMinutes };
      return { collapseMinutes };
    };
    if (!state.workingOnMusic) return { ...base, inspirationMinutes: Math.max(0, state.inspirationMinutes - gameMinutes), ...sessionFrame(needs, false) };

    // Music work has its own sustained cost beyond normal living decay.
    needs = applyNeedChange(needs, { energy: -0.22 * gameMinutes, hunger: -0.18 * gameMinutes, hygiene: -0.08 * gameMinutes, social: -0.14 * gameMinutes, creativity: 0.24 * gameMinutes });
    const inspirationCheckMinutes = state.inspirationCheckMinutes + gameMinutes;
    const canCheckInspiration = inspirationCheckMinutes >= 10;
    const receivesInspiration = canCheckInspiration && state.inspirationMinutes <= 0 && Math.random() < 0.18;
    const inspirationMinutes = receivesInspiration ? 75 : Math.max(0, state.inspirationMinutes - gameMinutes);
    const qualityRate = inspirationMinutes > 0 ? 0.34 : 0.16;
    const emotionalResolutionMinutes = state.emotionalResolutionMinutes + gameMinutes;
    const resolveWorkEmotion = emotionalResolutionMinutes >= 15;
    const emotionalGraph = resolveWorkEmotion ? resolveEmotionGraph(state.emotionalGraph, [{ node: 'creativeFlow', direction: 'up' }, { node: 'burnout', direction: 'up' }, { node: 'obsession', direction: 'up' }]) : state.emotionalGraph;
    const crystal = crystalState(emotionalGraph);
    const albumProgress = clamp(state.albumProgress + 0.12 * gameMinutes);
    const albumCompleted = state.albumCompleted || (albumProgress >= 100 && crystal === 'green');
    return {
      ...base,
      needs,
      musicQuality: clamp(state.musicQuality + qualityRate * gameMinutes),
      albumProgress,
      albumCompleted,
      crystal,
      inspirationMinutes,
      inspirationCheckMinutes: canCheckInspiration ? 0 : inspirationCheckMinutes,
      emotionalGraph,
      emotionalResolutionMinutes: resolveWorkEmotion ? 0 : emotionalResolutionMinutes,
      ...sessionFrame(needs, albumCompleted),
    };
  }),
  interact: (interactionId) => set((state) => {
    const interaction = interactionById[interactionId];
    if (!interaction || state.phase !== 'playing') return state;
    const emotionalGraph = resolveEmotionGraph(state.emotionalGraph, interaction.emotionalEffects);
    const crystal = crystalState(emotionalGraph);
    const inspirationMinutes = interaction.inspirationMinutes ? Math.max(state.inspirationMinutes, interaction.inspirationMinutes) : state.inspirationMinutes;
    // The chair toggles sitting; the bed toggles lying. Snap onto the furniture, use again to get up. No playback modal.
    if (interaction.action === 'sit') {
      const seated = !state.seated;
      return { seated, lyingDown: false, playerPosition: seated ? SIT_POSITION : state.playerPosition, moveTarget: null, lastInteraction: interaction, emotionalGraph, crystal };
    }
    if (interaction.action === 'lie') {
      const lyingDown = !state.lyingDown;
      return { lyingDown, seated: false, playerPosition: lyingDown ? LIE_POSITION : state.playerPosition, moveTarget: null,
        needs: lyingDown ? applyNeedChange(state.needs, interaction.changes) : state.needs, lastInteraction: interaction, emotionalGraph, crystal };
    }
    // Any other interaction stands the producer up. The entrance swings its door open.
    const entranceOpen = interactionId === 'entrance' ? true : state.entranceOpen;
    if (interaction.action === 'open-daw') return { dawOpen: true, workingOnMusic: false, activeVideoId: interaction.id, lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes, seated: false, lyingDown: false, entranceOpen };
    return { needs: applyNeedChange(state.needs, interaction.changes), activeVideoId: interaction.id, lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes, seated: false, lyingDown: false, entranceOpen };
  }),
}));
