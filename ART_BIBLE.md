# Midnight Mastering — Art Bible v1.0

**Status:** binding visual specification. Every environment, character, prop, interface, effect, and promotional image must follow this document unless this file is revised first.

## Reference-direction lock

The attached scene is the direction reference for **visual qualities only**. Future artwork must consistently use its high isometric room view, semi-realistic anime-inspired painterly finish, clean silhouette linework, cinematic blue/red night lighting, dense studio detail, and environment-integrated game HUD feeling. Create all compositions, characters, icons, furniture, screens, props, labels, and symbols from scratch; do not reproduce reference-specific layouts, characters, object arrangements, screen content, or UI designs.

## 1. Visual thesis

*Midnight Mastering* is an original nocturnal emotional simulation about an isolated producer trying to complete an album without losing contact with themself. The image should feel like being awake after everyone else has gone home: private, cluttered, tender, slightly unreal, physically lived-in, cozy in its immediate workspace, and dystopian beyond its windows.

The provided reference establishes the desired **mood language**—an intimate overhead room, cold night around warm creative light, dense music-making objects, and quiet personal stakes. It is not a source for copied layouts, characters, objects, UI, symbols, or scenes.

### Non-negotiable visual rules

1. **Warm human focus inside a cool, sleeping world.** Every primary scene has one warm emotional anchor surrounded by blue-black nocturne.
2. **Legibility through hierarchy, not emptiness.** Rooms may be layered and lived-in, but interaction targets and player status must read immediately.
3. **Stylized material truth.** Objects must look touched, used, repaired, and specific; avoid sterile tech-demo surfaces.
4. **Stillness carries emotion.** The visual system is restrained. A flashing alert, large camera move, or intense effect must have narrative weight.
5. **Never literalize distress as horror.** Mental-health states use light, rhythm, density, and sound-adjacent visual metaphor—not monsters, body distortion, or shock imagery.

## 2. Camera angle and perspective

### Fixed third-person camera contract

- This is **never** a first-person game. The player is observed and managed inside a miniature room.
- The camera is locked to a high, behind-the-player isometric view: approximately **45° yaw** and **45–58° downward pitch**.
- The player’s whole body, chair/feet when seated, the immediate room, and the full six-ray emotional crystal are always inside the safe frame.
- The crystal must occupy clear negative space above the head. No furniture, HUD, ceiling edge, or effect may occlude it.
- Camera follow may translate smoothly to preserve this composition when movement exists. It must not rotate, zoom-punch, change projection, or enter first-person.

### Primary camera

- **Angle:** high isometric three-quarter “dollhouse” view, looking down approximately **58°** from horizontal.
- **Yaw:** orient rooms on a stable diagonal isometric grid, normally **35–45° clockwise** from the primary room wall. Keep this exact camera family across locations.
- **Projection:** near-orthographic/isometric. Parallel desk, keyboard, shelf, and architectural edges remain largely parallel; do not use wide-angle perspective.
- **Composition:** the protagonist is normally in the lower third or lower-middle; the work surface and emotional focal object occupy centre/upper centre. Keep a calm negative-space lane along one side for UI.
- **Scale:** one room fills 75–90% of the playable viewport. Important props need a minimum screen footprint of 32px at 1440px viewport width.

### Camera behavior

- Default camera is fixed and contemplative.
- Allow only short 2–4% framing nudges for a meaningful action or an event reveal.
- Never rotate the camera during ordinary play. Never use handheld shake; use a 1–2px, low-frequency settle only for rare emotional impact.
- Use smooth ease-out moves (250–500ms) with no elastic overshoot.

## 3. Rendering style

**Style:** a semi-realistic anime-inspired 2.5D night interior: soft painterly surfaces, clean controlled linework, cinematic shading, soft volumetric light, and rich pixel-free material texture. It is not photorealistic, not flat cel-shaded, and not retro pixel art.

- Work at a master resolution of 2× target display; downsample cleanly.
- Use dark navy/indigo contour lines, never pure black outlines. Outer silhouette: 2–3px at 1080p. Interior detail: 1px or implied by value.
- Planes are gently simplified but materially convincing: painterly value transitions sit beneath crisp silhouette and object-edge linework. Reserve the highest detail for the desk, hands, face-adjacent items, instrument controls, and current task.
- Surface texture: subtle paper grain, dust, fabric weave, scuffed plastic, brushed metal, laminate reflection, and cable rubber. Texture opacity is normally 3–9%; texture follows each object’s form rather than sitting as a uniform overlay.
- Avoid glossy, pristine, hyper-detailed product renders; every practical object has a small imperfection or sign of ownership.

## 4. Color palette

### Core palette

| Token | Hex | Use |
|---|---:|---|
| Night ink | `#111525` | deepest room shadow, outer field |
| Blue slate | `#1C2C45` | walls, furniture shadow |
| Studio blue | `#284A67` | ambient night fill, glass |
| Haze teal | `#4F8F9C` | monitors, distant reflected light |
| Paper bone | `#E7E1D5` | text, labels, pale objects |
| Dust rose | `#B87882` | vulnerability, low-resource states |
| Signal amber | `#D6A447` | task focus, tungsten practicals |
| Signal red | `#B73545` | distant dystopian signage, danger, pressure |
| Ember coral | `#D85D58` | urgency, record-state accents |
| Moss | `#6D9C7B` | steadiness, recovery, safe interaction |

### Ratio and application

- Scene average: 55% Night ink/Blue slate, 25% Studio blue/Haze teal, 15% desaturated material neutrals, **maximum 5% saturated red/coral accent**.
- Every night studio scene includes a blue/cyan ambient field and one selective red/coral signal source; amber remains the intimate task light. Red must stay localized to LEDs, city glow, record controls, warning light, or an emotional focal point.
- UI uses Paper bone at 90% opacity for primary type, 60% for secondary labels. State colors always pair hue with label, icon, and fill level.
- Reserve saturated red for active recording, a critical decision, or a high-priority notification. It never decorates a scene.

## 5. Lighting, bloom, and shadows

### Lighting design

- Base lighting is a cinematic cool-blue ambient fill from windows, screens, or nighttime exterior.
- One warm practical (desk lamp, monitor image, small appliance) creates the emotional centre. It should be 2–3 stops brighter than the ambient room.
- A small red/magenta practical or exterior signal creates a second, lower-intensity counterpoint. It gives long edges and reflective props a restrained red kiss without overwhelming the warm focus.
- Screens emit cool cyan/teal and lightly illuminate nearby knuckles, desk edges, bottles, and cables; they do not blow out the whole scene.
- Use soft localized pools, falloff, and reflected colour. Do not use a flat full-room overlay.

### Bloom

- Bloom is cinematic, not foggy: threshold **0.72**, intensity **0.18–0.28**, radius **0.35–0.50** relative to the renderer preset.
- Only emissives bloom: lamps, screen highlights, LED strips, city lights, and rare emotional motifs.
- Text, HUD frames, and interaction outlines must not bloom.
- During stress, reduce bloom before increasing it; overexposure is reserved for a rare breakthrough or dissociative beat and is time-limited.

### Shadows

- Use soft contact shadows directly beneath objects and furniture (70–85% opacity at source, broad falloff).
- Cast shadows are cool navy, never neutral gray or true black. Warm key light may produce a faint warm penumbra at the source edge.
- Keep important interaction silhouettes distinct; no prop may disappear into a shadow without a readable rim or value separation.

## 6. Environment and object language

### Environments

- Locations are compact and specific: home studio, late-night convenience store, laundromat, stairwell, rooftop, friend’s kitchen, quiet bar, transit platform. Each holds evidence of routine and unfinished work.
- Build scenes in layers: architectural shell → large furniture → work surfaces → personal clutter → light and atmosphere → interaction markers.
- Favor asymmetry, cable paths, stacked media, folded fabric, taped notes, half-filled cups, practical containers, and wear patterns. The room’s inner circle is warm and cared for; its perimeter suggests an impersonal, surveilled, or overbuilt city without relying on overt cyberpunk clichés.
- No brand marks, recognizable DAW layouts, copyrighted album art, or exact real-world consumer product silhouettes.
- Windows imply an exterior rather than becoming a second scene: rain, distant apartments, train light, weak dawn, or a colour field.

### Objects

- Objects have rounded, believable proportions with slightly exaggerated silhouettes for readability.
- The active object is lit, separated in value, and receives a quiet outline/rim only on hover or controller focus.
- Create props as modular families: `hero`, `interactive`, `set-dressing`, `consumable`, `story-token`. Hero props receive the most texture and unique detail.
- Clutter tells a story but cannot resemble an uncurated asset pile. Use 3–5 repeated materials per room to unify it.

## 7. Character language

- Character design is contemporary, non-celebrity, and emotionally grounded. Silhouette and posture do more work than facial realism.
- At primary camera distance, faces are simplified; use hair shape, shoulders, hand placement, and clothing drape to convey state.
- Protagonist palette is muted and low contrast against the room; a small personal accent (thread, sock, keychain, nail colour) may identify them.
- Anatomy is naturalistic but gently stylized: slightly large hands for music-making readability; no chibi proportions; no fashion-illustration elongation.
- Emotional states are communicated through pose tempo, head angle, gesture economy, lighting, and environment response. Avoid exaggerated crying, frantic flailing, or visual “madness” tropes.

## 8. UI language, typography, and icons

### UI language

The interface is a **quiet instrument panel embedded in the room**, not a desktop app and not a decorative game HUD. It should feel like translucent smoke-tinted glass, thin technical borders, soft paper text, and tactile controls: a diegetic extension of the producer’s equipment and late-night visual field.

- Place persistent status in a left-side vertical rail and time/context in a small upper-right card; preserve the centre for the room. Panel depth, tiny reflections, and scene-colour bleed should make the HUD feel physically present over the environment, while it remains crisp and readable.
- Panels use `#111525` at 78–86% opacity, 12–16px radius, 1px `#E7E1D5` border at 40–55% opacity, and a 10–18px diffuse shadow.
- Use generous 12–16px internal padding and 12px rhythm. Never crowd the frame with panels.
- Bars are 8px high with a 1px light border. Use a muted track and a single semantic fill; gradients are prohibited.
- Alerts appear as one-line cards with a quiet icon and actionable wording. Stack at most three; condense older notices into a log.
- UI appears instantly at boot, transitions at 160–220ms ease-out, and never blocks the play scene without a deliberate pause state.

### Typography

- **Primary:** `IBM Plex Sans Condensed` (fallback: `Arial Narrow`, sans-serif). It carries intimate technical clarity.
- **Display / numbers:** `Space Mono` (fallback: `ui-monospace`, monospace) for time, level values, mixers, and metadata.
- Sentence case only. Avoid all-caps except compact key labels of three characters or fewer.
- HUD label: 18px / 1.15; HUD value: 16px / 1.2; panel heading: 24px / 1.1; body: 15px / 1.45. Never go below 14px for essential text.
- Type is near-white, never pure white. Do not use outlined, glowing, or italic body text.

### Icon style

- Use original, round-corner line icons: 2px stroke at 24px base grid, 1.5px secondary detail, rounded caps/joins.
- Icons are concrete and emotionally neutral (lamp, note, cup, headphones, message, moon), with a companion text label on first use.
- Use filled icon states sparingly for selected/urgent actions; no emoji, stock icon packs, skulls, broken-heart clichés, or reaction GIF language.

## 9. Animation principles

- **Tempo:** human, slightly tired, precise. Most idle loops are 2–6 seconds and offset per object to avoid synchronization.
- **Easing:** cubic ease-out for interface/camera; sine in-out for breathing lights; short hold before a change in emotional state.
- **Character:** animate weight shift, shoulder rise, finger taps, chair roll, cable sway, screen glow, and small environmental life. Keep gestures economical.
- **UI:** use opacity and 4–8px translation; never bounce, spring, wobble, or make arcade-like reward explosions.
- **State change:** show it through a small cause-and-effect sequence—action, pause, changed light/UI value, subtle environment response.
- Honor `prefers-reduced-motion`: remove camera movement, reduce particle velocity, and replace pulsing with static state cues.

## 10. Effects and particles

### Visual effects

- Use low-opacity screen reflections, faint monitor scan texture, window rain trails, drifting haze, soft chromatic fringe only on rare tension events.
- Add film grain at 2–4% opacity; it must not crawl aggressively or obscure UI.
- Do not use lens flare, glitch spam, strong depth of field, neon fog, heavy vignette, or constant chromatic aberration.

### Particle effects

- Allowed particle families: dust motes in a lamp cone, rain outside window, tiny screen phosphor drift, slow vapor from a cup, occasional tape/static fragments during a memory cue.
- Particles are sparse: normally **8–25 visible** in a room, maximum **60** in a special moment. They move slowly, are small, and fade before touching a UI edge.
- Particle colours are derived from the active light source at 15–45% opacity. No confetti, sparks, hearts, or reward bursts.

## 11. Asset acceptance checklist

Before approving any asset, verify:

- [ ] It is original and does not reproduce reference-specific people, screen images, props, composition, or UI.
- [ ] It follows the locked high-isometric, semi-realistic anime-inspired, painterly blue/red studio direction.
- [ ] It reads from the fixed high three-quarter orthographic camera.
- [ ] It supports the cool-night / single-warm-anchor hierarchy.
- [ ] It uses the palette ratios and reserves saturation for meaning.
- [ ] It has a readable silhouette at gameplay scale and purposeful material wear.
- [ ] It is compatible with the UI safe zones and does not compete with status information.
- [ ] Its motion, particles, bloom, and shadows are restrained and accessible.
- [ ] It represents emotional health with care, avoiding stigmatizing visual shorthand.

## 12. Implementation handoff

Store this document as the source of truth. When asset production begins, each asset brief must name: camera layer, palette tokens, key/fill light source, interaction state, animation loop, VFX/particle allowance, and target screen size. Any exception requires an explicit Art Bible version update.
