export type FrameSystem = (deltaMs: number) => void;

/** Owns requestAnimationFrame; systems remain pure, independently testable modules. */
export class GameLoop {
  private animationFrame?: number;
  private lastTime = 0;

  constructor(private readonly systems: FrameSystem[]) {}

  start() {
    const tick = (now: number) => {
      const deltaMs = Math.min(now - this.lastTime, 100);
      this.lastTime = now;
      this.systems.forEach((system) => system(deltaMs));
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.lastTime = performance.now();
    this.animationFrame = requestAnimationFrame(tick);
  }

  stop() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
  }
}
