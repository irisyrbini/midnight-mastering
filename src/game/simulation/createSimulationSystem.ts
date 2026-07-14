import type { FrameSystem } from '@/game/core/GameLoop';
import { useGameStore } from '@/store/game-store';

/** Future simulation systems update Zustand through explicit actions, not per-frame React state. */
export function createSimulationSystem(): FrameSystem {
  return (deltaMs) => {
    const store = useGameStore.getState();
    store.tick(deltaMs);
    store.stepMovement(deltaMs); // eases the producer toward any click-to-move target
  };
}
