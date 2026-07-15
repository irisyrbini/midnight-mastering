# Gameplay

> Source of truth for mechanics. Values below mirror `src/store/game-store.ts`, `src/data/interactions.ts`, and `src/game/simulation/`. If code and this file disagree, treat it as a bug in one of them.

## 0. Stress

A single **stress** gauge (0–100) sits under the needs in the HUD. It creeps up over the night — faster under high burnout/obsession/loneliness and while working on music, slower in creative flow — and is relieved by calming interactions via each interaction's `stressDelta` (opening the **window** is the big one, −22; bed, entrance, handheld console also help; energy drinks/phone raise it). See `game-store.ts` (`stress`, `stressDrift`) and `Interaction.stressDelta`.

## 1. Needs

Six needs, each `0–100`, shown in the HUD status rail. Defined in `ProducerNeeds` (`src/types/game.ts`).

| Need | Start | Passive decay (per game-minute) | Role |
|---|---:|---:|---|
| Hunger | 72 | 0.16 | fastest drain; fed by fridge |
| Energy | 70 | 0.12 | gates work; restored by bed |
| Hygiene | 66 | 0.06 | reset by shower/bathroom |
| Social | 48 | 0.08 | restored by leaving / window |
| Creativity | 62 | 0.09 | consumed & produced by making music |
| Love | 54 | 0.05 | slowest drain; tender anchor |

**Time:** 1 real second = 1 game game-minute (`deltaMs / 1000`). Frame delta is capped at 100ms in `GameLoop` so a backgrounded tab cannot flood the sim. The clock rolls over at 1440 minutes → next day.

**Clamping:** all needs are clamped to `[0, 100]` on every change (`clamp()` in the store).

## 2. Emotional need drift

The hidden emotional graph applies *additional* per-minute drift on top of passive decay (`emotionalNeedDrift`):

- Burnout `high` → creativity −0.14/min
- Addiction `high` → hygiene −0.16/min
- Loneliness `high` → social −0.08/min
- Creative flow `high` → creativity +0.08/min (partial offset)

Full model in [CrystalSystem.md](CrystalSystem.md).

## 3. Interactions

27 objects, each a gameplay node (`src/data/interactions.ts`). An interaction:

1. applies a `NeedChange` (some positive, some negative — nothing is free),
2. applies one or more `emotionalEffects` (nudging graph nodes up/down),
3. optionally opens the DAW (`action: 'open-daw'`),
4. optionally grants `inspirationMinutes`,
5. surfaces an interaction video/log card.

Representative examples:

| Object | Cost | Benefit | Emotional effect |
|---|---|---|---|
| Bed | hygiene −2, social −3 | energy +25 | burnout ↓, hope ↑ |
| Mini fridge | — | hunger +24, energy +3 | hope ↑, burnout ↓ |
| Bathroom | energy −3 | hygiene +30 | burnout ↓, hope ↑ |
| Entrance (go out) | energy −3, hygiene −1 | social +20 | loneliness ↓, hope ↑, love ↑ |
| Modular synths | energy −5 | creativity +12 | creativeFlow ↑, obsession ↑ |
| Cigarettes | hunger −5, hygiene −6 | energy/creativity +2..3, **+30 inspiration** | addiction ↑, burnout ↓ |
| Vodka | love −5, energy −8, hygiene −4 | social +4 | addiction ↑, hope ↓ |
| Music desk / Laptop / Computer (monitors) | energy −2 | opens DAW | obsession ↑, creativeFlow ↑ |

Coping objects (cigarettes, vodka, energy drink) trade short-term relief for emotional debt — this is the moral texture of the game, not a bug.

## 4. Movement & selection

Point-and-click is the primary navigation; keyboard is a supported alternative.

- **Click the floor → walk there.** A floor click sets a `moveTarget` (logical room coords via `toLogical`); `stepMovement` eases the producer toward it at `WALK_SPEED` (340 logical px/sec) and clears the target on arrival.
- **Click an object → walk to it and select it.** The clicked object stays selected while walking (`moveTarget.selectId`). **Click the selected object again → interact.**
- **Keyboard move:** WASD / arrow keys (`GameShell.tsx`); dx = ±2.4, dy = ±1.6 per frame. A keyboard step cancels any active click target so input stays predictable.
- **Run:** hold **Shift** to move ~1.85× faster (`running` in the store scales both keyboard and click-to-move speed).
- **Character animation:** the figure **turns to face its direction of travel** and plays a **walk cycle** (bob + leg swing) scaled by speed, all in `WalkingFigure`'s `useFrame` (no per-frame React re-render). Seated/lying poses are static.
- **Nearest-object selection:** while moving, the store selects the closest object within `SELECT_RADIUS` (105px) unless a `selectId` overrides it (`nearestObjectId`).
- **Interact (keyboard):** `Enter` triggers `interact(selectedObjectId)`. If an interaction overlay is already open, `Enter` **closes** it instead (interaction video first, then the DAW) — so Enter toggles the interaction open/closed (`GameShell.tsx`).
- **Camera:** mouse-drag orbits the view around a **fixed room-centre axis** (constrained `OrbitControls`, `CameraRig`); scroll zooms. The axis is fixed (not player-following) so WASD/click movement visibly walks the producer across the room. A drag is distinguished from a click (`isDrag`, 6px threshold) so releasing a rotation over an object never selects or uses it. Walls are rendered translucent (`depthWrite` off) so an orbit is never blocked.
- **Sitting / lying:** the `chair` (`action: 'sit'`) seats the producer facing the desk; the `bed` (`action: 'lie'`) lays them down on the mattress. Both snap onto the furniture and toggle off when used again. **Any other interaction — or any movement — stands them back up** (so e.g. sitting then using the computer stands up automatically).
- **The DAW opens from** the music desk, the laptop, or the **computer (dual monitors)** — all use `action: 'open-daw'`.
- **The entrance door swings open** when interacted (`entranceOpen`).
- Movement is bounded to the walkable foreground lane, `x ∈ [90,1190]`, `y ∈ [410,590]` (`clampToRoom`).

## 5. The DAW & album loop

Opening the music desk / laptop opens the **DAW panel** (`DawPanel.tsx`). While **working on music** (`workingOnMusic`):

- Extra sustained cost: energy −0.22, hunger −0.18, hygiene −0.08, social −0.14 per minute; creativity +0.24/min.
- **Inspiration:** every 10 worked minutes, if not already inspired, an 18% chance grants 75 inspiration minutes. Inspiration decays when idle.
- **Music quality** rises 0.34/min while inspired, 0.16/min otherwise.
- **Album progress** rises 0.12/min while working.
- Every 15 worked minutes the graph resolves with `creativeFlow ↑, burnout ↑, obsession ↑` — work is creatively fertile but emotionally expensive.

**Completion:** `albumCompleted` becomes true only when `albumProgress ≥ 100` **and** the crystal is green. Grinding while red will cap progress with no ending.

## 6. Endings (M3)

- **Win — Finished:** `albumCompleted` → win overlay.
- **Lose — Collapse:** wellbeing bottoms out (sustained critical needs) → collapse overlay.
- Both endings pause the sim and offer restart. Pause (`Esc`) halts time without ending the run.

Detailed thresholds live in the store and are documented alongside the ending logic.
