# Game Design Document — Midnight Mastering

> **Codename:** Midnight Mastering · **In-game title:** *Make Me Happy Again*
> **Status:** Source of truth. Read before any change. This document describes the game as it is currently built, not an aspiration. Redesigns require editing this file first.

## 1. One-line pitch

A nocturnal emotional simulation about an isolated music producer trying to finish an album without losing contact with themself.

## 2. Design pillars

1. **Warm human focus inside a cool, sleeping world.** The stakes are private and small: sleep, food, a phone call, one more take.
2. **Emotion is a system, not a meter.** Wellbeing is legible; the emotional interior is hidden and inferred through a single crystal.
3. **Every object is a choice with a cost.** There is no free action. Progress on the album is always paid for somewhere else.
4. **Stillness carries meaning.** The game is quiet, contemplative, and restrained. It never literalizes distress as horror.

## 3. Player fantasy & core tension

The player manages a producer through late-night sessions. The central tension is between **finishing the album** (external goal) and **staying well** (internal goal). Working on music advances the album but drains physical and social wellbeing and pushes the hidden emotional graph toward obsession and burnout. The album can only be *completed* when the crystal is green — you cannot finish by grinding alone.

## 4. Core loop

```
observe needs + crystal → move to an object → interact (pay a cost, gain a benefit)
   → emotional graph propagates one step → crystal re-reads → repeat
   → periodically open the DAW → work on music → advance album (requires wellbeing to finish)
```

See [Gameplay.md](Gameplay.md) for the full mechanical breakdown.

## 5. Win / lose conditions

- **Win — "Finished":** album progress reaches 100% **while the crystal is green**. See [CrystalSystem.md](CrystalSystem.md).
- **Lose — "Collapse":** total wellbeing bottoms out (sustained critical needs) — the producer can no longer continue tonight.
- **Neutral continuation:** days pass; the clock advances (1 real second = 1 game minute). There is currently no hard day limit.

## 6. Session frame (states)

`booting → title → playing ⇄ paused → ending(win|collapse)`

- `booting` / `title`: entry. (Boot currently transitions straight into play; title is a declared phase.)
- `playing`: the loop runs and time advances.
- `paused`: simulation halts; the pause panel is shown.
- `ending`: win or collapse overlay; the run can be restarted.

## 7. Platform & tech

Browser game. Next.js 15 App Router, React 19, TypeScript. World rendered with **Three.js via `@react-three/fiber`**; DOM overlays are React. State in **Zustand**. See the repository `ARCHITECTURE.md` for module boundaries. A legacy Pixi renderer exists in `src/game/rendering` but is not the active view.

## 8. Scope boundaries (what this game is NOT)

- Not first-person. The camera is a fixed high-isometric "dollhouse" view (see [ArtBible.md](ArtBible.md)).
- Not a numbers-forward stat sim. Emotional interiority stays hidden behind the crystal.
- Not horror. Mental-health states use light, rhythm, and density — never monsters or shock imagery.

## 9. Roadmap / milestones

- **M1 — World & needs (done):** isometric room, 27 interactive objects, six decaying needs, HUD.
- **M2 — Emotional graph & crystal (done):** hidden 7-node graph, crystal read-out, album/inspiration/DAW loop.
- **M2.5 — 3D studio migration (in progress):** Three.js renderer replacing the Pixi placeholder scene.
- **M3 — Session frame & endings (current):** pause, win screen, collapse screen — a completable, loseable run.
- **M4 — Persistence (planned):** save/load under `src/features/session`.
- **M5 — Narrative beats (planned):** authored events keyed to day/crystal in `src/data`.

See per-system docs for detail: [Gameplay.md](Gameplay.md) · [CrystalSystem.md](CrystalSystem.md) · [LevelDesign.md](LevelDesign.md) · [UI.md](UI.md) · [Story.md](Story.md) · [ArtBible.md](ArtBible.md) · [AssetPipeline.md](AssetPipeline.md).
