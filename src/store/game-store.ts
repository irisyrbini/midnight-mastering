import { create } from 'zustand';
import { interactionById } from '@/data/interactions';
import { STUDIO_OBJECTS } from '@/data/studio-layout';
import { crystalState, emotionalNeedDrift, INITIAL_EMOTIONAL_GRAPH, resolveEmotionGraph, weightedEmotionalScore } from '@/game/simulation/emotionalGraph';
import type { CrystalState, EmotionalEffect, Ending, EmotionalGraphState, FriendActivity, GamePhase, GameSnapshot, Interaction, NeedChange, ProducerNeeds, WeatherKind } from '@/types/game';

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
  confidence: number;
  environment: number;
  sleep: number;
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
  weather: WeatherKind;
  weatherMinutes: number;
  friendMenuOpen: boolean;
  collaborationMinutes: number;
  guitarNotesMinutes: number;
  /** Counts down while the producer is actually smoking, so the animation outlives the inspect card. */
  smokingMinutes: number;
  friendActivity: FriendActivity | null;
  friendActivityMinutes: number;
  npc2Active: boolean;
  npc2Pos: Point;
  npc2LeaveAt: number;
  /** Where NPC 2 is currently strolling to, and when its current pause ends. */
  npc2Target: Point;
  npc2PauseUntil: number;
  /** Elevator ride in progress: where it is heading and when it gets there (`elapsedMs`). */
  elevatorTo: string | null;
  elevatorArrivesAt: number;
  /** Set once the producer reaches the ground-floor lobby; spends on the next return to the studio. */
  visitedLobby: boolean;
  /** Ambient thought bubble above the producer. `n` bumps so the renderer can restart its fade. */
  thought: Thought | null;
  thoughtCooldown: number;
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
  stepNpc2: (deltaMs: number) => void;
  selectObject: (id?: string) => void;
  closeVideo: () => void;
  openFriendMenu: () => void;
  closeFriendMenu: () => void;
  doFriendActivity: (activity: FriendActivity) => void;
  returnToStudio: () => void;
  callElevator: () => void;
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
export type Thought = { text: string; n: number };

/** How long a full elevator ride takes, and the beats inside it (doors close → travel → ding → doors open). */
export const ELEVATOR_RIDE_MS = 5000;
export const ELEVATOR_DOOR_MS = 1000;
export const ELEVATOR_DING_MS = 1000; // before arrival

const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const GAME_MINUTES_PER_REAL_SECOND = 2.0;
const decayPerGameMinute: ProducerNeeds = { hunger: 0.12, energy: 0.12, hygiene: 0.06, social: 0.08, creativity: 0.09, love: 0.05 };

/** Point-and-click navigation target. `selectId` keeps a clicked object selected while walking to it. */
type MoveTarget = { x: number; y: number; selectId?: string } | null;
const WALK_SPEED = 520; // logical px per real second — a brisk, purposeful walk
export const RUN_MULTIPLIER = 2.3; // Shift sprint, shared with the keyboard handler
const SELECT_RADIUS = 105;
type Point = { x: number; y: number };

/** Walkable floor. Widened so the producer can roam the open front and walk behind the desk to the window. */
const clampToRoom = (p: Point): Point => ({ x: Math.max(70, Math.min(1240, p.x)), y: Math.max(150, Math.min(780, p.y)) });

// Gameplay collision is kept in the same logical coordinate space as the
// room layout.  Small tabletop props remain decorative; these are the major
// obstacles the producer should walk around.
const COLLIDER_IDS = new Set(['shelves', 'instrumentTable', 'musicDesk', 'chair', 'friendChair', 'acousticGuitar', 'electricGuitar', 'bed', 'miniFridge', 'bathroom', 'entrance', 'closet']);
const PLAYER_RADIUS = 14;
const COLLIDER_INSET = 16;
const isBlocked = (p: Point, radius = PLAYER_RADIUS) => STUDIO_OBJECTS.some((object) => {
  if (!COLLIDER_IDS.has(object.id)) return false;
  const inset = Math.min(COLLIDER_INSET, Math.min(object.width, object.height) * 0.22);
  const left = object.x + inset - radius;
  const right = object.x + object.width - inset + radius;
  const top = object.y + inset - radius;
  const bottom = object.y + object.height - inset + radius;
  return p.x > left && p.x < right && p.y > top && p.y < bottom;
});
const collisionSafeStep = (from: Point, desired: Point) => {
  const candidate = clampToRoom(desired);
  // A saved session may place the producer on a chair/bed interaction point.
  // Let that first input step out of the collider, then enforce collision
  // normally so the character can never become permanently trapped.
  if (isBlocked(from)) return candidate;
  if (!isBlocked(candidate)) return candidate;
  const xOnly = clampToRoom({ x: candidate.x, y: from.y });
  if (!isBlocked(xOnly)) return xOnly;
  const yOnly = clampToRoom({ x: from.x, y: candidate.y });
  return isBlocked(yOnly) ? from : yOnly;
};
const approachPoint = (from: Point, objectId: string, fallback: Point) => {
  const object = STUDIO_OBJECTS.find((item) => item.id === objectId);
  if (!object) return fallback;
  const candidates = [
    { x: object.x + object.width / 2, y: object.y - PLAYER_RADIUS - 18 },
    { x: object.x + object.width / 2, y: object.y + object.height + PLAYER_RADIUS + 18 },
    { x: object.x - PLAYER_RADIUS - 18, y: object.y + object.height / 2 },
    { x: object.x + object.width + PLAYER_RADIUS + 18, y: object.y + object.height / 2 },
  ].map(clampToRoom).filter((point) => !isBlocked(point));
  return candidates.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0] ?? fallback;
};

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
const INSTRUMENT_BONUS: Record<string, number> = { acousticGuitar: 2.2, electricGuitar: 2.4, portasound: 2.8, sk5: 3, modularSynths: 3.4, mic: 1.6, lyricNotebook: 2 };
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
    { label: 'Invite another friend', kind: 'invite-friend-2' },
    { label: 'Doom-scroll', kind: 'doom-scroll' },
    { label: 'Put it down', kind: 'dismiss' },
  ],
};
/** The studio door: it opens onto the hallway, not straight into the elevator. */
const LEAVE_STUDIO_PROMPT: Prompt = {
  title: 'Leave the studio?',
  choices: [
    { label: 'Yes', kind: 'leave-room' },
    { label: 'No', kind: 'dismiss' },
  ],
};

/** The elevator call button, shown on whichever floor the producer is standing on. */
const ELEVATOR_PROMPT: Prompt = {
  title: 'Take the elevator?',
  choices: [
    { label: 'Yes', kind: 'elevator-ride' },
    { label: 'No', kind: 'dismiss' },
  ],
};

/**
 * Ambient thought bubbles (see docs/UI.md §4). The producer never speaks — these are mood, not dialogue,
 * so the pools are overwhelmingly symbols and the rare word is one or two syllables. `pickThought`
 * chooses a pool from what is happening right now, and the caller enforces a long cooldown.
 */
const THOUGHTS = {
  working: ['…', '…', '💡', '♪', '...', '…'],
  music: ['♪', '♫', '♬', '💡', '♪', '…'],
  smoking: ['🚬', '…', '☁', '…', '…'],
  anime: ['♪', '…', '♥', '…'],
  gaming: ['🎮', '!', '♪', '…', '!!'],
  rain: ['🌧', '…', '…', 'Rain.'],
  hungry: ['🍜', '…', 'Hungry.'],
  sleepy: ['💤', '…', 'Sleep.', '…'],
  goodMood: ['♪', '♬', '…', 'Nice.'],
  lowMood: ['…', '…', '…', 'Hm.', '…'],
  friend: ['!', '👋', '♪'],
  sunrise: ['☀', '…', 'Morning.'],
  idle: ['…', '…', '…', '…', '?', '…', '♪', '…', 'Hm.', '…', '☕', '…'],
} as const;

/** Weighted pick of the pool that best matches the moment, then a random line from it. */
function pickThought(pools: readonly (readonly string[])[]): string {
  const pool = pools[Math.floor(Math.random() * pools.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Sustained-wellbeing collapse. See docs/Gameplay.md §6 and docs/GDD.md §5. */
const COLLAPSE_WELLBEING_FLOOR = 15;
const COLLAPSE_SUSTAIN_MINUTES = 90;
const wellbeing = (needs: ProducerNeeds) => Object.values(needs).reduce((sum, value) => sum + value, 0) / 6;

/** Durable session defaults, reused by initial boot and restart so a new run is a clean slate. */
const initialSession = () => ({
  clock: { day: 1, minuteOfDay: 0 },
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
  confidence: 38,
  environment: 52,
  sleep: 46,
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
  weather: 'clear' as WeatherKind,
  weatherMinutes: 0,
  friendMenuOpen: false,
  collaborationMinutes: 0,
  guitarNotesMinutes: 0,
  smokingMinutes: 0,
  friendActivity: null as FriendActivity | null,
  friendActivityMinutes: 0,
  npc2Active: false,
  npc2Pos: { x: 880, y: 560 } as Point,
  npc2LeaveAt: 0,
  npc2Target: { x: 880, y: 560 } as Point,
  npc2PauseUntil: 0,
  elevatorTo: null as string | null,
  elevatorArrivesAt: 0,
  visitedLobby: false,
  thought: null as Thought | null,
  thoughtCooldown: 40,
  selectedObjectId: undefined as string | undefined,
  activeVideoId: undefined as string | undefined,
  ending: null as Ending,
  collapseMinutes: 0,
});

/**
 * Ambient thought bubbles fire on a long cooldown (~50–110 game-minutes) and never repeat the previous
 * line back to back, so silence stays the default. A bubble lives for 3 game-minutes, which the
 * renderer fades in and out over roughly 2–4 real seconds.
 */
const THOUGHT_LIFETIME = 3;
function nextThought(state: GameState, gameMinutes: number): { thought: Thought | null; thoughtCooldown: number } {
  const cooldown = state.thoughtCooldown - gameMinutes;
  if (cooldown > 0) {
    // Retire the current bubble once it has had its moment on screen.
    const expired = state.thought && cooldown < state.thoughtCooldown - THOUGHT_LIFETIME ? null : state.thought;
    return { thought: expired, thoughtCooldown: cooldown };
  }
  const pools: (readonly string[])[] = [THOUGHTS.idle];
  if (state.workingOnMusic) pools.push(THOUGHTS.working, THOUGHTS.music);
  if (state.friendActivity === 'tune') pools.push(THOUGHTS.music);
  if (state.friendActivity === 'video-game' || state.activeVideoId === 'switch') pools.push(THOUGHTS.gaming);
  if (state.activeVideoId === 'anime') pools.push(THOUGHTS.anime);
  if (state.smokingMinutes > 0) pools.push(THOUGHTS.smoking);
  if (state.weather === 'rain' || state.weather === 'hail') pools.push(THOUGHTS.rain);
  if (state.needs.hunger < 35) pools.push(THOUGHTS.hungry);
  if (state.needs.energy < 30) pools.push(THOUGHTS.sleepy);
  if (state.visitorActive && state.visitorPhase === 'arriving') pools.push(THOUGHTS.friend);
  // 4:30–6:00 AM: the sun is actually coming up outside.
  if (state.clock.minuteOfDay >= 270 && state.clock.minuteOfDay <= 360) pools.push(THOUGHTS.sunrise);
  if (state.crystal === 'green') pools.push(THOUGHTS.goodMood);
  if (state.crystal === 'red') pools.push(THOUGHTS.lowMood);
  let text = pickThought(pools);
  if (text === state.thought?.text) text = pickThought(pools); // one reroll keeps repeats rare
  return { thought: { text, n: (state.thought?.n ?? 0) + 1 }, thoughtCooldown: 50 + Math.random() * 60 };
}

function applyNeedChange(needs: ProducerNeeds, changes: NeedChange): ProducerNeeds {
  return Object.fromEntries(Object.entries(needs).map(([key, value]) => [key, clamp(value + (changes[key as keyof ProducerNeeds] ?? 0))])) as ProducerNeeds;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'booting',
  ...initialSession(),
  setPhase: (phase) => set({ phase }),
  hydrateSession: (snapshot) => set((state) => {
    const next = { ...state, ...snapshot } as GameState;
    // Safety net: a save written inside the car with no ride in flight would strand the player in a
    // room with no exit, so put them back in the studio instead.
    if (next.activeLocationId === 'elevator' && !next.elevatorTo) {
      return { ...snapshot, activeLocationId: 'apartment-hallway', playerPosition: { x: 640, y: 620 }, moveTarget: null };
    }
    return snapshot;
  }),
  setDawOpen: (dawOpen) => set({ dawOpen, workingOnMusic: dawOpen ? false : false }),
  setWorkingOnMusic: (workingOnMusic) => set((state) => ({ workingOnMusic: state.dawOpen ? workingOnMusic : false })),
  pause: () => set((state) => (state.phase === 'playing' ? { phase: 'paused' } : state)),
  resume: () => set((state) => (state.phase === 'paused' ? { phase: 'playing' } : state)),
  restart: () => set({ phase: 'playing', ...initialSession() }),
  movePlayer: (direction) => set((state) => {
    if (state.phase !== 'playing') return state;
    // Keyboard steps cancel any active click-to-move target so input stays predictable, and stand the producer up.
    const playerPosition = collisionSafeStep(state.playerPosition, { x: state.playerPosition.x + direction.x, y: state.playerPosition.y + direction.y });
    const friendNearby = state.visitorActive && state.visitorPhase === 'staying' && Math.hypot(playerPosition.x - state.visitorPos.x, playerPosition.y - state.visitorPos.y) < SELECT_RADIUS;
    return { playerPosition, moveTarget: null, seated: false, lyingDown: false, selectedObjectId: friendNearby ? 'visitor' : nearestObjectId(playerPosition) };
  }),
  setMoveTarget: (target) => set((state) => {
    if (state.phase !== 'playing') return state;
    const destination = target.selectId ? approachPoint(state.playerPosition, target.selectId, clampToRoom(target)) : clampToRoom(target);
    return { moveTarget: { ...destination, selectId: target.selectId }, seated: false, lyingDown: false };
  }),
  setRunning: (running) => set((state) => (state.running === running ? state : { running })),
  setEntranceOpen: (entranceOpen) => set((state) => (state.entranceOpen === entranceOpen ? state : { entranceOpen })),
  stepMovement: (deltaMs) => set((state) => {
    if (state.phase !== 'playing' || !state.moveTarget) return state;
    const step = WALK_SPEED * (state.running ? RUN_MULTIPLIER : 1) * (deltaMs / 1000);
    const dx = state.moveTarget.x - state.playerPosition.x;
    const dy = state.moveTarget.y - state.playerPosition.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= Math.max(step, 3)) {
      const playerPosition = collisionSafeStep(state.playerPosition, state.moveTarget);
      // A target can be inside an object's footprint when it came from an old
      // save; stop safely at the edge and still allow the interaction prompt.
      if (Math.hypot(playerPosition.x - state.moveTarget.x, playerPosition.y - state.moveTarget.y) > SELECT_RADIUS && state.moveTarget.selectId) {
        return { playerPosition, moveTarget: null, selectedObjectId: state.moveTarget.selectId };
      }
      return { playerPosition, moveTarget: null, selectedObjectId: state.moveTarget.selectId ?? nearestObjectId(playerPosition) };
    }
    const playerPosition = collisionSafeStep(state.playerPosition, { x: state.playerPosition.x + (dx / distance) * step, y: state.playerPosition.y + (dy / distance) * step });
    return { playerPosition, selectedObjectId: state.moveTarget.selectId ?? nearestObjectId(playerPosition) };
  }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  closeVideo: () => set({ activeVideoId: undefined }),
  openFriendMenu: () => set((state) => state.visitorActive && state.visitorPhase === 'staying' ? { friendMenuOpen: true } : state),
  closeFriendMenu: () => set({ friendMenuOpen: false }),
  returnToStudio: () => set((state) => ({
    activeLocationId: 'apartment-studio',
    playerPosition: { ...ENTRANCE_POSITION },
    moveTarget: null,
    selectedObjectId: undefined,
    // Going all the way down and back is a real trip: it costs a little energy and takes the edge off.
    ...(state.visitedLobby
      ? { visitedLobby: false, needs: applyNeedChange(state.needs, { energy: -4, social: 3 }), stress: clamp(state.stress - 9) }
      : {}),
  })),
  /** The lobby's call button. Raises the same confirmation the studio's button does, so the ride is symmetric. */
  callElevator: () => set((state) => (state.elevatorTo || state.phase !== 'playing' ? state : { prompt: ELEVATOR_PROMPT })),
  doFriendActivity: (kind) => set((state) => {
    if (!state.visitorActive || state.visitorPhase !== 'staying') return state;
    const activities: Record<FriendActivity, { needs: NeedChange; emotions: EmotionalEffect[]; collaboration?: number }> = {
      tune: { needs: { creativity: 12, social: 7, energy: -3 }, emotions: [{ node: 'creativeFlow', direction: 'up' }, { node: 'hope', direction: 'up' }], collaboration: 90 },
      vodka: { needs: { social: 9, love: 5, energy: -5, hygiene: -3 }, emotions: [{ node: 'love', direction: 'up' }, { node: 'addiction', direction: 'up' }] },
      'video-game': { needs: { social: 15, love: 12, energy: 2 }, emotions: [{ node: 'love', direction: 'up' }, { node: 'burnout', direction: 'down' }] },
    };
    const result = activities[kind];
    const emotionalGraph = resolveEmotionGraph(state.emotionalGraph, result.emotions);
    const positions: Record<FriendActivity, { player: Point; friend: Point }> = {
      tune: { player: SIT_POSITION, friend: centerOf('friendChair', { x: 750, y: 480 }) },
      vodka: { player: SIT_POSITION, friend: centerOf('friendChair', { x: 750, y: 480 }) },
      'video-game': { player: SIT_POSITION, friend: centerOf('friendChair', { x: 750, y: 480 }) },
    };
    const pose = positions[kind];
    return { needs: applyNeedChange(state.needs, result.needs), emotionalGraph, crystal: crystalState(emotionalGraph), collaborationMinutes: result.collaboration ?? state.collaborationMinutes, friendMenuOpen: false, activeVideoId: kind === 'video-game' ? 'switch' : undefined, friendActivity: kind, friendActivityMinutes: 90, playerPosition: pose.player, visitorPos: pose.friend, seated: true, workingOnMusic: kind === 'tune', dawOpen: false };
  }),
  tick: (deltaMs) => set((state) => {
    if (state.phase !== 'playing') return state;
    // Slower pacing leaves room for exploration and interactions.
    const gameMinutes = (deltaMs / 1000) * GAME_MINUTES_PER_REAL_SECOND;
    let needs = applyNeedChange(state.needs, Object.fromEntries(Object.entries(decayPerGameMinute).map(([key, value]) => [key, -value * gameMinutes])));
    const weatherMinutes = state.weatherMinutes + gameMinutes;
    const weatherChanged = weatherMinutes >= 180;
    const weatherKinds: WeatherKind[] = ['clear', 'rain', 'rainbow', 'hail'];
    const weather = weatherChanged ? weatherKinds[Math.floor(Math.random() * weatherKinds.length)] : state.weather;
    const badWeather = weather === 'rain' || weather === 'hail';
    if (badWeather) needs = applyNeedChange(needs, { energy: -(weather === 'hail' ? 0.13 : 0.07) * gameMinutes });
    if (state.npc2Active) needs = applyNeedChange(needs, { social: 0.025 * gameMinutes, love: 0.01 * gameMinutes });
    const weatherGraph = weatherChanged && badWeather ? resolveEmotionGraph(state.emotionalGraph, [{ node: 'burnout', direction: 'up' }]) : state.emotionalGraph;
    needs = applyNeedChange(needs, Object.fromEntries(Object.entries(emotionalNeedDrift(weatherGraph)).map(([key, value]) => [key, value * gameMinutes])));
    const totalMinutes = state.clock.minuteOfDay + gameMinutes;
    // This prototype's playable day is midnight through noon. Album progress
    // deliberately does not appear in the reset frame, so it carries forward.
    const dayCount = Math.floor(totalMinutes / 720);
    const dayFinished = dayCount > 0;
    const dailyNeeds: ProducerNeeds = { hunger: 72, energy: 70, hygiene: 66, social: 48, creativity: 62, love: 54 };
    if (dayFinished) needs = dailyNeeds;
    // Stress creeps up over the night — faster under burnout/obsession/loneliness and while grinding, easier when in flow.
    const g = weatherGraph;
    const stressDrift = 0.03 + (g.burnout === 'high' ? 0.07 : 0) + (g.obsession === 'high' ? 0.04 : 0) + (g.loneliness === 'high' ? 0.03 : 0) - (g.creativeFlow === 'high' ? 0.03 : 0) + (state.workingOnMusic ? 0.14 : 0);
    // Wellness boost: when every need is full, the crystal recovers faster (positive graph resolution every ~8 game-min).
    const allFull = Math.min(...Object.values(needs)) >= 95;
    const wellnessAccum = allFull ? state.wellnessMinutes + gameMinutes : 0;
    const wellnessResolve = allFull && wellnessAccum >= 8;
    const baseGraph = wellnessResolve
      ? resolveEmotionGraph(weatherGraph, [{ node: 'hope', direction: 'up' }, { node: 'love', direction: 'up' }, { node: 'burnout', direction: 'down' }, { node: 'loneliness', direction: 'down' }])
      : weatherGraph;
    // Friends never turn up on their own — both NPCs arrive only when the producer invites them
    // from the bedside phone, so an empty room stays empty until that choice is made.
    const elapsedMs = state.elapsedMs + deltaMs;
    const elevatorArrived = state.elevatorTo !== null && elapsedMs >= state.elevatorArrivesAt;
    // Stepping out and coming back costs a little energy and takes the edge off the stress.
    const elevatorFrame = elevatorArrived
      ? {
        activeLocationId: state.elevatorTo as string,
        elevatorTo: null,
        elevatorArrivesAt: 0,
        playerPosition: { x: 640, y: 620 },
        moveTarget: null as MoveTarget,
        selectedObjectId: undefined,
        // Actually reaching the ground floor is what counts as "going outside".
        ...(state.elevatorTo === 'apartment-lobby' ? { visitedLobby: true } : {}),
      }
      : {};
    const thoughtFrame = nextThought(state, gameMinutes);
    const base = {
      elapsedMs,
      needs,
      clock: { day: state.clock.day + dayCount, minuteOfDay: totalMinutes % 720 },
      stress: clamp(state.stress + stressDrift * gameMinutes),
      wellnessMinutes: wellnessResolve ? 0 : wellnessAccum,
      weather,
      weatherMinutes: weatherChanged ? 0 : weatherMinutes,
      collaborationMinutes: Math.max(0, state.collaborationMinutes - gameMinutes),
      guitarNotesMinutes: Math.max(0, state.guitarNotesMinutes - gameMinutes),
      smokingMinutes: Math.max(0, state.smokingMinutes - gameMinutes),
      friendActivity: state.friendActivityMinutes <= gameMinutes ? null : state.friendActivity,
      friendActivityMinutes: Math.max(0, state.friendActivityMinutes - gameMinutes),
      npc2Active: state.npc2Active && state.elapsedMs < state.npc2LeaveAt,
      workingOnMusic: state.friendActivity === 'tune' && state.friendActivityMinutes <= gameMinutes ? false : state.workingOnMusic,
      ...thoughtFrame,
      ...elevatorFrame,
    };
    // Session-frame outcome: a win halts the run immediately; sustained rock-bottom wellbeing collapses it.
    const sessionFrame = (finalNeeds: ProducerNeeds, won: boolean) => {
      if (won) return { phase: 'ending' as GamePhase, ending: 'finished' as Ending };
      const collapseMinutes = wellbeing(finalNeeds) <= COLLAPSE_WELLBEING_FLOOR ? state.collapseMinutes + gameMinutes : 0;
      if (collapseMinutes >= COLLAPSE_SUSTAIN_MINUTES) return { phase: 'ending' as GamePhase, ending: 'collapse' as Ending, collapseMinutes };
      return { collapseMinutes };
    };
    const liveInspiration = Math.max(0, state.inspirationMinutes - gameMinutes);
    const liveConfidence = Math.max(0, Math.min(100, state.confidence + (needs.love - 50) * 0.002 * gameMinutes));
    const liveEnvironment = Math.max(0, Math.min(100, state.environment + (weather === 'clear' ? 0.01 : -0.02) * gameMinutes));
    const liveSleep = Math.max(0, Math.min(100, state.sleep - 0.025 * gameMinutes));
    const liveScore = weightedEmotionalScore(needs, { inspiration: liveInspiration, confidence: liveConfidence, environment: liveEnvironment, sleep: liveSleep }, baseGraph);
    if (!state.workingOnMusic) return { ...base, emotionalGraph: baseGraph, crystal: crystalState(baseGraph, liveScore), inspirationMinutes: liveInspiration, confidence: liveConfidence, environment: liveEnvironment, sleep: liveSleep, ...sessionFrame(needs, false) };

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
    const crystal = crystalState(emotionalGraph, weightedEmotionalScore(needs, { inspiration: liveInspiration, confidence: liveConfidence, environment: liveEnvironment, sleep: liveSleep }, emotionalGraph));
    const crystalMultiplier = crystal === 'green' ? 1.5 : crystal === 'red' ? 0.7 : 1;
    const albumProgress = clamp(state.albumProgress + (state.collaborationMinutes > 0 ? 0.24 : 0.12) * gameMinutes * crystalMultiplier);
    // The album can only be finished once every instrument (incl. the lyric notebook) has been used.
    const albumCompleted = state.albumCompleted || (albumProgress >= 100 && crystal === 'green' && allInstrumentsUsed(state.instrumentsUsed));
    return {
      ...base,
      needs,
      confidence: liveConfidence,
      environment: liveEnvironment,
      sleep: liveSleep,
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
    const emotionalScore = weightedEmotionalScore(state.needs, { inspiration: state.inspirationMinutes, confidence: state.confidence, environment: state.environment, sleep: state.sleep }, emotionalGraph);
    const crystal = crystalState(emotionalGraph, emotionalScore);
    const inspirationMinutes = interaction.inspirationMinutes ? Math.max(state.inspirationMinutes, interaction.inspirationMinutes) : state.inspirationMinutes;
    const sfxCue = { id: interactionId, n: state.sfxCue.n + 1 };
    const instrumentsUsed = INSTRUMENT_IDS.has(interactionId) ? { ...state.instrumentsUsed, [interactionId]: true } : state.instrumentsUsed;
    // The chair toggles sitting; the bed toggles lying. Snap onto the furniture, use again to get up. No playback modal.
    const bonus = INSTRUMENT_BONUS[interactionId] ?? 0;
    if (interaction.action === 'sit') {
      const seated = !state.seated;
      return { seated, lyingDown: false, scrolling: false, playerPosition: seated ? SIT_POSITION : state.playerPosition, moveTarget: null, lastInteraction: interaction, emotionalGraph, crystal, sfxCue, albumProgress: clamp(state.albumProgress + bonus) };
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
    if (interaction.action === 'entrance') {
      return { entranceOpen: true, prompt: LEAVE_STUDIO_PROMPT, seated: false, lyingDown: false, scrolling: false, lastInteraction: interaction, emotionalGraph, crystal, sfxCue };
    }
    // Any other interaction stands the producer up. The entrance swings its door open.
    const entranceOpen = interactionId === 'entrance' ? true : state.entranceOpen;
    const stress = clamp(state.stress + (interaction.stressDelta ?? 0));
    const guitarNotesMinutes = interactionId === 'acousticGuitar' || interactionId === 'electricGuitar' ? 20 : state.guitarNotesMinutes;
    const seatedForAction = interactionId === 'vodka' || interactionId === 'switch';
    const playerPosition = seatedForAction ? SIT_POSITION : state.playerPosition;
    if (interaction.action === 'open-anime') return { needs: applyNeedChange(state.needs, interaction.changes), dawOpen: false, workingOnMusic: false, activeVideoId: 'anime', lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes: Math.max(inspirationMinutes, 20), guitarNotesMinutes, seated: false, lyingDown: false, scrolling: false, entranceOpen, stress, sfxCue, instrumentsUsed, albumProgress: clamp(state.albumProgress + bonus) };
    if (interaction.action === 'open-daw') return { dawOpen: true, workingOnMusic: false, activeVideoId: interaction.id, lastInteraction: interaction, emotionalGraph, crystal, inspirationMinutes, guitarNotesMinutes, seated: false, lyingDown: false, scrolling: false, entranceOpen, stress, sfxCue, instrumentsUsed, albumProgress: clamp(state.albumProgress + bonus) };
    const updatedNeeds = applyNeedChange(state.needs, interaction.changes);
    const updatedScore = weightedEmotionalScore(updatedNeeds, { inspiration: inspirationMinutes, confidence: state.confidence, environment: state.environment, sleep: state.sleep }, emotionalGraph);
    // Lighting a cigarette must not raise the inspect card: it covers the room, and the whole point is
    // to keep walking while the smoking animation plays out.
    const isSmoke = interaction.id === 'cigarettes';
    return { needs: updatedNeeds, activeVideoId: isSmoke ? undefined : interaction.id, guitarNotesMinutes, smokingMinutes: isSmoke ? 10 : state.smokingMinutes, lastInteraction: interaction, emotionalGraph, crystal: crystalState(emotionalGraph, updatedScore), inspirationMinutes, playerPosition, seated: seatedForAction, lyingDown: false, scrolling: false, entranceOpen, stress, sfxCue, instrumentsUsed, albumProgress: clamp(state.albumProgress + bonus) };
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
    if (kind === 'invite-friend-2') {
      return { prompt: null, npc2Active: true, npc2Pos: { x: 880, y: 560 }, npc2Target: { x: 880, y: 560 }, npc2PauseUntil: state.elapsedMs + 900, npc2LeaveAt: state.elapsedMs + 180000, needs: applyNeedChange(state.needs, { social: 10, love: 3 }), stress: clamp(state.stress - 4) };
    }
    if (kind === 'doom-scroll') {
      return { prompt: null, lyingDown: true, scrolling: true, seated: false, playerPosition: LIE_POSITION, moveTarget: null, needs: applyNeedChange(state.needs, { social: -8 }), stress: clamp(state.stress + 6), lastInteraction: interactionById.doomscroll ?? state.lastInteraction };
    }
    if (kind === 'leave-room') {
      // Out through the studio door into the hallway — the elevator is a separate step from there.
      return { prompt: null, activeLocationId: 'apartment-hallway', playerPosition: { x: 640, y: 620 }, moveTarget: null, entranceOpen: false, seated: false, lyingDown: false, selectedObjectId: undefined };
    }
    if (kind === 'elevator-ride') {
      // Step inside; the ride itself plays out in `tick`, which lands the producer on the other floor.
      // The elevator only ever connects the studio floor's hallway with the ground-floor lobby.
      const destination = state.activeLocationId === 'apartment-lobby' ? 'apartment-hallway' : 'apartment-lobby';
      return {
        prompt: null,
        activeLocationId: 'elevator',
        elevatorTo: destination,
        elevatorArrivesAt: state.elapsedMs + ELEVATOR_RIDE_MS,
        playerPosition: { x: 640, y: 560 },
        moveTarget: null,
        entranceOpen: false,
        seated: false,
        lyingDown: false,
        selectedObjectId: undefined,
      };
    }
    // dismiss / close-fridge
    return { prompt: null, fridgeOpen: false };
  }),
  stepVisitor: (deltaMs) => set((state) => {
    if (!state.visitorActive || state.phase !== 'playing') return state;
    const step = 320 * (deltaMs / 1000);
    // Head for the player while visiting, back to the entrance when leaving.
    const goingHome = state.visitorPhase === 'leaving';
    const target = goingHome ? ENTRANCE_POSITION : state.friendActivity ? { x: state.playerPosition.x - 95, y: state.playerPosition.y + 10 } : centerOf('modularSynths', { x: 320, y: 277 });
    const dx = target.x - state.visitorPos.x;
    const dy = target.y - state.visitorPos.y;
    const dist = Math.hypot(dx, dy);
    if (state.visitorPhase === 'arriving' && dist <= 70) {
      // Arrived: a big one-time social boost.
      return { visitorPhase: 'staying' as VisitorPhase, needs: applyNeedChange(state.needs, { social: 45, love: 6 }), stress: clamp(state.stress - 12) };
    }
    if (state.visitorPhase === 'staying') {
      if (state.elapsedMs >= state.visitorLeaveAt) return { visitorPhase: 'leaving' as VisitorPhase };
      // NPC 1's default idle is to walk to the modular rack and work there.
      // Once there, keep the small social benefit without constantly chasing
      // the player around the room.
      if (state.friendActivity || dist <= 45) return { needs: applyNeedChange(state.needs, { social: 0.4 * (deltaMs / 1000) }) };
    }
    if (goingHome && dist <= 40) return { visitorActive: false }; // out the door
    const visitorPos = { x: state.visitorPos.x + (dx / dist) * step, y: state.visitorPos.y + (dy / dist) * step };
    return { visitorPos };
  }),
  /**
   * NPC 2 strolls the room between real destinations instead of tracing a fixed curve: it walks to a
   * point, stands there a moment, then picks somewhere new. The pauses are what give the renderer
   * genuine idle → walking → turning → stopping transitions to animate.
   */
  stepNpc2: (deltaMs) => set((state) => {
    if (!state.npc2Active || state.phase !== 'playing') return state;
    if (state.elapsedMs < state.npc2PauseUntil) return state; // standing still, taking the room in
    const dx = state.npc2Target.x - state.npc2Pos.x;
    const dy = state.npc2Target.y - state.npc2Pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 24) {
      // Arrived — linger for a beat, then wander somewhere else in the open floor.
      return {
        npc2PauseUntil: state.elapsedMs + 1200 + Math.random() * 3200,
        npc2Target: clampToRoom({ x: 300 + Math.random() * 780, y: 380 + Math.random() * 340 }),
      };
    }
    const step = 190 * (deltaMs / 1000); // an unhurried amble, slower than the producer's walk
    return { npc2Pos: { x: state.npc2Pos.x + (dx / dist) * step, y: state.npc2Pos.y + (dy / dist) * step } };
  }),
}));
