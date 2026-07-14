import type { FrameSystem } from '@/game/core/GameLoop';

/** Placeholder boundary for keyboard, pointer, and accessibility command input. */
export function createInputSystem(): FrameSystem {
  return () => {};
}
