# Patch 0.2.1 — HUD → World feedback audit

> Every numeric HUD system stays (mechanics + numbers unchanged). For each, this maps the **existing
> HUD feedback** to a proposed **environmental / emotional expression**, so a player who never looks at
> the HUD still understands their state — and the two layers can never contradict, because both read the
> same Zustand store. See [../Vision.md](../Vision.md) §"HUD & feedback (Patch 0.2.1)".
>
> **Invariant:** world feedback is a *pure read* of the same store value the HUD shows. Drive it off the
> live number; never compute a second source of truth.
>
> Complexity is relative to what already exists. **★ = depends on the evolving music/ambient bed** from
> the Patch 0.2 audit priority #2 (that bed does not exist yet — only a rain loop + one-shot SFX).

## Per-system mapping

| System (store field) | Existing HUD feedback | Proposed environmental feedback | Priority | Complexity |
|---|---|---|---|---|
| **Crystal / emotional state** (`crystal`, `emotionalScore`) | Colour dot + `red/yellow/green state` + `{n}%` bar (bottom-right) | The in-world six-ray crystal above the head already recolours — extend it: **brightness + saturation** scale with the %, **pulse speed** slows when low / steadies when green, faint **hairline fractures** at red that knit closed toward green. The room LED strip already tracks colour; widen that wash so the whole room tints with the crystal. | **High** (emotional core) | **Low–Med** — crystal mesh + LED already exist; add emissive-intensity / pulse / fracture detail. |
| **Stress** (`stress`) | `Stress {n}` bar, red>66 / amber>33 / green | **Posture** slumps and **walk slows** as stress rises; idle "breathing" tempo tightens; **lighting cools** (blue shift) with a faint vignette; **music thins/quiets** ★; the **desk clutters** (an extra mug, scattered papers) at high stress and tidies as it eases. | **High** | **Med** — needs posture/idle states + a stress→light-temp hook (day-cycle light plumbing exists); music + desk-clutter are add-ons. |
| **Album progress** (`albumProgress`, `albumCompleted`) | `Album {n}% · Requires green crystal` bar | **Audible layers accumulate** — each instrument the player uses adds a stem to *the* track, so progress is heard, not just metered ★; the room accretes **creative evidence** (lyric pages fanning from the notebook, takes stacking up); instruments show subtle **wear**; new **motifs** surface as it nears done. | **High** | **High** ★ — the layered-audio system is the big lift; room accumulation is Med and shared with §Environment. |
| **Energy** (`needs.energy`) | `Energy {n}` bar | **Animation weight**: low energy → heavier steps, slower idle, more frequent **stretches/yawns**, longer blinks; high energy → a lighter step and quicker idle. Rubbing eyes / leaning on the desk at very low. | **Med** | **Med** — new idle/locomotion anim variants blended by energy (the rig already blends gaits). |
| **Love / connection** (`needs.love`, `visitorActive`, friend activities) | `Love {n}` bar | This is the game's heart (*love heals*): **friends visit**, the bed **phone glows with a waiting message**, a **polaroid** gets taped up after a visit, a **small gift / shared object stays in the room** as a permanent memory. Low love → the room feels emptier and cooler; rising love → warmer key light and more of these traces. | **High** | **Med** — visitor system + phone exist; add persistent-memory props (shared with §Environment) and a warmth response. |
| **Hunger** (`needs.hunger`) | `Hunger {n}` bar | Fridge/snack use leaves **evidence** (empty mugs, a wrapper, a takeout box) that accumulates; very low hunger → slower, heavier idle and a dimmer, greyer cast; eating brightens the immediate moment. | **Med** | **Low–Med** — prop accumulation + a small idle/lighting nudge. |
| **Hygiene** (`needs.hygiene`) | `Hygiene {n}` bar | Low hygiene → the room reads more dishevelled (clutter, a duller surface sheen), the producer's posture a touch more hunched; a shower (bathroom) visibly **freshens** the room's tone and tidies a beat. | **Low** | **Low–Med** — reuse the clutter/tidy system. |
| **Creativity** (`needs.creativity`) | `Creativity {n}` bar | Overlaps album evidence: high creativity → sketches/notes and instrument activity accumulate, the desk lamp reads warmer and more "lit up"; low → the desk goes quiet and cool. | **Med** | **Med** — shares the accumulation + lighting systems. |
| **Social** (`needs.social`) | `Social {n}` bar | Expressed with Love via visits/messages; additionally, low social → the window city feels more distant/muted, high social → the phone and window feel more "connected" (a passing text glow, a lit window across the way). | **Low–Med** | **Low** — small window/phone cues layered on the Love work. |
| **Time** (`clock`) | `DAY n` + `HH:MM` card | **Already strongly diegetic** — the day-cycle drives the window sky, sun/sunrise and room light from midnight to morning. Add **dawn birds** and **morning light reaching a little farther** each day. The HUD clock is confirmation. | **Low** | **Low** — day-cycle exists; add birds + a per-day light-reach nudge. |
| **Weather** (`weather`) | `CLEAR/RAIN/HAIL/…` label | **Already diegetic** — rain/hail streaks in the window, rain ambience, overcast tint. Add a subtly **cozier interior** while it rains (a reason to stay in) so weather reads as mood, not penalty. HUD label is confirmation. | **Low** | **Low** — window weather + rain audio exist. |
| **Save** (`SAVE` button / autosave) | Persistent SAVE button | Meta, not an emotional stat — **no world expression needed.** Keep the control; optionally let it recede with the rest of the HUD. The "room remembers / nothing resets" motif already carries the *feeling* of persistence. | **Low** | **Low** — behavioural (fade) only. |

## HUD recede behaviour (keep everything, show it contextually)

Drive HUD visibility from what the player is doing (all data stays live underneath):

- **Walking / idle roaming** → HUD fades after a few seconds to a near-empty screen.
- **Interact with an object** → the *relevant* element briefly reappears (e.g. needs after eating).
- **Music production (DAW open / `workingOnMusic`)** → album progress is visible.
- **Sleep** → a peaceful **nightly summary** (the day's small progress), then fade to morning.
- Any input (move, hover, open a panel) re-surfaces the HUD instantly.

Complexity: **Med** — a small visibility controller keyed to store state + activity timers; no mechanic changes.

## Optional Immersive Mode (setting; default = standard HUD)

- Keep contextual prompts, the pause menu, and inventory/panel info.
- Rely primarily on the world layer above for state; suppress the always-on stat rail / bars.
- Both modes must be **complete experiences** — a stats player and an immersive player each get a full read.

Complexity: **Med** — a `ui.immersive` flag gating the persistent HUD; the world layer (built anyway) is what makes it viable, so it lands cheaply *after* the world feedback exists.

## Suggested build order (emotional impact first)

1. **Crystal world-expression** (brightness / pulse / fracture + room tint) — the emotional core, low cost, high payoff, and it's the thing that most lets a player "feel" without the HUD.
2. **Stress → posture + light + music** — the most legible mood signal; pairs with the audio bed.
3. **Love / connection memories** (visits, message glow, polaroids that stay) — carries the *love heals* thesis and doubles as room-archive.
4. **Album → audible layers + creative evidence** ★ — biggest lift; gated on the music bed.
5. **Energy / hunger / hygiene animation + clutter** — the "living body / living room" texture.
6. **HUD recede behaviour**, then **Immersive Mode** — cheap once the world layer exists.
7. **Dawn birds / per-day light reach / cozier rain** — atmospheric polish.

Nothing here removes a mechanic or a number. Where a number is *also* expressed in the world, the HUD
element becomes a quiet confirmation rather than the primary language.
