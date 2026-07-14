import type { CrystalState, EmotionalEffect, EmotionalGraphState, EmotionalVariable, NeedChange } from '@/types/game';

const LEVELS = ['low', 'steady', 'high'] as const;

export const INITIAL_EMOTIONAL_GRAPH: EmotionalGraphState = {
  loneliness: 'high', burnout: 'steady', hope: 'low', love: 'low', obsession: 'steady', addiction: 'low', creativeFlow: 'low',
};

/** The crystal is a compact, player-facing reading of the hidden emotional graph. */
export function crystalState(graph: EmotionalGraphState): CrystalState {
  if (graph.hope === 'low' || graph.loneliness === 'high' || graph.burnout === 'high') return 'red';
  if (graph.hope === 'high' && graph.love === 'high' && graph.loneliness === 'low' && graph.addiction !== 'high') return 'green';
  return 'yellow';
}

const LEVEL_VALUE: Record<EmotionalGraphState[EmotionalVariable], number> = { low: 0, steady: 1, high: 2 };
const POSITIVE_NODES: EmotionalVariable[] = ['hope', 'love', 'creativeFlow'];
const NEGATIVE_NODES: EmotionalVariable[] = ['loneliness', 'burnout', 'obsession', 'addiction'];

/** A single 0–100 read of emotional wellbeing, so the HUD can show the crystal state moving as a percentage. */
export function emotionalScore(graph: EmotionalGraphState): number {
  const positive = POSITIVE_NODES.reduce((sum, node) => sum + LEVEL_VALUE[graph[node]], 0); // 0..6
  const negative = NEGATIVE_NODES.reduce((sum, node) => sum + LEVEL_VALUE[graph[node]], 0); // 0..8
  const raw = (positive - negative + 8) / 14; // normalise (-8..6) → 0..1
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

type Relationship = {
  source: EmotionalVariable;
  level: (typeof LEVELS)[number];
  target: EmotionalVariable;
  direction: EmotionalEffect['direction'];
};

/** Directed influence graph. Rules are intentionally declarative, inspectable, and extendable. */
export const EMOTIONAL_RELATIONSHIPS: Relationship[] = [
  { source: 'burnout', level: 'high', target: 'creativeFlow', direction: 'down' },
  { source: 'loneliness', level: 'high', target: 'obsession', direction: 'up' },
  { source: 'love', level: 'high', target: 'hope', direction: 'up' },
  { source: 'hope', level: 'low', target: 'burnout', direction: 'up' },
  { source: 'creativeFlow', level: 'high', target: 'hope', direction: 'up' },
  { source: 'addiction', level: 'high', target: 'love', direction: 'down' },
  { source: 'obsession', level: 'high', target: 'burnout', direction: 'up' },
];

function shift(level: (typeof LEVELS)[number], direction: EmotionalEffect['direction']) {
  const index = LEVELS.indexOf(level);
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index + (direction === 'up' ? 1 : -1)))];
}

/** Applies an action edge, then one graph propagation step. No emotional quantity is stored as a number. */
export function resolveEmotionGraph(graph: EmotionalGraphState, effects: EmotionalEffect[] = []): EmotionalGraphState {
  const next = { ...graph };
  for (const effect of effects) next[effect.node] = shift(next[effect.node], effect.direction);
  for (const rule of EMOTIONAL_RELATIONSHIPS) {
    if (next[rule.source] === rule.level) next[rule.target] = shift(next[rule.target], rule.direction);
  }
  return next;
}

/** Emotional states have concrete consequences without exposing their implementation to the HUD. */
export function emotionalNeedDrift(graph: EmotionalGraphState): NeedChange {
  const drift: NeedChange = {};
  if (graph.burnout === 'high') drift.creativity = -0.14;
  if (graph.addiction === 'high') drift.hygiene = -0.16;
  if (graph.loneliness === 'high') drift.social = -0.08;
  if (graph.creativeFlow === 'high') drift.creativity = (drift.creativity ?? 0) + 0.08;
  return drift;
}
