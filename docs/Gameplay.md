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
| Elevator button | — | opens the *Leave the studio?* prompt | — (the buff lands on **return**: stress −9, energy −4, social +3) |
| Modular synths | energy −5 | creativity +12 | creativeFlow ↑, obsession ↑ |
| Cigarettes | hunger −5, hygiene −6 | energy/creativity +2..3, **+30 inspiration** | addiction ↑, burnout ↓ |
| Vodka | love −5, energy −8, hygiene −4 | social +4 | addiction ↑, hope ↓ |
| Music desk / Laptop / Computer (monitors) | energy −2 | opens DAW | obsession ↑, creativeFlow ↑ |

Coping objects (cigarettes, vodka, energy drink) trade short-term relief for emotional debt — this is the moral texture of the game, not a bug.

## 4. Movement & selection

Point-and-click is the primary navigation; keyboard is a supported alternative.

- **Click the floor → walk there.** A floor click sets a `moveTarget` (logical room coords via `toLogical`); `stepMovement` eases the producer toward it at `WALK_SPEED` (520 logical px/sec) and clears the target on arrival.
- **Click an object → walk to it and select it.** The clicked object stays selected while walking (`moveTarget.selectId`). **Click the selected object again → interact.**
- **Keyboard move:** WASD / arrow keys (`GameShell.tsx`); dx = ±3.7, dy = ±2.5 per frame. A keyboard step cancels any active click target so input stays predictable.
- **Run:** hold **Shift** to move `RUN_MULTIPLIER` (2.3×) faster. The constant is exported from the store and used by both the keyboard handler and click-to-move, so the two can never drift apart.
- **Character animation:** the figure **turns to face its direction of travel** and plays a **walk cycle** (bob + leg swing) scaled by speed, all in `WalkingFigure`'s `useFrame` (no per-frame React re-render). Seated/lying poses are static.
- **Nearest-object selection:** while moving, the store selects the closest object within `SELECT_RADIUS` (105px) unless a `selectId` overrides it (`nearestObjectId`).
- **Interact (keyboard):** `Enter` triggers `interact(selectedObjectId)`. If an interaction overlay is already open, `Enter` **closes** it instead (interaction video first, then the DAW) — so Enter toggles the interaction open/closed (`GameShell.tsx`).
- **Camera:** mouse-drag orbits the view around a **fixed room-centre axis** (constrained `OrbitControls`, `CameraRig`); scroll zooms. The axis is fixed (not player-following) so WASD/click movement visibly walks the producer across the room. A drag is distinguished from a click (`isDrag`, 6px threshold) so releasing a rotation over an object never selects or uses it. Walls are rendered translucent (`depthWrite` off) so an orbit is never blocked.
- **Sitting / lying:** the `chair` (`action: 'sit'`) seats the producer facing the desk; the `bed` (`action: 'lie'`) lays them down on the mattress. Both snap onto the furniture and toggle off when used again. **Any other interaction — or any movement — stands them back up** (so e.g. sitting then using the computer stands up automatically).
- **The DAW opens from** the music desk, the laptop, or the **computer (dual monitors)** — all use `action: 'open-daw'`.
- **The entrance door swings open** when interacted (`entranceOpen`).
- Movement is bounded to the walkable floor, `x ∈ [70,1240]`, `y ∈ [150,780]` (`clampToRoom`).

## 5. The DAW & album loop

Opening the music desk / laptop opens the **DAW panel** (`DawPanel.tsx`). While **working on music** (`workingOnMusic`):

- Extra sustained cost: energy −0.22, hunger −0.18, hygiene −0.08, social −0.14 per minute; creativity +0.24/min.
- **Inspiration:** every 10 worked minutes, if not already inspired, an 18% chance grants 75 inspiration minutes. Inspiration decays when idle.
- **Music quality** rises 0.34/min while inspired, 0.16/min otherwise.
- **Album progress** rises 0.12/min while working.
- Every 15 worked minutes the graph resolves with `creativeFlow ↑, burnout ↑, obsession ↑` — work is creatively fertile but emotionally expensive.

**Completion:** `albumCompleted` becomes true only when `albumProgress ≥ 100` **and** the crystal is green. Grinding while red will cap progress with no ending.

## 5a. Recording the album

The album can only be **finished once every musical instrument has been used** — `acousticGuitar`, `electricGuitar`, `portasound`, `sk5`, `modularSynths`, `mic`, and the `lyricNotebook` (`INSTRUMENT_IDS`; the DAW shows an `n/7` counter). Completion still also needs `albumProgress ≥ 100` **and** a green crystal. When **all six needs are full**, the crystal recovers faster (a positive graph resolution every ~8 game-min — `wellnessMinutes`).

## 5b. Choices, sound & the visiting friend

- **Guitars strum** on interact (synth SFX, acoustic vs electric differ) and the **lyric notebook scribbles** (`src/game/audio/sfx.ts`, `SfxPlayer`, driven by `sfxCue`).
- The **fridge** raises a prompt — *Drink a beer* (alcohol: creativity ↑, energy ↓), *Grab a snack*, or *Close* — with beer bottles visible inside.
- The **bed phone** raises *Call a friend* / *Invite another friend* / *Doom-scroll* / *Put it down* (`PromptOverlay`, `choose`).
  - *Call a friend* spawns a **taller visitor** (NPC 1) who walks in from the entrance for a big social boost and **leaves after 100s** (`visitor*` state, `stepVisitor`).
  - *Invite another friend* brings in NPC 2, who strolls the room for 180s (`npc2*` state, `stepNpc2`).
  - *Doom-scroll* lays the producer on the bed with a glowing phone (social ↓, stress ↑).

**Friends only ever arrive when invited.** Neither NPC spawns on its own — there is no random-visit roll — so an empty studio stays empty until the producer picks up the phone. That keeps solitude the default state and makes company something you choose.
- Alcohol (vodka, beer) raises creativity and drains energy; the handheld console lowers stress + sociability but raises creativity.
- The **handheld console** plays classic retro chip sounds while a game is on — blip, soft pop, coin, menu move/back and a power-up run, chosen at random on an irregular 0.7–2.5s timer so they stay playful instead of turning rhythmic. Mixed at roughly a third of the instruments' level so they sit under the music (`playConsoleBlip`).
- While the friend is **staying**, `Enter` opens the friend menu: *make a tune together* (speeds album work), *drink vodka together*, *play a video game together*. Each seats both characters (`friendActivity`, `friendActivityMinutes`).

## 5c. Day cycle, weather & the second friend

- **Day cycle** (`src/game/simulation/day-cycle.ts`, the single source of truth shared by the room lighting and the window): 12:00 AM deep night · 2:00 AM the sky begins to thin · **4:30 AM the sun starts rising** · 5:00–6:00 AM golden sunrise · full morning light by 8:00 AM · dusk 7:00–9:00 PM. `dayCycle(minuteOfDay)` returns `{ daylight, golden, sunProgress }`; the room's ambient/directional lights, sky, fog and the window's sky plane and sun disc all read from it, so they transition together.
- **Weather** (`WeatherKind`: `clear | rain | rainbow | hail`) rerolls every 180 game-minutes. Bad weather (rain/hail) drains energy, nudges `burnout ↑`, and dims the outdoor light contribution to ~55% without touching the room's own practical lights. Rain is drawn **inside the window unit only** (`RainCurtain`) as straight vertical streaks recycled within the pane, so weather never enters the room. A gentle synthesized rain loop fades in while it rains (`startRain` / `stopRain`, driven by `SfxPlayer`).
- **NPC 2** (`npc2*`) strolls the room between real destinations: it walks to a point, pauses 1.2–4.4s, then picks somewhere new (`stepNpc2`). Those pauses are what give the renderer genuine idle → walking → turning → stopping transitions.
- **Weather audio:** rain runs the ambience loop at full level; **hail runs the same loop at ~45%** (`HAIL_LEVEL`), brighter and thinner in tone, so it reads as hail without burying the music. `startRain(hail)` swaps the loop when the weather changes between the two.
- **Smoking** runs on its own `smokingMinutes` timer (25 game-minutes, set by the `cigarettes` interaction) rather than the inspect card, so the animation stays visible after the card closes.

## 5d. Movement, the elevator, and ambient thoughts

- **Walking speed:** `WALK_SPEED = 520` logical units/sec, with `RUN_MULTIPLIER = 2.3` on Shift. The keyboard handler multiplies its per-frame step by the same `RUN_MULTIPLIER` so click-to-move and WASD stay in step. Turning and the walk cycle remain eased (`facing` and `gait` both interpolate), so faster movement never feels slippery.
- **The elevator** replaces the old corridor door as the way out. See [LevelDesign.md](LevelDesign.md) §3a for the ride, and note the return trip applies the going-outside buff (`stress −9`, `energy −4`, `social +3`).
- **Ambient thoughts** replace dialogue entirely. `tick` picks a bubble from activity-matched pools on a 50–110 game-minute cooldown; the renderer only owns the fade. See [ArtBible.md](ArtBible.md) §8c for the vocabulary and the rule that silence is the default.

## 6. Endings (M3)

Framed as **completion vs. an unfinished night**, never win vs. lose (see [Story.md](Story.md) §7 and [Vision.md](Vision.md)):

- **Finished:** `albumCompleted` → a quiet completion overlay ("the work is finished, but your story isn't"). Not a triumphant win screen.
- **Unfinished night (`collapse` in code):** wellbeing bottoms out (sustained critical needs) → a gentle overlay framed as the night ending and an invitation to return, not a game-over.
- Both endings pause the sim and offer restart/continue. Pause (`Esc`) halts time without ending the run.

Detailed thresholds live in the store and are documented alongside the ending logic.

## 7. Game-loop philosophy (binding)

Mechanics exist to serve the feeling in [Vision.md](Vision.md), not to drive engagement. Every loop should quietly communicate:

- **Small actions matter.** A single interaction is meaningful; the game never demands a streak or an optimal rotation.
- **Creative work grows slowly.** Album progress is gradual by design; there is no fast path and no reason to rush.
- **Rest is productive.** Sleeping, eating, opening the window and leaving the room advance wellbeing, which is *required* to finish — rest is not lost time.
- **Reflection has value.** Idle presence (ambient thoughts, looking out the window) is a valid way to play.
- **Finishing something is enough.** Completion, not perfection or optimization, is the whole reward.

Never add mechanics that reward talent over persistence, encourage grinding/competition/optimization, or pressure the player toward productivity. If a mechanic doesn't bring the player closer to creative peace, it does not belong (see [Vision.md](Vision.md) §"The one question").
