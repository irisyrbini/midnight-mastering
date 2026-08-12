# MMHA Character Design Audit

> Inspection + recommendation report. **No code changed.** All characters are procedural low-poly
> geometry (Three.js primitives) in `src/components/game/ThreeStudio.tsx` — there are no imported models
> or sprites. Design intent reference: `docs/ArtBible.md` §6, §8a. Camera: high-iso, `fov 48`, orbit
> distance ≈ 8.75–30 world units (`CameraRig`), so silhouette dominates and face detail is invisible.

## 1. Current character implementation

Everything is hand-built from `boxGeometry` / `capsuleGeometry` / `sphereGeometry`, animated per-frame in
`useFrame` off the Zustand store. No skeleton, no skinning, no keyframes — "bones" are nested `<group>`s
rotated directly.

**Player** (`Player`, L447): three pose branches — **lying** (L454), **seated** (L473), **standing/
walking** (L485). Shared parts:
- `UpperBody` (L141): torso box + shoulder yoke + two 2-joint arms (upper + forearm, no hands) + a
  hooded head group (face inset box, hood box, headphones). Colours `CLOTH #161a24`, hood `#4b3b3d`.
- `StandingLegs` (L178) / `SittingLegs` (L189) / `WalkLeg` (L201): box legs (`CLOTH_DARK #0e111a`) +
  box shoes (`#07090e`). `WalkLeg` pivots at the hip only — **no knee**.
- `WalkingFigure` (L210): reads `playerPosition`, turns to face travel, and drives a bob + hip-swing
  cycle. Idle = fully static (no motion when not moving).
- `useGroove` (L99): the seated "make-tune" body loop, shared with NPC1.
- `SmokingEffect` (L333), `EmotionalCrystal` (L60, floats above the head), `ThoughtBubble` (L426).

**NPC1 = `Visitor`** (L533): the called-over friend / **modular-synth specialist**. Standing form is
tall + slender — capsule legs (`#293026`), oversized boot boxes, `FriendTorso` (L493: one tall box torso
`#12161e`, capsule arms, brown head box + **dreadlock strands**). `SynthPerformance` (L521) reaches for
gear + sparkles; plays `playModularPatch`. `scale 1.35`.

**NPC2 = `Npc2`** (L601): the invited second friend. `NPC2_COAT #75614f` (tan), `NPC2_SKIN #f1d7c9`
(pale). Box torso, capsule arms ending in **sphere hands** with cuff/tattoo detail boxes, head = pale
sphere + **black bucket-hat cylinder** + **glasses** (white bars). Legs are `Npc2Leg` (L585) with **hip +
knee** joints. `scale 1.15`. Its own real walk cycle (stride, counter-swing, bounce, idle head-glance).

## 2. Biggest visual problems (ranked by impact)

1. **The player reads as a near-black blob and merges into the dark room.** Every player material is
   value ~0.06–0.10 (`#161a24`, `#0e111a`, `#07090e`) against a `#17263a` floor and dark furniture.
   Silhouette loss is constant (visible in every session screenshot). *This is the single most damaging
   issue* and directly violates the brief's "avoid pure black clothing."
2. **No emotional body language.** Stress / energy / crystal never touch posture, shoulder height, head
   angle, walk feel, or breathing. The entire "emotional posture" system the brief asks for is absent —
   and it's the biggest miss against Patch 0.2 (the *world/body* should express state).
3. **Player proportions read toy-like / borderline chibi.** ~3.8 heads tall, and the hooded head is
   nearly as wide as the torso (see §3). The brief explicitly forbids this.
4. **Player idle is dead; NPC2 idle is alive.** Standing still, the player has *zero* motion (no breath,
   no weight shift). NPC2 breathes and glances around. The protagonist is the least alive figure.
5. **Player walk is stiffer than NPC2's.** `WalkLeg` has no knee (rigid hip swing); NPC2 has knees.
   The hero has the lower-quality walk.
6. **Three different limb "languages."** Player = boxes with no hands; NPC1 = capsules; NPC2 = capsules +
   sphere hands. They don't fully read as one universe.
7. **Foot sliding everywhere.** Stride phase is time/speed-based (`phase += dt * …`), never
   distance-locked, so feet skate on both player and NPC2.

## 3. Proportion problems (player, standing)

Measured from the geometry (total height ≈ 2.2 units, feet→top-of-hood):

| Metric | Current | Read |
|---|---|---|
| Head-to-body | hood ≈ 0.58 tall of ≈ 2.2 → **~3.8 heads tall** | Too childish / toy-like (target ~5–6 for PS2-indie) |
| Head width vs torso width | 0.55 vs 0.62 → **head ≈ torso width** | Toy-like; the head is a bulky block |
| Shoulder vs head width | 0.72 vs 0.55 → **1.3×** | Narrow-shouldered; weak masculine/streetwear silhouette (want ~1.8–2×) |
| Torso : legs | 0.76 : 0.83 | Acceptable (legs marginally longer) |
| Torso shape | single undifferentiated box, no waist/chest | Reads as a "block," not a body |
| Hands | **none** (arms end in a forearm box) | Loses the "large hands for music readability" intent; inconsistent with NPC2 |
| Feet | 0.36-deep box | Fine-ish, but flat/blocky |
| Centre of gravity | high (big head + short legs) | Contributes to the top-heavy toy feel |

Net: **shrink the head, narrow it, widen the shoulders, and give the torso a slight taper** — that alone
moves it from "toy" to "stylish indie."

## 4. Silhouette problems

- **No hair.** The head is only a hood; the brief wants a "slightly messy hair silhouette." From behind
  or in black, the head is a featureless rounded block.
- **Head+hood+headphones stack into one bulky mass** that dominates the silhouette and reinforces the
  big-head read.
- **Value merge:** as a black silhouette the player is *already* how it looks in-game (near-black), so
  there is no reserved contrast to separate it from dark furniture — the opposite of the brief's intent.
- **Narrow shoulders + block torso** give a generic, slightly featureless upper body; the headphones are
  the only distinctive cue, and they sit so high they can clip the crystal/thought bubble zone.
- **Feet** are short black boxes that vanish against the floor, so the base of the silhouette is unclear
  (hard to tell where the character "plants").

## 5. Animation problems

- **Static idle (player).** No breathing / weight-shift when standing still (`WalkingFigure` only moves
  while `moving`). NPC2 has idle life; the player doesn't.
- **No knees on the player walk** (`WalkLeg`, L201) → stiff, stilted stride vs NPC2's bent-knee walk.
- **Foot sliding** on player + NPC2 — stride phase isn't distance-locked (L233, L634).
- **Lying pose is a rigidly rotated standing figure** (`rotation x π/2` over `StandingLegs`, L459) —
  legs stick straight out, arms in standing rest; reads stiff rather than relaxed-on-a-bed.
- **No emotional blend targets** — postures don't ease between states because the states don't exist.
- **NPC2 is under-animated vs the brief.** It only has walk + idle-glance. The brief asks for sit, talk,
  drink, dance, head-nod, watch-window, observe-player — none exist.
- **NPC1 seated** reuses the player's `SittingLegs` + `useGroove`; fine, but the standing→seated swap is
  an instant component swap (no transition).
- Minor: headphone/crystal/thought-bubble vertical stack can overlap at some camera angles.

## 6. Emotional expression problems

- Emotion is communicated **entirely off-body**: the floating `EmotionalCrystal` (colour) and
  `ThoughtBubble` (symbols). The *character* itself never changes with stress, energy, or crystal state.
- This directly contradicts both the brief's Design Principle (emotion through posture/silhouette/
  rhythm/etc.) and Patch 0.2 (the body/world should carry feeling, the HUD merely confirms).
- Because the head is always hooded and faceless, and the brief (correctly) says not to rely on faces,
  **the body is the only channel available — and it's currently mute.** The five requested states
  (Neutral / High Stress / Low Energy / Inspired / Connected) have no representation.

## 7. NPC consistency problems (player vs NPC1 vs NPC2)

Silhouette separation is actually **good** — player (hood + headphones + block), NPC1 (dreadlocks +
slender + boots, `1.35×`), NPC2 (bucket hat + glasses + pale, `1.15×`) are each distinct and none is a
recolour of another. Problems are in *cohesion and value*:

- **Mixed construction language:** player is boxes-without-hands; NPCs are capsules; only NPC2 has hands.
  They don't feel modelled by the same hand.
- **Weak colour separation between player and NPC1** — both are near-black torsos (`#161a24` vs
  `#12161e`). In a dark room they can read as the same value mass when close.
- **NPC2 is the most polished character** (knees, hands, idle life, glasses/hat identity) while the
  **player is the least** (no knees, no hands, dead idle). The hierarchy is inverted — the protagonist
  should be the most refined.
- **Scale spread (1.0 / 1.15 / 1.35)** is large; NPC1 at 1.35 plus its tall torso can feel oversized next
  to the player.
- NPC1's role (synth specialist) is supported by `SynthPerformance`; NPC2's brief-listed behaviours
  (sit/drink/dance/talk/nod/watch) are mostly unbuilt.

## 8. Recommended character design direction

Keep the voxel/low-poly language (it's the house style) but push it from "toy" toward "PS2-era indie
musician." Specifics:

- **Player proportions:** reduce head/hood height ~25–30% and width ~15%; widen the shoulder yoke to
  ~0.9–0.95; add a subtle waist taper (narrower box below the chest) so the torso reads as a body, not a
  block. Target ~5 heads tall.
- **Value & colour (highest priority):** lift the player out of pure black. Keep the dark-hoodie identity
  but at a readable value — e.g. hoodie `#20263a`→`#2b3350` range, legs a hair lighter than the shoes,
  and add **one warm signature accent** (a hoodie drawstring, cuff, or the existing amber headphone
  accent enlarged) so the player never disappears against furniture. Reserve near-black for the *shoes*
  only. Consider a very subtle rim/edge cue at gameplay distance (see §Camera).
- **Hair:** add a small messy hair silhouette peeking from the hood (a couple of angled tufts) so the
  head reads as a person from behind, not a smooth hood.
- **Hands:** give the player simple block/sphere hands (match NPC2's language) — restores the
  "music-making hands" cue and unifies the cast.
- **Emotional posture set:** author the five states as additive offsets blended by a single eased weight
  (like `useGroove`'s `amount`), reading `stress` / `energy` / `crystal` from the store:
  - *Neutral:* soft slouch, gentle breathing bob, occasional weight shift.
  - *High stress:* raised shoulders, torso curled in, head lower, shorter/faster idle, tighter arms.
  - *Low energy:* deeper slouch, slower everything, heavier steps, occasional neck roll / stretch.
  - *Inspired:* straighter spine, quicker purposeful steps, subtle head-nod to the beat, livelier hands.
  - *Connected/Happy:* open shoulders, relaxed neck, looks around the room, subtle bounce.
  These reuse the existing rig — no new character system.
- **Walk:** add a knee joint to the player leg (mirror `Npc2Leg`) and distance-lock the stride phase to
  kill foot-slide.
- **Idle life:** give the player the breathing + glance NPC2 already has.
- **NPC2 behaviours:** add the sit/drink/nod/watch/observe states from the brief, reusing `useGroove`
  and simple head/arm offsets.
- **Cohesion:** standardize limb language (either all capsule or all box) across the three characters;
  simplest is to give the player capsule-ish forearms + hands to match the NPCs, keeping the boxy torso.

## 9. Recommended implementation changes

All changes live in `src/components/game/ThreeStudio.tsx` unless noted. Nothing here alters gameplay,
save data, the emotional-crystal logic, NPC behaviour trees, camera, or chapter structure — these are
geometry/material/animation refinements to existing components.

| # | Change | File(s) / component | System | Design reason | Difficulty | Regression risk |
|---|---|---|---|---|---|---|
| 1 | Lift player materials off near-black + one warm accent | `ThreeStudio.tsx` `CLOTH`/`CLOTH_DARK`/shoe colours, `UpperBody` | materials only | Fix silhouette loss (top problem) | **LOW** | **LOW** |
| 2 | Shrink/narrow head+hood, widen shoulder yoke, taper torso | `UpperBody` L149–166 | geometry | Kill the toy/chibi read | **MEDIUM** | **MEDIUM** (seated/lying/groove offsets assume current sizes) |
| 3 | Add messy-hair tufts under the hood | `UpperBody` head group | geometry | Silhouette identity from behind | **LOW** | **LOW** |
| 4 | Give player block/sphere hands | `UpperBody` forearm groups | geometry | Music-hands cue + cast cohesion | **LOW** | **LOW** |
| 5 | Add a knee to the player walk leg; distance-lock stride | `WalkLeg` + `WalkingFigure` L201–243 | animation | Remove stiffness + foot-slide | **MEDIUM** | **MEDIUM** (walk timing) |
| 6 | Player idle breathing + occasional glance | `WalkingFigure` idle branch | animation | Protagonist should feel alive | **LOW** | **LOW** |
| 7 | **Emotional posture system** (5 states, eased blend from `stress`/`energy`/`crystal`) | new hook like `useGroove` applied in `UpperBody`/`WalkingFigure`; reads store | animation (reads existing state) | The core brief + Patch 0.2 body-language goal | **HIGH** | **MEDIUM** (must not fight `useGroove`/walk lean; needs careful additive blending) |
| 8 | Relax the lying pose (bend knees/arms instead of rigid rotate) | `Player` lying branch L454–462 | animation/geometry | "On the bed," not a tipped statue | **MEDIUM** | **MEDIUM** (bed alignment was just fixed — re-verify sink) |
| 9 | NPC2 extra states: sit/drink/nod/watch/observe | `Npc2` + store `npc2` flags | animation (+ maybe 1–2 store flags) | Match NPC2 brief; richer world | **MEDIUM–HIGH** | **MEDIUM** (touches NPC2 state) |
| 10 | Nudge NPC1 value/scale so it separates from the player and isn't oversized | `FriendTorso`/`Visitor` colours + `scale` | materials/scale | Colour separation, size balance | **LOW** | **LOW** |
| 11 | Unify limb construction language across cast | `UpperBody`, `FriendTorso`, `Npc2` | geometry | One-universe cohesion | **MEDIUM** | **MEDIUM** |
| 12 | Optional subtle rim/edge cue at gameplay distance | material/post | rendering | Separate character from dark bg | **MEDIUM** | **MEDIUM** (bloom/perf interaction) |

## 10. Priority patch list

- **P0 — critical (do first):**
  - #1 Player value/colour lift + warm accent (fixes the blob problem; lowest risk, highest payoff).
  - #7 Emotional posture system (the brief's headline ask; the body must express state). *Ship a first
    pass — Neutral + Stress + Low-Energy — then extend.*
- **P1 — major polish:**
  - #2 Head/shoulder/torso proportion pass (de-toy the player).
  - #5 Knee + distance-locked stride (walk quality + foot-slide).
  - #6 Idle breathing/glance for the player.
- **P2 — secondary polish:**
  - #3 Hair tufts, #4 hands, #8 relaxed lying pose, #10 NPC1 value/scale nudge.
  - #9 NPC2 behaviour states (sit/drink/nod/watch).
- **P3 — optional:**
  - #11 Full limb-language unification, #12 rim/edge readability cue.

**Guardrails honoured:** no new character system (all changes reuse the existing procedural rig +
`useFrame`), no art-direction change (still voxel/low-poly), and gameplay, saves, crystal logic, NPC
behaviour, camera, environment, and chapter structure are untouched.
