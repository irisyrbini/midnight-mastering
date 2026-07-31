# Design Consistency Audit — everything vs. Patch 0.2

> Audit of the game as currently built against [Vision.md](../Vision.md) (Patch 0.2 + the deepened
> philosophy: *love heals; creativity is how you remember it* · arc **Disconnected → Safe → Present →
> Creative → Connected → Hopeful → Happy Again** · endings are quiet recognition, never victory).
> Findings cite real files. This is a findings report, not a set of applied changes.

## 1. Philosophy conflicts

| # | Where | Conflict | Why it violates Patch 0.2 |
|---|-------|----------|---------------------------|
| 1 | `EndingOverlay.tsx` | Confetti burst, pink "party" panel, `CHAPTER 1 COMPLETE` tag, `New Chapter Unlocked`, `Continue Your Journey` button | The thesis is *quiet recognition, nothing resets, no fanfare.* This is a literal win-screen with animated confetti — the single biggest contradiction. |
| 2 | `GameHud.tsx` header | Objective line **"RESTORE THE CRYSTAL · FINISH THE ALBUM"** | Imperative quest-objective framing. Pressures productivity; tells the player their job. The game offers permission, not tasks. |
| 3 | `GameHud.tsx` status rail | Six **numeric need bars (0–100)** + a **Stress meter** (red/amber/green) | A stat-sim dashboard. "Emotion is a system, not a meter"; less UI / more atmosphere. Numeric bars invite optimization (fill them). |
| 4 | `GameHud.tsx` crystal card | **"EMOTIONAL CRYSTAL … {n}%"** numeric read-out | Turns the deliberately *hidden* emotional interior into a visible percentage to be maximized. |
| 5 | `GameHud.tsx` album card | **"Album {n}% · Requires green crystal"** progress bar | A quest tracker with a gating condition. Reads as "grind to 100%." Progress should be felt (music, room), not metered. |
| 6 | `game-store.ts` (`COLLAPSE_WELLBEING_FLOOR` 15 / `COLLAPSE_SUSTAIN_MINUTES` 90) + `EndingOverlay` `COLLAPSE` | A **losable run**: sustained low wellbeing → `collapse` ending tagged **"COLLAPSE"** | A fail state. Even softened in copy, a game you can *lose* is pressure and judgement — the opposite of permission. The player is ejected from the emotional arc entirely. |
| 7 | `game-store.ts` (`allFull = min(needs) >= 95` → faster crystal recovery) | Reward for **maxing all six needs at once** | "Encourage presence, not optimization." This is a min-max optimum: keep every bar near 100 for the bonus. |
| 8 | `game-store.ts` (`allInstrumentsUsed`, `REQUIRED_INSTRUMENT_COUNT`) | Album can't finish until **all 7 instruments have been touched** | A completionist checklist ("use one of each"). Encourages box-ticking over meaningful making. |
| 9 | `game-store.ts` (`badWeather` → energy −, burnout ↑) | Rain/hail **drain stats** the player can't control | Uncontrollable external penalty. Weather should color mood/atmosphere, not punish. |
| 10 | `interactions.ts` (`redBull` +energy/+stress; coping loop) | The stress↔energy trade invites a **grind-fuel optimization pattern** | Lower severity — honest-cost framing is on-brand — but the systemic incentive is "spend stress to buy album progress." |
| 11 | `GameHud.tsx` | Persistent **SAVE** button, `DAY n · WEATHER` card, day counter | Save-slot / HUD furniture reads as a productivity app; fine to keep but should recede, not sit always-on. |

## 2. Narrative changes (rewrite + suggested versions)

- **Objective line** — `RESTORE THE CRYSTAL · FINISH THE ALBUM`
  → remove entirely, or replace with something that isn't an instruction, e.g. a faint, rotating
  environmental line: *"the city is asleep"* / *"there's still time"* / *"the track is almost there"* —
  observation, not a quest.
- **Finished-ending copy** — currently *"The album is complete, and the crystal above your head finally
  glows bright green. For once, the room feels warm enough to stay in."* This names the HUD crystal
  (mechanical) and frames completion as the point.
  → *"The last note settles. Morning is already in the room. / Everything you reached for tonight is
  still here — the cup, the notebook, the chair. / You didn't just finish a chapter. / You found a part
  of yourself waiting for you."* Then the title returns.
- **Collapse copy** — tag `COLLAPSE`, title *"The night ran out."*
  → drop the word "collapse" and the failure tone: *"Not tonight."* / *"You let the dark be dark. / The
  work will keep. So will you. / Come back when you're ready."* — an invitation, no score line.
- **"New Chapter Unlocked / Continue Your Journey / greenhouse coming soon"** — gamified unlock language.
  → *"There's another room, when you want it."* No "unlock," no CTA styling.
- **Header title** stays *MAKE ME HAPPY AGAIN*, but let its meaning turn from plea → realization only via
  the ending; never explain it in dialogue.

## 3. Gameplay changes (optimization/pressure → calm/persistence)

- **Remove the collapse lose-state** (or convert it): a night that goes badly should simply *end* — the
  screen slips to morning, the run continues the next night with everything intact. No fail overlay, no
  restart-from-zero. Persistence, not punishment.
- **`allFull` wellness bonus → presence bonus:** instead of rewarding all-six-needs-at-95, let *any*
  restful or reflective act (sleep, window, a friend, sitting, an idle thought bubble) gently ease the
  emotional graph. Reward *taking a breath*, not maxing a dashboard.
- **All-instruments gate → organic growth:** let the album quietly deepen as the player plays whatever
  they're drawn to; no "you must touch all 7." Using an instrument adds a layer to the *audible* track
  (see §5), which is its own reward — remove the hard requirement.
- **Weather penalty → weather mood:** rain/hail should change light, sound, and the window, and maybe
  make the room feel cozier (a reason to stay in), not subtract energy. Remove the stat drain and the
  forced burnout tick.
- **Stress meter → dissolve into the world:** stop surfacing "stress" as a number; let tension read
  through light temperature, music density, and the producer's posture/animation tempo.
- **Album % as a goal → soften:** keep progress internal; the finish should arrive because the track
  *sounds* done and the room feels ready, not because a bar hit 100.

## 4. Environment — the room as a living archive (currently unbuilt)

The docs promise a room that "becomes evidence a life has been lived," but **nothing accumulates today**
— the room is static and resets each run. Opportunities:

- **Accumulating memories** keyed to what the player actually did: an empty mug (and then two, three)
  after the fridge/energy drink; loose lyric pages fanning out from the notebook as it's used; a rising
  count of sticky notes on the wall; a guitar pick left on the desk after playing; a polaroid taped up
  after a friend visits; cassettes stacking by the deck; margin scribbles appearing over days.
- **Across-day warming (subtle, never dramatic):** morning light reaching a little farther each day; a
  small plant that grows a leaf per chapter-day; the LED/lamp warmth already tracks the crystal — extend
  that so the *whole* room, not a HUD, is the mood read-out.
- **Dawn life:** birds appearing outside the window near sunrise; the city waking.
- **Nothing resets:** at chapter end the accumulated archive stays on screen (this is the ending's whole
  emotional move — persist it, don't clear it).
- **Retire the crystal HUD in favor of the room:** the room *is* the wellbeing meter; the six-ray crystal
  can remain as an in-world object above the head without a percentage.

## 5. Audio — the biggest missing pillar

**There is currently no music bed and no ambient bed** — `sfx.ts` has only a rain loop plus one-shot
cues (guitar strums, keyboard chord, scribble, console blips, elevator ding). "Music drives progression"
is core philosophy and essentially unimplemented.

- **An evolving ambient/music bed** that tracks the emotional arc: start sparse and cool (a single pad,
  tape hiss, distant city) at *Disconnected*; add warmth, a soft pulse, and harmonic movement as the
  player reaches *Connected → Hopeful*. The room should *sound* like it's warming.
- **Make the album audible.** As the player uses instruments, their motifs should accrue into *the track*
  — so the song that plays at the finish is literally the thing they built. This replaces the
  all-instruments checklist with a felt reward.
- **Use silence deliberately.** At the ending, let the final song fade fully to silence before the last
  line lands. Silence is a first-class instrument here, not dead air.
- **Dawn transition:** night ambience (rain, distant traffic) crossfading to morning (birds, room tone)
  as the day-cycle turns — audio reinforcing the *Present → Hopeful* move.
- **Keep the playful SFX low** (console blips, dings) — they're charming but must never be the loudest
  thing; nothing should read as an arcade.

## 6. UI — game-like → peaceful

> **Superseded by Patch 0.2.1 (see [PATCH_0.2.1_FEEDBACK_AUDIT.md](PATCH_0.2.1_FEEDBACK_AUDIT.md)).** Do
> **not** drop the numeric readouts. Keep the HUD and its numbers as the *mechanical* layer; instead add
> a complementary *world* layer and let the HUD **recede contextually**. The recommendations below are
> kept for history but re-read them as "quiet / auto-hide," not "remove numbers."

Everything in `GameHud.tsx` currently reads as a management sim. Recommendations, in order:

- **Auto-hide the HUD during quiet play** (fade in only on interaction or input); default to an almost
  empty screen so the room carries the moment.
- **Drop the numeric percentages** — crystal %, album %, need numbers. If wellbeing must be shown, one
  soft, wordless cue, or better, nothing (the room shows it).
- **Remove the objective line and the album progress bar.** Let progress be diegetic (music, room).
- **Demote SAVE / day / weather** to a corner that fades, or into a pause menu.
- **Keep** the ambient thought-bubbles and the in-world crystal — those are already on-philosophy
  (quiet, diegetic, mood-not-metric).

## 7. Emotional journey — does it trace the arc?

Target: **Disconnected → Safe → Present → Creative → Connected → Hopeful → Happy Again** (note:
**Connected precedes Hopeful** — love/belonging before hope; and "Happy Again" is a realization).

What exists, stage by stage:

- **Disconnected** ✅ — the run starts red (loneliness high, hope/love low). Good foundation.
- **Safe** ❌ *missing* — there is no opening beat that gives *permission to rest*. The player is dropped
  into a stat sim with an objective line and decaying bars. The first feeling is pressure, not safety.
- **Present** ⚠️ partial — interactions and ambient thoughts create presence, but the HUD keeps pulling
  attention to metrics.
- **Creative** ✅ — making music / playing instruments is well supported.
- **Connected** ⚠️ — friends raise love/social (good, and thematically central to "love heals"), but it's
  optional and easy to miss, and the crystal treats love and hope as simultaneous gates rather than
  letting *connection lead into* hope.
- **Hopeful** ✅ mechanically — green crystal requires hope + love + reconnection.
- **Happy Again** ❌ *broken* — replaced by a confetti win-screen. The realization ("I can make myself
  happy again") never lands; the game congratulates instead.

**Biggest breaks:** (1) no *Safe* onboarding — the arc starts in pressure; (2) the *collapse* lose branch
ejects the player from the arc; (3) the ending overwrites *Happy Again* with fanfare. Also, the ordering
insight — **Connected before Hopeful** — isn't expressed: love/belonging should visibly *precede and
cause* hope, not resolve alongside it.

## 8. Implementation priority (by emotional impact, not effort)

1. **Rewrite the ending** — remove confetti/win-screen; implement the nothing-resets recognition beat
   (music fades to silence → morning → the room intact → *"You found a part of yourself waiting for
   you."* → title reframed). This is the thesis; it pays back the most feeling per line changed.
2. **Add the evolving music/ambient bed + deliberate silence.** The one core pillar that's absent; it
   carries the whole arc and makes the ending's silence meaningful.
3. **Remove/soften the collapse lose-state.** Eliminates the sharpest pressure/judgement contradiction.
4. **Quiet the HUD** — auto-hide, drop numeric %s and the objective line, let the room speak.
5. **Make the room a living archive** — persistent accumulating memories + across-day warming; nothing
   resets. Turns "belonging" from a doc line into something you can see.
6. **Replace optimization rewards** — `allFull` wellness → presence-based easing; all-instruments gate →
   organic, audible album growth.
7. **Add a *Safe* opening beat** — a slow, quiet first minute that grants permission to rest before any
   goal is implied.
8. **Soften weather to atmosphere-only** (no stat drain) and keep playful SFX low.
9. **Express "Connected before Hopeful"** — let a friend/connection moment be what tips hope, so love
   visibly leads.
