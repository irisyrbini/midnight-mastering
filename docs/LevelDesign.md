# Level Design — the apartment studio

> Source of truth for spatial layout. Mirrors `src/data/studio-layout.ts`. Locations: `apartment-studio`, `elevator`, `apartment-lobby`.

## 1. Layout philosophy

One compact, lived-in bedroom studio fills 75–90% of the viewport (per [ArtBible.md](ArtBible.md)). Every object placed is an interaction node — there is no pure set-dressing. The composition preserves a required reading order: **window → desk → bed/door**, so the eye lands on the work first, then the exits (rest, food, the outside world).

## 2. Coordinate space

Objects live in a logical 2D map (roughly `1280 × 720`) as `StudioObject { id, x, y, width, height, color, shape?, rotationY? }`. The Three.js renderer maps this to world space with `toWorld(x, y) = [(x-640)/UNITS_PER_WORLD, (y-510)/UNITS_PER_WORLD]`, i.e. the player anchor `(640, 510)` is world origin. The legacy Pixi scene consumes the same coordinates directly.

**Room size.** `UNITS_PER_WORLD` (currently `72`) is how many logical units make up one world unit — *lowering it enlarges the studio*. The same layout spreads across more floor while furniture keeps its modelled size, so the gaps between pieces grow and there is more room to walk. The floor, walls and ceiling scale by the matching `ROOM_SCALE = 90 / UNITS_PER_WORLD`, as do the camera's start position, its orbit distance limits and the fog band — so the room grows without changing its proportions, framing or mood. Enlarging the studio is a one-constant change; never hand-edit the shell dimensions on their own.

`shape` is one of `rect | window | guitar | light`, driving special geometry.

## 3. Zones

| Zone | Objects | Player intent |
|---|---|---|
| **Back wall / atmosphere** | window, posters, LED lights, shelves | mood, social relief, memory |
| **Work surface (center)** | music desk, dual monitors, laptop, studio monitors, audio interface, lyric notebook | the album; opens the DAW |
| **Instruments (left)** | modular synths, PortaSound, sample keyboard, acoustic guitar, electric guitar | creativity + flow |
| **Coping shelf (desk right)** | ashtray, cigarettes, vodka, energy drink, pill bottle | short-term relief, emotional debt |
| **Living / exits** | bed, mini fridge, bathroom, elevator button, closet, cables, handheld console | needs restoration, leaving |

Two windows now light the room: the main one on the back wall, and `window2` mounted flat against the **right wall on the bed side** (`rotationY: -π/2`). Both render the same `WindowUnit`, so both read the identical day-cycle and weather state — sunrise, rain and hail appear in both at once, and any future weather is inherited automatically. `WindowUnit` takes a `width`, and everything drawn inside the opening (stars, city lights, rain) scales with it so a narrower window never overflows its frame.

## 3a. The elevator and the lobby

The studio's `entrance` object is the **elevator call button**. Using it raises a *Leave the studio?* Yes/No confirmation; choosing Yes moves the player into the `elevator` location for a `ELEVATOR_RIDE_MS` (5s) ride: the doors slide shut over the first second, the car travels, a chime sounds one second before arrival, and the doors part again as `tick` lands the player on the destination floor. The lobby's call button rides back the other way, indefinitely.

The car interior is deliberately **cosy and dated, not modern**: warm orange light, marble tile, brushed-metal walls with a wood dado rail and brass handrail, a mirror on the wall the rider faces, a soft ceiling light panel and a brass button panel. It has its own fixed camera (`ElevatorRig`) because the studio's orbit distances would sit outside the car.

Note the scene has no environment map, so **high `metalness` renders black** under punctual lights — elevator surfaces keep metalness ≈ 0.25–0.35 and let the diffuse colour carry.

**Going outside is a real choice:** returning to the studio applies a one-time `stress −9`, `energy −4`, `social +3`.

## 4. Movement bounds

The player is clamped to `x ∈ [90, 1190]`, `y ∈ [410, 590]` (`clampToRoom`, shared by keyboard steps and click-to-move). Objects sit above this band so the producer walks a foreground lane along the front of the room — consistent with the fixed camera framing. Clicking an object above the lane walks the player to the object's x at the lane edge and keeps it selected (see [Gameplay.md](Gameplay.md) §4).

## 5. Placement rules (for adding objects)

1. New objects must have an entry in **both** `studio-layout.ts` (position/size) and `interactions.ts` (behavior). A missing pair will crash label lookup.
2. Keep the window→desk→bed/door reading order intact; do not occlude the crystal's clear space above the player anchor.
3. Respect zone semantics: coping objects stay clustered and visually quieter than hero instruments.
4. Minimum readable footprint ≈ 32px at 1440px width (Art Bible §2).

## 6. Revision log

- **Widened the walkable floor** (`clampToRoom`: x∈[70,1240], y∈[150,780]) so the producer can roam the open front and walk **behind the desk to the window**. No collision — the producer passes around/through furniture.
- `entrance` moved to the far front-left (more room to move); it now uses a reactive `EntranceDoor` whose leaf **swings open** when interacted (`entranceOpen` in the store).
- `bed` moved beside the closet on the right wall and **angled** (`rotationY: π/2`); it uses `action: 'lie'` so interacting lays the producer down (see [Gameplay.md](Gameplay.md) §4).
- `closet` is a **sliding-door wardrobe** (`SlidingCloset`) mounted flush to the right wall.
- `ledLights` recolours with the crystal (`LedStrip`, red→yellow→green); the `window` gained a **starfield** (drei `Sparkles` + bloom-catching bright stars).
- `bathroom` moved to the **right wall** beside the closet (`rotationY: -π/2`, same side as the closet); `miniFridge` moved to sit **next to the desk's right corner**; `entrance` moved further out to the **front-left corner** for more central floor space.
- The `entrance` door goes **translucent while open** (leaf opacity lerps to ~0.28) and **auto-closes after `ENTRANCE_AUTOCLOSE_MS` (5s)** via a timer in `EntranceDoor`.
- `miniFridge` pushed back against the wall behind the desk's right side; it now uses `action: 'fridge'` — interacting **opens the door with a warm orange interior light**, and interacting again (or Enter) closes it (`Fridge` component, `fridgeOpen`).
- The `window` is **openable** (`action: 'window'`, `windowOpen`): its glass pane tilts open awning-style and opening it **drops stress** (−22); its message says so. Added **posters2–4** on the back wall, a **mic** and a **phone** on the desk, and recoloured the **audio interface metallic red**.
- Note: the orbit camera is fixed on room centre, so edge furniture (bed, right-wall doors) frames the producer near the screen edge — orbit to view.

## 7. Earlier revision log

- The three doors (`entrance`, `bathroom`, `closet`) were spread apart in `studio-layout.ts` so they no longer cluster — entrance front-left, bathroom front-right, closet right-rear.
- `closet` is mounted flush against the **right wall** (world x≈7) via `rotationY: -π/2` (new optional `StudioObject.rotationY`, applied by `RoomObject`).
- `studioMonitors` was recentred on the monitors and renders as **two speaker cabinets flanking the screens** (`RoomObjectModel.tsx`).
- Added a second **`instrumentTable`** on the left; the non-guitar instruments (`modularSynths`, `portasound`, `sk5`) now sit on it at `TABLE2_Y` (see `TABLE_IDS`). Guitars remain floor-standing in front.
- Added a **`chair`** in front of the desk; interacting with it seats the producer (see [Gameplay.md](Gameplay.md) §4).
- Walls are translucent (`depthWrite` off) so orbiting never clips through an occluding wall; a right wall was added for the closet.

## 7. Future locations (planned, not built)

The architecture anticipates additional compact locations (convenience store, laundromat, stairwell, rooftop, transit platform). Each would be its own layout module + interaction set, reachable via the `entrance` node, reusing the same coordinate→world mapping and camera family.
