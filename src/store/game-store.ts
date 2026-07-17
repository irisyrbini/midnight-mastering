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
  fridgeOpen: boolean;
  windowOpen: boolean;
  stress: number;
  scrolling: boolean;
  wellnessMinutes: number;
  instrumentsUsed: Record<string, boolean>;
  prompt: Prompt | null;
  sfxCue: SfxCue;
  visitorActive: boolean;
  visitorPhase: VisitorPhase;
  visitorPos: Point;
  visitorLeaveAt: number;
  selectedObjectId?: string;
  activeVideoId?: string;
  ending: Ending;
  collapseMinutes: number;
  setDawOpen: (open: boolean) => void;
  setWorkingOnMusic: (working: boolean) => void;
  movePlayer: (direction: { x: number; y: number }) => void;
  setMoveTarget: (target: { x: number; y: number; selectId?: string }) => void;
  setRunning: (running: boolean) => void;
  setEntranceOpen: (open: boolean) => void;
  stepMovement: (deltaMs: number) => void;
  stepVisitor: (deltaMs: number) => void;
  selectObject: (id?: string) => void;
  closeVideo: () => void;
  choose: (kind: string) => void;
  dismissPrompt: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  tick: (deltaMs: number) => void;
  interact: (interactionId: string) => void;
};

export type PromptChoice = { label: string; kind: string };
export type Prompt = { title: string; note?: string; choices: PromptChoice[] };
type VisitorPhase = 'arriving' | 'staying' | 'leaving';
type SfxCue = { id: string; n: number };

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
const ENTRANCE_POSITION = centerOf('entrance', { x: 256, y: 768 });

/** Every musical instrument (incl. the lyric notebook) must be used before the album can be finished (see docs). */
const INSTRUMENT_IDS = new Set(['acousticGuitar', 'electricGuitar', 'portasound', 'sk5', 'modularSynths', 'mic', 'lyricNotebook']);
const REQUIRED_INSTRUMENT_COUNT = INSTRUMENT_IDS.size;
const allInstrumentsUsed = (used: Record<string, boolean>) => [...INSTRUMENT_IDS].every((id) => used[id]);

const FRIDGE_PROMPT: Prompt = {
  title: 'Cold beers on the shelf.',
  choices: [
    { label: 'Drink a beer', kind: 'drink-beer' },
    { label: 'Grab a snack', kind: 'eat' },
    { label: 'Close the fridge', kind: 'close-fridge' },
  ],
};
const PHONE_PROMPT: Prompt = {
  title: 'Late-night phone.',
  choices: [
    { label: 'Call a friend', kind: 'call-friend' },
    { label: 'Doom-scroll', kind: 'doom-scroll' },
    { label: 'Put it down', kind: 'dismiss' },
  ],
};

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
  fridgeOpen: false,
  windowOpen: false,
  stress: 40,
  scrolling: false,
  wellnessMinutes: 0,
  instrumentsUsed: {} as Record<string, boolean>,
  prompt: null as Prompt | null,
  sfxCue: { id: '', n: 0 } as SfxCue,
  visitorActive: false,
  visitorPhase: 'arriving' as VisitorPhase,
  visitorPos: { x: 256, y: 768 } as Point,
  visitorLeaveAt: 0,
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
  setEntranceOpen: (entranceOpen) => set((state) => (state.entranceOpen === entranceOpen ? state : { entranceOpen })),
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
    // Stress creeps up over the night — faster under burnout/obsession/loneliness and while grinding, easier when in flow.
    const g = state.emotionalGraph;
    const stressDrift = 0.03 + (g.burnout === 'high' ? 0.07 : 0) + (g.obsession === 'high' ? 0.04 : 0) + (g.loneliness === 'high' ? 0.03 : 0) - (g.creativeFlow === 'high' ? 0.03 : 0) + (state.workingOnMusic ? 0.14 : 0);
    // Wellness boost: when every need is full, the crystal recovers faster (positive graph resolution every ~8 game-min).
    const allFull = Math.min(...Object.values(needs)) >= 95;
    const wellnessAccum = allFull ? state.wellnessMinutes + gameMinutes : 0;
    const wellnessResolve = allFull && wellnessAccum >= 8;
    const baseGraph = wellnessResolve
      ? resolveEmotionGraph(state.emotionalGraph, [{ node: 'hope', direction: 'up' }, { node: 'love', direction: 'up' }, { node: 'burnout', direction: 'down' }, { node: 'loneliness', direction: 'down' }])
      : state.emotionalGraph;
    const base = {
      elapsedMs: state.elapsedMs + deltaMs,
      needs,
      clock: { day: state.clock.day + Math.floor(totalMinutes / 1440), minuteOfDay: totalMinutes % 1440 },
      stress: clamp(state.stress + stressDrift * gameMinutes),
      wellnessMinutes: wellnessResolve ? 0 : wellnessAccum,
    };
    // Session-frame outcome: a win halts the run immediately; sustained rock-bottom wellbeing collapses it.
    const sessionFrame = (finalNeeds: ProducerNeeds, won: boolean) => {
      if (won) return { phase: 'ending' as GamePhase, ending: 'finished' as Ending };
      const collapseMinutes = wellbeing(finalNeeds) <= COLLAPSE_WELLBEING_FLOOR ? state.collapseMinutes + gameMinutes : 0;
      if (collapseMinutes >= COLLAPSE_SUSTAIN_MINUTES) return { phase: 'ending' as GamePhase, ending: 'collapse' as Ending, collapseMinutes };
      return { collapseMinutes };
    };
    if (!state.workingOnMusic) return { ...base, emotionalGraph: baseGraph, crystal: crystalState(baseGraph), inspirationMinutes: Math.max(0, state.inspirationMinutes - gameMinutes), ...sessionFrame(needs, false) };

    // Music work has its own sustained cost beyond normal living decay.
    needs = applyNeedChange(needs, { energy: -0.22 * gameMinutes, hunger: -0.18 * gameMinutes, hygiene: -0.08 * gameMinutes, social: -0.14 * gameMinutes, creativity: 0.24 * gameMinutes });
    const inspirationCheckMinutes = state.inspirationCheckMinutes + gameMinutes;
    const canCheckInspiration = inspirationCheckMinutes >= 10;
    const receivesInspiration = canCheckInspiration && state.inspirationMinutes <= 0 && Math.random() < 0.18;
    const inspirationMinutes = receivesInspiration ? 75 : Math.max(0, state.inspirationMinutes - gameMinutes);
    const qualityRate = inspirationMinutes > 0 ? 0.34 : 0.16;
    const emotionalResolutionMinutes = state.emotionalResolutionMinutes + gameMinutes;
    const resolveWorkEmotion = emotionalResolutionMinutes >= 15;
    const emotionalGraph = resolveWorkEmotion ? resolveEmotionGraph(baseGraph, [{ node: 'creativeFlow', direction: 'up' }, { node: 'burnout', direction: 'up' }, { node: 'obsession', direction: 'up' }]) : baseGraph;
    const crystal = crystalState(emotionalGraph);
    const albumProgress = clamp(state.albumProgress + 0.12 * gameMinutes);
    // The album can only be finished once every instrument (incl. the lyric notebook) has been used.
    const albumCompleted = state.albumCompleted || (albumProgress >= 100 && crystal === 'green' && allInstrumentsUsed(state.instrumentsUsed));
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
    const sfxCue = { id: interactionId, n: state.sfxCue.n + 1 };
    const instrumentsUsed = INSTRUMENT_IDS.has(interactionId) ? { ...state.instrumentsUsed, [interactionId]: true } : state.instrumentsUsed;
    // The chair toggles sitting; the bed toggles lying. Snap onto the furniture, use again to get up. No playback modal.
    if (interaction.action === 'sit') {
      const seated = !state.seated;
      return { seated, lyingDown: false, scrolling: false, playerPosition: seated ? SIT_POSITION : state.playerPosition, moveTarget: null, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    if (interaction.action === 'lie') {
      const lyingDown = !state.lyingDown;
      return { lyingDown, seated: false, scrolling: false, playerPosition: lyingDown ? LIE_POSITION : state.playerPosition, moveTarget: null,
        needs: lyingDown ? applyNeedChange(state.needs, interaction.changes) : state.needs,
        stress: lyingDown ? clamp(state.stress + (interaction.stressDelta ?? 0)) : state.stress, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    // The fridge opens with a beer/snack choice; the bed phone offers call/scroll. Both raise a prompt instead of a modal.
    if (interaction.action === 'fridge') {
      const fridgeOpen = !state.fridgeOpen;
      return { fridgeOpen, seated: false, lyingDown: false, prompt: fridgeOpen ? FRIDGE_PROMPT : null, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    if (interaction.action === 'phone-bed') {
      return { prompt: PHONE_PROMPT, seated: false, lyingDown: false, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    if (interaction.action === 'window') {
      const windowOpen = !state.windowOpen;
      return { windowOpen, seated: false, lyingDown: false, scrolling: false,
        needs: windowOpen ? applyNeedChange(state.needs, interaction.changes) : state.needs,
        stress: windowOpen ? clamp(state.stress + (interaction.stressDelta ?? 0)) : state.stress, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    // Any other interaction stands the producer up. The entrance swings its door open.
    const entranceOpen = interactionId === 'entrance' ? true : state.entranceOpen;
    const stress = clamp(state.stress + (interaction.stressDelta ?? 0));
    if (interaction.action === 'open-daw') return { dawOpen: true, workingOnMusic: false, activeVideoId: interaction.id, lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes, seated: false, lyingDown: false, scrolling: false, entranceOpen, stress, sfxCue, instrumentsUsed };
    return { needs: applyNeedChange(state.needs, interaction.changes), activeVideoId: interaction.id, lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes, seated: false, lyingDown: false, scrolling: false, entranceOpen, stress, sfxCue, instrumentsUsed };
  }),
  dismissPrompt: () => set({ prompt: null }),
  choose: (kind) => set((state) => {
    if (kind === 'drink-beer') {
      const graph = resolveEmotionGraph(state.emotionalGraph, [{ node: 'addiction', direction: 'up' }, { node: 'creativeFlow', direction: 'up' }]);
      return { prompt: null, fridgeOpen: false, needs: applyNeedChange(state.needs, { creativity: 8, energy: -9, hygiene: -2 }), stress: clamp(state.stress - 6), emotionalGraph: graph, crystal: crystalState(graph), lastInteraction: interactionById.beer ?? state.lastInteraction };
    }
    if (kind === 'eat') return { prompt: null, fridgeOpen: false, needs: applyNeedChange(state.needs, { hunger: 24, energy: 3 }) };
    if (kind === 'call-friend') {
      const graph = resolveEmotionGraph(state.emotionalGraph, [{ node: 'loneliness', direction: 'down' }, { node: 'love', direction: 'up' }]);
      return { prompt: null, visitorActive: true, visitorPhase: 'arriving' as VisitorPhase, visitorPos: { ...ENTRANCE_POSITION }, visitorLeaveAt: state.elapsedMs + 100000, emotionalGraph: graph, crystal: crystalState(graph), lastInteraction: interactionById.friend ?? state.lastInteraction };
    }
    if (kind === 'doom-scroll') {
      return { prompt: null, lyingDown: true, scrolling: true, seated: false, playerPosition: LIE_POSITION, moveTarget: null, needs: applyNeedChange(state.needs, { social: -8 }), stress: clamp(state.stress + 6), lastInteraction: interactionById.doomscroll ?? state.lastInteraction };
    }
    // dismiss / close-fridge
    return { prompt: null, fridgeOpen: false };
  }),
  stepVisitor: (deltaMs) => set((state) => {
    if (!state.visitorActive || state.phase !== 'playing') return state;
    const step = 320 * (deltaMs / 1000);
    // Head for the player while visiting, back to the entrance when leaving.
    const goingHome = state.visitorPhase === 'leaving';
    const target = goingHome ? ENTRANCE_POSITION : { x: state.playerPosition.x - 95, y: state.playerPosition.y + 10 };
    const dx = target.x - state.visitorPos.x;
    const dy = target.y - state.visitorPos.y;
    const dist = Math.hypot(dx, dy);
    if (state.visitorPhase === 'arriving' && dist <= 70) {
      // Arrived: a big one-time social boost.
      return { visitorPhase: 'staying' as VisitorPhase, needs: applyNeedChange(state.needs, { social: 45, love: 6 }), stress: clamp(state.stress - 12) };
    }
    if (state.visitorPhase === 'staying') {
      if (state.elapsedMs >= state.visitorLeaveAt) return { visitorPhase: 'leaving' as VisitorPhase };
      return { needs: applyNeedChange(state.needs, { social: 0.4 * (deltaMs / 1000) }) }; // stay warm while together
    }
    if (goingHome && dist <= 40) return { visitorActive: false }; // out the door
    const visitorPos = { x: state.visitorPos.x + (dx / dist) * step, y: state.visitorPos.y + (dy / dist) * step };
    return { visitorPos };
  }),
}));
