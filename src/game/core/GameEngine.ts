import { GameLoop } from './GameLoop';
import { createInputSystem } from '@/game/input/createInputSystem';
import { createSimulationSystem } from '@/game/simulation/createSimulationSystem';
import { useGameStore } from '@/store/game-store';

/** Composes systems. Gameplay rules belong in simulation, never React components. */
export class GameEngine {
  private readonly loop = new GameLoop([
    createInputSystem(),
    createSimulationSystem(),
  ]);

  start() { useGameStore.getState().setPhase('playing'); this.loop.start(); }
  stop() { this.loop.stop(); }
}
