# Midnight Mastering — architecture

This is an original, browser-based emotional simulation. It deliberately contains no gameplay implementation yet.

## Boundaries

`src/app` is the Next.js route and document shell. `src/components` is React-only: `game` mounts the canvas/engine and `ui` provides accessible DOM overlays. React never draws the world.

`src/game` is framework-light runtime code. `core/GameLoop.ts` owns one `requestAnimationFrame` loop. `GameEngine.ts` composes input and simulation systems; later it will also compose rendering-sync, audio, events, and save systems. Each system receives a capped frame delta, so a background-tab return cannot produce an enormous simulation jump.

`src/game/rendering` owns Pixi application lifecycle, scenes, and visual systems. `scenes` should map to locations or high-level views; `systems` should hold camera, sprite animation, lighting, and effects. Pixi is isolated here so it can be replaced or tested independently of the simulation.

`src/game/simulation` will contain deterministic domain rules: time, producer wellbeing, relationships, creative work, and narrative events. `entities` will hold plain data/entity definitions. Simulation must not import React or Pixi.

`src/store` contains Zustand state. `game-store` holds durable, UI-observable session snapshots; `ui-store` holds transient panel state. Keep high-frequency renderer-only values outside Zustand, and publish only meaningful state transitions to avoid React rerendering every frame.

## Assets

`public/assets/sprites`, `images`, `ui`, `audio`, and `fonts` separate source categories early. Keep raw/source files outside `public` later (for example `assets-source/`) and commit only runtime-ready assets beneath `public`. Asset manifests and preload groups belong in `src/game/rendering` once real assets exist.

## Intended data flow

`input → game systems → Zustand game snapshot → React HUD`\
`             ↘ Pixi scene/systems`

The two outputs share the same meaningful simulation state but do not render through each other. This keeps the early-2000s visual language, responsive simulation, and accessible interface from becoming coupled.

## Growth points (not implemented)

- `src/features/session`: save/load and migration boundaries.
- `src/lib`: serialisation, RNG, date/time helpers, and content loading.
- `src/data`: authored tracks, events, locations, and dialogue when narrative content begins.
- `src/types`: shared contracts only; avoid a catch-all global state type.
