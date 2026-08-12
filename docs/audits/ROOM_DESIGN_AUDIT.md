# MMHA — Room / Studio Environment Design Audit

*Art-direction review of the bedroom-studio as an emotional environment. Inspection only — no code changed. Grounded in `src/data/studio-layout.ts`, `src/components/game/RoomObjectModel.tsx`, and the `Room` shell + lighting in `src/components/game/ThreeStudio.tsx`, read against the live gameplay camera.*

Coordinate note: layout space is `0–1280 (x) × 0–~800 (y)`, `toWorld` centres on `(640, 510)`, `72` layout units = 1 world unit. "Back" = low y (far wall), "front" = high y (toward camera).

---

## Reading of the room (what's actually there)

- **Back wall (y ≈ 60–110):** main window (far left), four posters in a near-even row (x 329 / 460 / 635 / 788), a crystal-reactive LED strip, shelves + mini-fridge on the right. This wall carries almost all of the room's "stuff."
- **Left third:** instrument table (synths / portasound / SK-5) at x≈200, two guitars leaning at x≈280–362. A dense, characterful corner.
- **Centre:** the music desk (the big 5.3×2.95 surface) with the full gear set, plus the producer's chair and the friend chair. The gravitational centre of the room.
- **Right third:** the bed (far right, x≈1010, rotated), bedside window, closet and bathroom door — all pushed to the right edge and lit dimly.
- **Foreground / floor:** guitar pedal, floor switch, cables, the red entrance door bottom-left. Otherwise a large dark open floor.
- **Lighting:** cool night base (`#17263a` floor, `#243146` walls at 0.16 opacity) washed with strong red + amber point lights and a red-tone hemisphere; a warm directional "sun/moon" that shifts through the day cycle; emissive monitor screens and the LED strip as the saturated accents.

---

## Current strengths

1. **The focal point is unambiguous and correct.** The desk's dual emissive screens (orange + teal) are the brightest, most saturated, most detailed cluster in the frame; the eye lands there instantly, and the floating crystal sits just above it as the emotional focus. Focal hierarchy is doing its job.
2. **The clutter genuinely tells the story.** Ashtray, cigarettes, vodka, Red Bull, pill bottle and a lyric notebook around a half-finished record is exactly the "up too late, coping, unfinished dream" narrative from the Vision bible — told through props, not text. This is the room's biggest art-direction win.
3. **The left corner is a strong secondary vignette.** Synth table + leaning guitars reads as a working musician's overflow, and it balances the desk without competing with it.
4. **Warm-despite-night mood is achieved.** The red/amber practicals over cool blue night hit the "warm, intimate, slightly melancholic" brief; it does not read as a sterile or clinical space.
5. **The nocturnal palette is disciplined.** No rainbow RGB gamer-room clichés; the saturated colour is motivated (screens, LED, window sky), which keeps it cinematic rather than noisy.

---

## Biggest visual problems

1. **The room is strongly left-weighted; the right third and the whole foreground are dead space.** Everything with life — desk, synths, guitars, crystal, player — lives centre-left. The right third (bed, closet, bathroom) is dim and reads as "storage," and the front-of-frame floor is a large, undifferentiated dark plane. The composition tips left and empties toward the camera.
2. **The bed is not integrated.** It is shoved to the far right, dimly lit, and barely enters the main camera frame — so the single most important "rest / the other half of the producer's life" object feels peripheral and disconnected from the desk it should be in tension with.
3. **The character barely reads against the floor.** Dark clothing (`#333d52`/`#1e2432`) on a dark blue floor (`#17263a`) is low-contrast; without the crystal hovering above them the player is hard to locate — the same readability gap flagged in the Character audit, but here it's an *environment* contrast problem too.

---

## Layout problems

- **Foreground has no anchor.** There is no rug, no floor pool of light, no dropped object or grounding shadow in the front third — nothing to give the empty floor a reason to be empty. It currently reads "unfinished," not "intentional negative space."
- **Right third is a cul-de-sac.** Bed + closet + bathroom are all clustered right and dark, with nothing pulling the eye or the player over there except utility interactions.
- **Furniture grounding is weak.** Objects cast shadows, but on the dark floor the contact shadows are faint, so the guitars and chairs can read as slightly floating rather than planted.
- **The two office chairs are near-identical and adjacent**, which reads a little "meeting room" and flattens the story of *one* person who occasionally has *one* visitor.

## Lighting problems

- **Nearly all light is up at the back wall and the desk.** The front third gets very little practical light, which is *why* the foreground feels empty and the character goes dark when they walk toward the camera.
- **Red point lights are doing a lot of work at high intensity** (two reds at 9 and ~3.4). It's moodily effective but flattens local colour and can muddy the warm/cool read; there's little cool counter-fill to shape depth.
- **No intimate, motivated pool of light** (desk lamp, monitor spill onto the desk surface, a warm bedside glow) to carry the "cosy" half of the brief at ground level.

## Prop / clutter problems

- **The back wall is evenly busy** — four posters in a near-regular row plus LED plus shelves plus fridge. Even spacing reads decorated rather than lived-in; a real wall clumps and leaves gaps.
- **Clutter density is concentrated almost entirely on the desk.** The story-telling mess doesn't spill anywhere else (floor, bed, shelves), so the rest of the room feels comparatively staged and tidy by contrast.
- **Left and right walls are nearly bare** while the back wall is saturated — the busy-ness is unevenly distributed rather than deliberately paced.

## Color problems

- **Cool floor + cool walls + dark character = a large low-contrast cool mass** in the lower half of the frame, with all the warmth and saturation pushed to the upper third. The warm/cool balance is vertically stacked rather than woven through the space.
- **The pastel pink/green bed is the one soft warm note on the right**, but it's too dim and too far out of frame to pay off as a colour accent.

## Camera composition problems

- **Default framing leaves the right third and foreground as empty dark quadrants.** The interesting silhouette (desk + synths + guitars) sits left-of-centre, so the frame is unbalanced and bottom-heavy with void.
- **The player frequently sits low-contrast against floor**, so from the fixed high-iso angle the protagonist is the least legible element in their own scene.
- **Depth cueing is thin in front of the desk** — little separates midground (desk) from foreground (chairs/floor) tonally, so the space reads flatter than it is.

---

## Emotional storytelling opportunities

- **Make the bed the emotional counterweight to the desk.** Pull it a touch more into frame and give it its own soft, warm, low practical so the room becomes a dialogue between *work (cool, bright, unfinished)* and *rest (warm, quiet, waiting)* — directly on-theme for "unfinished dreams and permission."
- **Let the mess escape the desk.** A few grounded floor props (a discarded hoodie, a coffee mug, a cable coil, a stray lyric page) in the foreground would both anchor the empty floor and extend the lived-in story outward.
- **Use ground-level warm light as intimacy.** A desk-lamp pool and a bedside glow would carry "cosy enough to want to stay" at the level the character actually walks, and would rescue the player's readability.
- **Let the room state track the emotional arc.** As the crystal moves red→green, small environmental shifts (a curtain opening, clutter tidying by a notch, the bed made) would let the space *feel* progress rather than only the HUD reporting it — the Patch 0.2.1 "world feedback" layer, applied to the environment.

---

## Recommended redesign direction

Keep the art direction, palette and focal hierarchy — they work. The room's problem is **distribution**, not style: life is packed centre-left and up-high, leaving the right and the foreground as dark voids, and the warm/cool contrast is stacked top-to-bottom instead of shaped through the space. The direction is to **rebalance mass and light across the frame** — give the foreground an anchor, pull the bed into the story as a warm counterweight, and push a little intimate ground-level light and a little mess outward — so the whole room reads as one intentional, inhabited space rather than a bright desk in front of a dark room.

---

## Low-risk changes

*(pure add / retune, no layout re-architecture, save-safe)*

1. **Contact-ground everything** — a soft dark radial "shadow" decal under the guitars, chairs, bed and instrument table so nothing reads as floating.
2. **Foreground anchor** — one small floor prop cluster (mug + coiled cable + dropped page) in the front-left-of-centre void.
3. **Warm bedside practical** — a single low warm point light near the bed so the right third stops being dead.
4. **Break the poster row** — nudge the four posters off their even spacing (clump two, leave a gap, hang one lower) for a lived-in wall.
5. **Lift the player's readability** — a faint rim/keylight on the character or a slightly lighter floor value directly under the desk zone so the protagonist separates from the floor.

## Medium-risk changes

*(reposition existing objects / add a light rig; still no new systems)*

1. **Pull the bed ~1 world unit toward frame centre** and angle it so it participates in the composition instead of hugging the right wall.
2. **Add a desk-lamp light pool** motivated by a small lamp prop, to carry ground-level intimacy and spill warm light onto the desk surface.
3. **Redistribute wall busy-ness** — move one or two posters to the currently-bare left/right walls so the back wall isn't carrying everything.
4. **Differentiate the two chairs** (colour/height/wear) so the second chair reads as an occasional guest, not a duplicate.
5. **Rebalance the point-light rig** — bring the red intensities down a step and add a modest cool counter-fill for depth, keeping the warm nocturnal mood but recovering local colour.

## High-risk structural changes

*(touch room shape, camera, or introduce reactive-environment systems — do not attempt without a dedicated pass)*

1. **Crystal-reactive room state** — environmental changes (curtains, clutter, bed-made, light warmth) driven by the emotional arc. High value, but it's a new system and must not disturb save compatibility or the existing crystal logic.
2. **Re-zone the right third** into a genuine "rest / away-from-work" nook (bed + window + a soft chair) as a deliberate second focal area, rebalancing the whole floor plan.
3. **Camera framing revision** — nudge the default target/rotation to recentre the composition and cut the dead right/foreground quadrants. Camera is explicitly a preserve-item in the standing constraints, so this is last-resort only.

---

*Nothing here is implemented. Recommend starting with the Low-risk set (grounding shadows, a foreground anchor, a warm bedside light, breaking the poster row, character readability) — all additive, save-safe, and each independently shippable.*
