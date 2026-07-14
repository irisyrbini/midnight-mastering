import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { CrystalState } from '@/types/game';
import { interactionById } from '@/data/interactions';
import { STUDIO_OBJECTS, type StudioObject } from '@/data/studio-layout';
import { useGameStore } from '@/store/game-store';

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;

/** The only permitted camera configuration for gameplay rooms. */
export const FIXED_ISOMETRIC_CAMERA = {
  yawDegrees: 45,
  pitchDegrees: 52,
  projection: 'near-orthographic',
  playerAnchor: { x: 640, y: 510 },
  crystalClearance: 120,
} as const;

/** Original placeholder-only isometric room. Replace individual drawings with assets later. */
export class StudioScene {
  private readonly root = new Container();
  private readonly world = new Container();
  private readonly tooltip = new Text({ text: '', style: new TextStyle({ fill: '#e7e1d5', fontFamily: 'Arial', fontSize: 16 }) });
  private readonly crystal = new Graphics();
  private readonly playerRig = new Container();
  private targetWorldOffset = { x: 0, y: 0 };
  private walkResetTimer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;

  constructor(stage: Container) {
    stage.addChild(this.root);
    this.root.addChild(this.world);
    this.drawRoom();
    STUDIO_OBJECTS.forEach((object) => this.drawObject(object));
    this.drawPlayerFromBehind();
    this.updateCrystal(useGameStore.getState().crystal);
    this.unsubscribe = useGameStore.subscribe((state, previous) => {
      if (state.crystal !== previous.crystal) this.updateCrystal(state.crystal);
      if (state.playerPosition.x !== previous.playerPosition.x || state.playerPosition.y !== previous.playerPosition.y) this.followPlayer(state.playerPosition.x, state.playerPosition.y);
    });
    this.tooltip.visible = false;
    this.tooltip.position.set(22, 684);
    this.root.addChild(this.tooltip);
  }

  resize(width: number, height: number) {
    const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
    this.root.scale.set(scale);
    this.root.position.set((width - LOGICAL_WIDTH * scale) / 2, (height - LOGICAL_HEIGHT * scale) / 2);
  }

  destroy() { this.unsubscribe?.(); if (this.walkResetTimer) clearTimeout(this.walkResetTimer); this.root.destroy({ children: true }); }

  /** Future movement calls this; framing remains third-person and the rig eases rather than changing camera angle. */
  followPlayer(playerX: number, playerY: number) {
    this.targetWorldOffset = { x: FIXED_ISOMETRIC_CAMERA.playerAnchor.x - playerX, y: FIXED_ISOMETRIC_CAMERA.playerAnchor.y - playerY };
    const ease = () => {
      this.world.x += (this.targetWorldOffset.x - this.world.x) * 0.18;
      this.world.y += (this.targetWorldOffset.y - this.world.y) * 0.18;
      if (Math.abs(this.targetWorldOffset.x - this.world.x) > 0.5 || Math.abs(this.targetWorldOffset.y - this.world.y) > 0.5) requestAnimationFrame(ease);
    };
    requestAnimationFrame(ease);
    this.playerRig.y = -5;
    if (this.walkResetTimer) clearTimeout(this.walkResetTimer);
    this.walkResetTimer = setTimeout(() => { this.playerRig.y = 0; }, 110);
  }

  private drawRoom() {
    const room = new Graphics()
      .poly([105, 126, 836, 34, 1210, 220, 522, 666])
      .fill('#1c2c45')
      .stroke({ color: '#4f8f9c', width: 3, alpha: 0.45 });
    const floor = new Graphics()
      .poly([238, 276, 1010, 170, 1188, 430, 486, 664])
      .fill('#213b58')
      .stroke({ color: '#111525', width: 4, alpha: 0.8 });
    const deskShadow = new Graphics().ellipse(645, 405, 360, 118).fill({ color: '#101525', alpha: 0.42 });
    const desk = new Graphics()
      .poly([386, 238, 842, 182, 1010, 325, 534, 420])
      .fill('#6d5a59')
      .stroke({ color: '#111525', width: 4 })
      .poly([534, 420, 1010, 325, 1006, 390, 553, 500])
      .fill('#3f3944');
    const monitorGlow = new Graphics().ellipse(671, 204, 165, 84).fill({ color: '#4f8f9c', alpha: 0.12 });
    this.world.addChild(room, floor, deskShadow, desk, monitorGlow);
  }

  private drawObject(object: StudioObject) {
    const label = interactionById[object.id].label;
    const node = new Container();
    const depth = Math.max(5, Math.min(12, object.height / 7));
    const shadow = new Graphics().roundRect(object.x + 9, object.y + depth + 10, object.width, object.height, 8).fill({ color: '#101525', alpha: 0.46 });
    const rightFace = new Graphics().poly([object.x + object.width, object.y + 5, object.x + object.width + depth, object.y, object.x + object.width + depth, object.y + object.height - depth, object.x + object.width, object.y + object.height]).fill({ color: '#101525', alpha: 0.58 });
    const frontFace = new Graphics().poly([object.x, object.y + object.height, object.x + object.width, object.y + object.height, object.x + object.width + depth, object.y + object.height - depth, object.x + depth, object.y + object.height - depth]).fill({ color: '#101525', alpha: 0.4 });
    const body = new Graphics()
      .roundRect(object.x, object.y, object.width, object.height, 8)
      .fill(object.color)
      .stroke({ color: '#e7e1d5', width: 2, alpha: 0.58 });
    const highlight = new Graphics().roundRect(object.x + 4, object.y + 4, Math.max(4, object.width - 12), 5, 3).fill({ color: '#ffffff', alpha: 0.16 });
    const details = this.drawObjectDetails(object);
    const tag = new Text({ text: label.toUpperCase(), style: new TextStyle({ fill: '#101525', fontFamily: 'Arial', fontSize: Math.min(10, object.width / 10), fontWeight: 'bold', align: 'center', wordWrap: true, wordWrapWidth: object.width - 10 }) });
    tag.anchor.set(0.5);
    tag.position.set(object.x + object.width / 2, object.y + object.height / 2);
    node.addChild(shadow, rightFace, frontFace, body, highlight, ...details, tag);
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointerover', () => {
      body.tint = 0xe7e1d5;
      body.alpha = 0.84;
      this.tooltip.text = `${label}: ${interactionById[object.id].description}`;
      this.tooltip.visible = true;
    });
    node.on('pointerout', () => { body.tint = 0xffffff; body.alpha = 1; this.tooltip.visible = false; });
    node.on('pointertap', () => useGameStore.getState().interact(object.id));
    this.world.addChild(node);
  }

  /** Small original geometry gives every data-driven placeholder volume and a readable identity. */
  private drawObjectDetails(object: StudioObject): Graphics[] {
    const details: Graphics[] = [];
    if (object.shape === 'window') {
      const frame = new Graphics().rect(object.x + object.width / 2 - 3, object.y + 5, 6, object.height - 10).fill('#111525');
      const city = new Graphics();
      for (let i = 0; i < 9; i += 1) city.rect(object.x + 15 + i * 26, object.y + object.height - 22 - (i % 3) * 9, 12, 17 + (i % 3) * 9).fill('#172439');
      details.push(frame, city);
    }
    if (object.shape === 'light') details.push(new Graphics().roundRect(object.x + 8, object.y + 5, object.width - 16, 4, 2).fill({ color: '#ff8894', alpha: 0.9 }));
    if (object.shape === 'guitar') {
      const guitar = new Graphics().ellipse(object.x + object.width / 2, object.y + object.height * 0.72, object.width * 0.32, object.width * 0.24).fill('#d6a447').stroke({ color: '#111525', width: 2 });
      guitar.roundRect(object.x + object.width / 2 - 4, object.y + 14, 8, object.height * 0.55, 3).fill('#372e2a');
      details.push(guitar);
    }
    if (object.id === 'studioMonitors') details.push(new Graphics().circle(object.x + object.width / 2, object.y + object.height * 0.58, Math.min(18, object.width / 3)).fill('#d6a447').stroke({ color: '#2b2730', width: 4 }));
    if (object.id === 'dualMonitors') {
      const screens = new Graphics().roundRect(object.x + 10, object.y + 10, object.width * 0.4, object.height - 20, 3).fill('#173d4c');
      screens.roundRect(object.x + object.width * 0.54, object.y + 10, object.width * 0.36, object.height - 20, 3).fill('#173d4c');
      details.push(screens);
    }
    if (object.id === 'modularSynths' || object.id === 'portasound' || object.id === 'sk5') {
      const controls = new Graphics();
      for (let i = 0; i < 6; i += 1) controls.circle(object.x + 16 + i * ((object.width - 30) / 5), object.y + object.height * 0.35, 4).fill('#d6a447');
      details.push(controls);
    }
    return details;
  }

  /** Foreground third-person player silhouette; the crystal is deliberately rendered last and never occluded. */
  private drawPlayerFromBehind() {
    const leftLeg = new Graphics().roundRect(592, 544, 42, 94, 18).fill('#171d2b').stroke({ color: '#0b0e17', width: 4 });
    const rightLeg = new Graphics().roundRect(646, 544, 42, 94, 18).fill('#171d2b').stroke({ color: '#0b0e17', width: 4 });
    const shoes = new Graphics().roundRect(581, 626, 57, 20, 9).fill('#090b11').roundRect(642, 626, 57, 20, 9).fill('#090b11');
    const body = new Graphics().roundRect(572, 470, 136, 108, 46).fill('#111722').stroke({ color: '#0b0e17', width: 5 });
    const shoulders = new Graphics().ellipse(640, 518, 112, 54).fill('#26354b');
    const head = new Graphics().circle(640, 450, 45).fill('#181c29').stroke({ color: '#4f5d72', width: 3 });
    const headphones = new Graphics().arc(640, 450, 52, Math.PI, 0).stroke({ color: '#0b0e17', width: 14 });
    const hair = new Graphics().arc(640, 443, 42, Math.PI * 1.06, Math.PI * 1.94).stroke({ color: '#090b11', width: 18 });
    this.playerRig.addChild(leftLeg, rightLeg, shoes, body, shoulders, head, headphones, hair, this.crystal);
    this.root.addChild(this.playerRig);
  }

  private updateCrystal(state: CrystalState) {
    const colors: Record<CrystalState, number> = { red: 0xd84f59, yellow: 0xe6c34c, green: 0x62cf86 };
    const color = colors[state];
    const x = FIXED_ISOMETRIC_CAMERA.playerAnchor.x;
    const y = FIXED_ISOMETRIC_CAMERA.playerAnchor.y - FIXED_ISOMETRIC_CAMERA.crystalClearance - 50;
    const ray = 38;
    this.crystal.clear();
    this.crystal.circle(x, y, 48).fill({ color, alpha: 0.13 });
    this.crystal.circle(x, y, 30).fill({ color, alpha: 0.18 });
    // Three crossed rays create a six-pointed asterisk, not a diamond or a star polygon.
    this.crystal.moveTo(x - ray, y).lineTo(x + ray, y).stroke({ color, width: 10, alpha: 0.25 });
    this.crystal.moveTo(x - ray, y).lineTo(x + ray, y).stroke({ color, width: 5 });
    this.crystal.moveTo(x - ray * 0.5, y - ray * 0.86).lineTo(x + ray * 0.5, y + ray * 0.86).stroke({ color, width: 5 });
    this.crystal.moveTo(x + ray * 0.5, y - ray * 0.86).lineTo(x - ray * 0.5, y + ray * 0.86).stroke({ color, width: 5 });
    this.crystal.circle(x, y, 9).fill({ color: 0xffffff, alpha: 0.72 });
  }
}
