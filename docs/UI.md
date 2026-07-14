# UI

> Source of truth for the interface layer. Mirrors `src/components/ui/*` and `src/store/ui-store.ts`. UI is React DOM overlaid on the Three.js world — React never draws the world.

## 1. Language

A **quiet instrument panel embedded in the room** (see [ArtBible.md](ArtBible.md) §8): smoke-tinted glass panels, thin paper-bone borders, monospace numerics. Panels use `bg-night/80–90` with `border-paper/40` and `backdrop-blur`. Persistent status lives in a **left rail**; time/context in an **upper-right card**; the center stays clear for the room.

## 2. Persistent HUD (`GameHud.tsx`)

- **Title header (top center):** in-game title *Make Me Happy Again* + objective line.
- **Status rail (top left):** the six needs as labeled bars with rounded fills and numeric read-outs (`Math.round`).
- **Clock card (top right):** `DAY n` + 12-hour formatted time (`formatTime`).
- **Crystal + album card (bottom right):** crystal color dot + `red/yellow/green state` label, album progress bar, and completion hint ("Requires green crystal").
- **Interaction log (bottom center):** last interaction label + description, shown transiently.
- **Controls hint (bottom left, in `GameShell`):** movement/interact keys.

Needs bars show raw need numbers. The crystal card also shows an **emotional-state percentage** (`emotionalScore`, 0–100) with a bar tinted to the crystal colour, so the hidden graph reads as a moving value while staying a single compact signal — the in-world **LED strip recolours with the same crystal state** (red→yellow→green).

## 3. Modal surfaces

- **DAW panel (`DawPanel.tsx`):** opens on `action: 'open-daw'`. Shows tracks, a waveform mock, music-quality read-out, inspiration badge, album progress, crystal, and the Work/Stop toggle. Closing sets `dawOpen=false` and stops work.
- **Interaction video (`InteractionVideo.tsx`):** full-screen procedural "session playback" for the last interaction; a placeholder surface authored clips can later replace.

## 4. UI store (`ui-store.ts`)

`openPanel: 'none' | 'pause' | 'journal' | 'settings'`. This is the transient panel channel, separate from durable game state. `pause` is wired in M3; `journal`/`settings` are declared for future use.

## 5. Session-frame overlays (M3)

- **Pause overlay:** shown when `phase === 'paused'` (via `Esc`). Resume + restart. Simulation is frozen because `tick` early-returns unless `phase === 'playing'`.
- **Ending overlay:** win ("Finished") and collapse ("Collapse") states, each with a short line of authored text and a restart action.

## 6. Rules for adding UI

1. Keep world rendering out of React; overlays read Zustand, they don't drive the loop.
2. Select narrow slices from the store (`useGameStore((s) => s.x)`) to avoid per-frame re-renders. High-frequency values stay out of React.
3. Match the panel styling tokens above; no gradients on bars, no bloom on text (Art Bible §8).
4. Respect `prefers-reduced-motion` for any new animated affordance.
