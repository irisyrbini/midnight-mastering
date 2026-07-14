import { Application } from 'pixi.js';
import { StudioScene } from './scenes/StudioScene';

/** Rendering owns canvas setup. Scenes mount beneath this app without touching UI state. */
export async function createPixiStage(host: HTMLElement) {
  const app = new Application();
  await app.init({ resizeTo: host, backgroundColor: '#171722', antialias: false });
  host.appendChild(app.canvas);
  const scene = new StudioScene(app.stage);
  scene.resize(host.clientWidth, host.clientHeight);
  return { app, scene };
}
