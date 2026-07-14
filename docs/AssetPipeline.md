# Asset Pipeline

> Source of truth for how art and content enter the game. Reflects current structure (`public/assets/*`, data-driven objects) and the intended production flow.

## 1. Current reality

The game currently renders **from data, not from image assets**. `STUDIO_OBJECTS` (position/size/color) + `INTERACTIONS` (behavior/text) drive the Three.js renderer. Each object is drawn by a **recognizable primitive model** keyed on its id in `RoomObjectModel.tsx` (desk, dual monitors with lit screens, studio speaker with cones, laptop, modular rack with knobs, keyboards, guitars, bottles/cans, doors, mini-fridge, LED strip, etc.); unmapped ids fall back to a shaped block. Desk gear renders on a shared surface height (`DESK_Y`) so it reads as sitting on the desk. The legacy Pixi scene still draws flat placeholders. No sprite/texture/audio assets ship yet.

**Layout is fixed:** models must not change object positions/sizes — those live only in `studio-layout.ts` (see [LevelDesign.md](LevelDesign.md)). A model change is a visual change only.

Directory scaffold (empty categories under `public/assets/`): `sprites`, `images`, `ui`, `audio`, `fonts`.

## 1a. Item inspection media (images / video)

Each interactive item can show an **image or video** in the interaction overlay (like inspecting an item):

1. Drop the file in `public/assets/interactions/` (e.g. `vodka.jpg`, `portasound.mp4`).
2. Register it by object id in `src/data/interaction-media.ts` (`INTERACTION_MEDIA`), e.g. `vodka: { type: 'image', src: '/assets/interactions/vodka.jpg', caption: '…' }`.

Items without an entry fall back to the procedural "session playback" visual (`InteractionVideo.tsx`). See `public/assets/interactions/README.md`.

## 2. Content authoring (available today)

Adding gameplay content requires **no art**:

1. Add a `StudioObject` to `src/data/studio-layout.ts` (id, x, y, w, h, color, shape?).
2. Add a matching `Interaction` to `src/data/interactions.ts` (same id) with `changes`, `emotionalEffects`, optional `action`/`inspirationMinutes`.
3. Both must share the id — label/description lookup and rendering key off it. A missing pair crashes.

This keeps the game fully playable while art is produced in parallel.

## 3. Asset production flow (when real art begins)

```
brief (per Art Bible §12) → source file in assets-source/ (raw, uncommitted to public)
   → export runtime-ready asset → public/assets/<category>/
   → register in a rendering manifest under src/game/rendering
   → reference by id from the data layer
```

**Every asset brief must name:** camera layer, palette tokens, key/fill light source, interaction state, animation loop, VFX/particle allowance, target screen size (see [ArtBible.md](ArtBible.md) §9 and root `ART_BIBLE.md` §12).

## 4. Formats & conventions (target)

| Category | Format | Notes |
|---|---|---|
| Sprites / textures | PNG (or WebP), authored at 2× target, cleanly downsampled | painterly, per Art Bible §3 |
| UI icons | SVG, 2px stroke @24px grid | original line icons, no packs |
| Fonts | woff2 | IBM Plex Sans Condensed, Space Mono |
| Audio | ogg/mp3 | sparse, night-quiet mix |

- Keep raw/source files **outside** `public` (e.g. `assets-source/`); commit only runtime-ready assets under `public/assets`.
- Asset manifests and preload groups belong in `src/game/rendering`.
- No brand marks, recognizable DAW layouts, copyrighted art, or exact real-world product silhouettes.

## 5. Acceptance gate

No asset merges until it passes the [ArtBible.md](ArtBible.md) §9 checklist. Data-only content (new objects/interactions) must keep the window→desk→bed/door reading order and zone semantics from [LevelDesign.md](LevelDesign.md).

## 6. Renderer note

Two renderers currently read the same data: the active **Three.js** path and a legacy **Pixi** scene. When authoring assets, target the Three.js path; the Pixi placeholder is not the shipping view (see [GDD.md](GDD.md) §7).
