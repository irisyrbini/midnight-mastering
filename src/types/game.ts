export type GamePhase = 'booting' | 'title' | 'playing' | 'paused' | 'ending';

/** Terminal outcome of a run. `finished` = album mastered while well; `collapse` = the night ran out. */
export type Ending = 'finished' | 'collapse' | null;

export type Clock = {
  day: number;
  minuteOfDay: number;
};

export type NeedKey = 'hunger' | 'energy' | 'hygiene' | 'social' | 'creativity' | 'love';

export type ProducerNeeds = Record<NeedKey, number>;

export type NeedChange = Partial<ProducerNeeds>;

export type ProducerNeedsLegacy = {
  energy: number;
  clarity: number;
  connection: number;
};

export type GameSnapshot = {
  phase: GamePhase;
  clock: Clock;
  needs: ProducerNeeds;
  activeLocationId: string;
};

export type Interaction = {
  id: string;
  label: string;
  description: string;
  changes: NeedChange;
  action?: 'open-daw' | 'sit' | 'lie';
  emotionalEffects?: EmotionalEffect[];
  inspirationMinutes?: number;
};

export type EmotionalVariable = 'loneliness' | 'burnout' | 'hope' | 'love' | 'obsession' | 'addiction' | 'creativeFlow';
export type EmotionLevel = 'low' | 'steady' | 'high';
export type EmotionalGraphState = Record<EmotionalVariable, EmotionLevel>;
export type EmotionalEffect = { node: EmotionalVariable; direction: 'up' | 'down' };
export type CrystalState = 'red' | 'yellow' | 'green';
