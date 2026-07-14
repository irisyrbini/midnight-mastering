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

## 9. Acceptance checklist

Before approving an asset: original (no reference copying) · follows locked high-iso painterly blue/red direction · reads from the fixed camera · cool-night + single-warm-anchor hierarchy · palette ratios respected · readable silhouette at gameplay scale · compatible with UI safe zones · restrained motion/bloom/shadows · represents emotional health with care.
