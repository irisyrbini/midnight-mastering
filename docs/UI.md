# UI

> Source of truth for the interface layer. Mirrors `src/components/ui/*` and `src/store/ui-store.ts`. UI is React DOM overlaid on the Three.js world — React never draws the world.

## 1. Language

A **quiet instrument panel embedded in the room** (see [ArtBible.md](ArtBible.md) §8): smoke-tinted glass panels, thin paper-bone borders, monospace numerics. Panels use `bg-night/80–90` with `border-paper/40` and `backdrop-blur`. Persistent status lives in a **left rail**; time/context in an **upper-right card**; the center stays clear for the room.

**Philosophy — two complementary layers (Patch 0.2.1, see [Vision.md](Vision.md) §"HUD & feedback").** The HUD stays and **keeps its numbers** (crystal %, album %, need values, time, weather, save) — it *explains*. The **world** *makes the player feel*, so every stat also has an environmental expression and the HUD and world must **always agree, never contradict** (both read the same store). The goal is that a player who never looks at the HUD still knows how they feel. So: keep the readouts, but let the HUD **recede** (fade while walking; relevant elements reappear on interaction — album while producing, needs on eat/sleep) and add the world layer per [audits/PATCH_0.2.1_FEEDBACK_AUDIT.md](audits/PATCH_0.2.1_FEEDBACK_AUDIT.md). Copy still **whispers, never shouts** — no motivational lines, no reward pop-ups or XP toasts; celebratory UI (confetti win-screens) is out. An **optional Immersive Mode** leans on the world layer; the standard HUD is the default.

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
- **Ending overlay:** framed as **completion, not victory** (see [Story.md](Story.md) §7). "Finished" is a quiet completion ("the work is finished, but your story isn't"), and the unfinished-night ("collapse") state is a gentle invitation to return — each a short line of authored text and a restart/continue action, never a triumphant win-screen or a game-over sting.

## 6. Rules for adding UI

1. Keep world rendering out of React; overlays read Zustand, they don't drive the loop.
2. Select narrow slices from the store (`useGameStore((s) => s.x)`) to avoid per-frame re-renders. High-frequency values stay out of React.
3. Match the panel styling tokens above; no gradients on bars, no bloom on text (Art Bible §8).
4. Respect `prefers-reduced-motion` for any new animated affordance.
