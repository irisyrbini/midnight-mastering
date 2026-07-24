# Art Bible (canonical summary)

> **Binding visual specification.** This is the `/docs` canonical entry point for art direction. The full, detailed v1.0 specification lives in the repository root as [`ART_BIBLE.md`](../ART_BIBLE.md) — that file remains authoritative for exact numbers; this page is the fast reference and must stay consistent with it. Any visual exception requires editing the root Art Bible first.

## 1. Visual thesis

An original nocturnal emotional simulation. It should feel like being awake after everyone has gone home: private, cluttered, tender, slightly unreal, cozy in the immediate workspace, dystopian beyond the windows. Warm human focus inside a cool, sleeping world.

### Non-negotiable rules

1. One warm emotional anchor surrounded by blue-black nocturne, every scene.
2. Legibility through hierarchy — interaction targets and status read immediately.
3. Stylized material truth — objects look touched, used, specific.
4. Stillness carries emotion — big moves/effects need narrative weight.
5. Never literalize distress as horror.

## 2. Camera (fixed contract)

- **Never first-person.** The producer is observed in a miniature room.
- High isometric three-quarter "dollhouse" view: ~45° yaw, ~52–58° downward pitch, near-orthographic.
- The player's whole body and the six-ray emotional crystal are always in the safe frame; the crystal owns clear negative space above the head and is never occluded.
- Ease-out 250–500ms, no overshoot; no zoom-punch, no handheld shake.
- **Deviation (user-requested, current build):** the R3F view allows **player-controlled mouse-drag orbit + zoom** (`CameraRig` / `OrbitControls`) around a **fixed room-centre axis**, constrained to a high three-quarter band (polar angle ≈ 29–83°, `enablePan={false}`) so the dollhouse feel and crystal clearance are preserved. The axis is intentionally fixed (not player-following) so the producer visibly walks across the room under WASD/click. This supersedes the strict "never rotate" rule *for interactive camera control only*; automatic/cinematic camera moves still follow the no-rotation, nudge-only rule. The legacy Pixi scene keeps the fixed `FIXED_ISOMETRIC_CAMERA`.

## 3. Rendering style

Semi-realistic anime-inspired 2.5D night interior: soft painterly surfaces, clean navy/indigo contour lines (never pure black), cinematic shading, soft volumetric light. Not photoreal, not flat cel, not pixel art. Highest detail on desk, hands, face-adjacent items, instrument controls, current task.

## 4. Palette

| Token | Hex | Use |
|---|---|---|
| Night ink | `#111525` | deepest shadow, outer field |
| Blue slate | `#1C2C45` | walls, furniture shadow |
| Studio blue | `#284A67` | ambient night fill, glass |
| Haze teal | `#4F8F9C` | monitors, reflected light |
| Paper bone | `#E7E1D5` | text, labels, pale objects |
| Dust rose | `#B87882` | vulnerability, low states |
| Signal amber | `#D6A447` | task focus, tungsten practicals |
| Signal red | `#B73545` | dystopian signage, danger |
| Ember coral | `#D85D58` | urgency, record-state accents |
| Moss | `#6D9C7B` | steadiness, recovery |

**Ratio:** ~55% night ink/blue slate, 25% studio blue/haze teal, 15% neutrals, **max 5% saturated red/coral** reserved for meaning (active recording, critical decision, high-priority alert). One warm task light (amber) + one lower red counterpoint per scene.

> Tailwind currently exposes a reduced token set (`night #101018`, `paper #ece7dc`, `ember #e26d45`). Treat the table above as target; reconcile Tailwind tokens toward it when touching theme.

## 5. Lighting, bloom, shadows

- Cool-blue ambient base; one warm practical 2–3 stops brighter as the emotional center; a small red counterpoint.
- Bloom only on emissives (threshold 0.72, intensity 0.18–0.28). Never bloom text/HUD/outlines. Reduce bloom under stress before increasing it.
- **Implemented:** a selective `<Bloom>` pass (`@react-three/postprocessing` `EffectComposer`, `luminanceThreshold ~0.62`, `mipmapBlur`) blooms only bright emissives — the computer screens (rendered `toneMapped={false}`), LED strip, and the crystal. HUD is DOM, so it never blooms.
- Soft cool-navy contact shadows; no prop disappears into shadow without a readable rim.

## 6. Objects & characters

- Objects: rounded believable proportions, slightly exaggerated silhouettes, modular families (`hero / interactive / set-dressing / consumable / story-token`). Active object gets rim/outline on focus only.
- Character: contemporary, non-celebrity, emotionally grounded; silhouette and posture over facial realism; slightly large hands for music-making readability; no chibi, no fashion elongation. State shown through pose tempo, head angle, lighting — never exaggerated distress.

## 7. UI, type, icons

- Quiet diegetic instrument panel: smoke-tinted glass, thin borders, paper text. Left status rail, upper-right context card, center kept clear.
- Type: `IBM Plex Sans Condensed` (body/labels), `Space Mono` (numbers/time). Sentence case. Near-white, never pure white. Min 14px essential text.
- Icons: original round-corner line icons, 2px stroke @24px grid, concrete and emotionally neutral. No emoji, no stock packs, no clichés.

## 8. Animation, effects, particles

- Human, slightly tired tempo; idle loops 2–6s, offset per object. Ease-out UI, sine breathing lights.
- Effects restrained: low-opacity reflections, faint scanlines, rain, 2–4% grain. No lens flare, glitch spam, heavy DoF, neon fog.
- Particles sparse (8–25 typical, 60 max), slow, colored from the active light at 15–45% opacity. No confetti/sparks/hearts.
- Honor `prefers-reduced-motion`.

### 8a. Character rigs

All figures are posed from jointed groups, never rigid meshes, so animation reads as body language rather than sliding props.

- **Producer / friend upper body** — arms hinge at the shoulder with a second joint at the elbow; head, hood and headphones pivot together at the neck. This rig is what the seated groove drives.
- **Seated groove** (`useGroove`, both characters simultaneously while `friendActivity === 'tune'`): the upper body rocks forward and back on the beat, arms swing, forearms sweep side to side, shoulders lift alternately, and the head nods — with an emphatic nod every few bars. Every few bars the groove escalates into a **hype burst**: a `hype` weight rises and both hands punch up above shoulder height as if celebrating the drop, the chin lifts and the torso straightens, before settling back into the low swing. So the loop alternates low and high arm work rather than repeating one motion — measured, the hands sit *below* the shoulder through the whole low beat and *above* it through the whole burst, which occupies ~15% of a ~22s loop. The friend runs a 0.9s phase offset so the pair reads as two people, not a mirrored pair. The whole loop eases in and out via a single weight, so it never snaps on or off.
- **NPC 2 walk cycle** — hips and knees drive a real stride (only the leg swinging through bends at the knee), arms counter-swing, the body bounces and rolls slightly per step and leans into the walk, the head counter-bobs to stay level while walking and glances around while idle. A single eased `gait` weight blends idle ↔ walking, and the figure turns through corners rather than snapping to a new heading.
- **Smoking** — one drag, played through once and then put away. A plain **white** cigarette with a buff filter and a **red coal** at the tip (which brightens, with a matching point light, while drawing): raise to the mouth (1.1s) → inhale (0.9s) → hold the breath (0.5s) → lower while exhaling (1.2s) → rest at the side (1.3s). That is ~5s total, which is exactly how long `smokingMinutes` lasts, so the animation ends and the cigarette disappears on its own. The phase **clamps rather than wraps**, so it never restarts mid-way. Soft voxel smoke puffs rise with a slight wander and fade: a thin trickle from the lit tip throughout, a slower wider cloud from the mouth on the exhale.
- **Rain** — straight vertical streaks only, recycled inside the window pane. Never diagonal, never inside the room.

### 8b. The bed

A complete piece of furniture, not a bare mattress: a wooden frame on four legs, a **slatted headboard** with a capping rail at the head (−x, where the producer's head rests when lying down), a lower footboard, a mattress, a turned-back top sheet and **two pillows**. The bedding set is **soft pastel pink (`#f2c3ce`) with green stripes (`#7fae86`)** — three stripes across the duvet and one across each pillow. Cosy and domestic against the room's cool blues; it is the one warm, soft surface in a room otherwise made of gear.

### 8c. Ambient thought bubbles

The producer **never speaks** — there is no dialogue system. Instead a very small bubble occasionally fades in above the head, holds ~2.6s and fades out. It carries **mood, not information**: overwhelmingly a single symbol (`…  ♪  ♬  ?  !  ♥  ☕  💤  🍜  🎮  💡  🌧  ☀  🚬`), and only rarely a one- or two-word thought ("Hm." / "Nice." / "Sleep." / "Morning."). Content is chosen from pools matched to what is happening right now — working, making music, smoking, gaming, watching anime, rain, hunger, tiredness, a friend arriving, sunrise, and the crystal's mood — always mixed with the neutral idle pool.

Bubbles are on a **long cooldown** (50–110 game-minutes) and never repeat the previous line back to back. They must never interrupt play, never gate information, and never become chatter: **silence is the default state of this game**, and the bubbles are punctuation in it.

## 9. Acceptance checklist

Before approving an asset: original (no reference copying) · follows locked high-iso painterly blue/red direction · reads from the fixed camera · cool-night + single-warm-anchor hierarchy · palette ratios respected · readable silhouette at gameplay scale · compatible with UI safe zones · restrained motion/bloom/shadows · represents emotional health with care.
