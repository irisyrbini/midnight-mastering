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

## 3a. Floors: studio → hallway → elevator → { lobby, rooftop }

The building's spaces connect in a line, with the elevator serving three floors:

```
Studio  ──red door──►  Hallway  ──elevator──►  Studio floor · Lobby (1F) · Rooftop
```

- **Studio door.** The studio's `entrance` object is the red door out (`action: 'entrance'`, not a collider, so the producer can walk right up to it). Using it raises *Leave the studio?* Yes/No; Yes drops the player into the **hallway** (`apartment-hallway`). Re-entering the studio (from the hallway's red door, `returnToStudio`) spawns the player back at that same door (`ENTRANCE_POSITION`), so leaving and entering keep spatial continuity through one door.
- **Hallway** (`Hallway`) — the studio-floor corridor: the red studio door on the left, the elevator on the right (`ELEVATOR`). Its walls use the studio's translucent-`depthWrite`-off treatment so they never occlude the camera.
- **Elevator** (`elevator`, `ElevatorCar`) — pure transport with **floor selection**, never a destination you explore. `enterElevator()` steps the rider in with the doors open and `elevatorTo === null`, which shows the `ElevatorFloors` panel (**Studio / Lobby · 1F / Rooftop**). `selectFloor(loc)` starts the ride: doors shut over the first second, the car travels `ELEVATOR_RIDE_MS` (5s), a chime sounds one second before arrival, and `tick` drops the rider at that floor's `FLOOR_SPAWN`. Interior is cosy and dated (warm light, marble tile, brushed metal, dado rail, brass handrail, mirror). Own fixed camera (`ElevatorRig`).
- **Lobby** (`apartment-lobby`, `Lobby`) — the ground floor of an **older apartment building**: terrazzo floor, cream-over-dark-green walls, brass mailboxes, radiator, bench, potted palm, street doors. Walls translucent like the studio's. A separate explorable space, **not** replaced by the elevator (`ELEVATOR` button rides back up).
- **Rooftop** (`apartment-rooftop`, `Rooftop`) — a new explorable floor reachable only by the elevator, and genuinely **outdoors**: it shares the world with the windows (see §3b), showing one sun/moon on the same `dayCycle` and weather. Deck with seams, a low parapet on all four edges, a water tank on stilts, roof vents, a festoon-light string, a distant city skyline, and the elevator head-house back down.

`Hallway`, `Lobby` and `Rooftop` are their own scale, so each uses `PlaceRig` for framing. The `apartment-corridor` id from an earlier build still routes to the hallway so older saves land somewhere sensible.

Note the scenes have no environment map, so **high `metalness` renders black** under punctual lights — elevator/lobby metals keep metalness ≈ 0.25–0.35.

**Going outside is a real choice:** the going-outside buff (`stress −9`, `energy −4`, `social +3`) is gated on actually reaching the lobby (`visitedLobby`) and lands once, on the next return into the studio.

## 3b. The shared outdoor world (windows + rooftop)

Both windows call one `WindowUnit`, driven by the same `dayCycle(minuteOfDay)` + `weather`, so they always show the **same** sky, time and weather — the second window is another viewpoint, not a separate environment. Two rules keep it honest:

- **One sun.** Only the main window (`celestial` = true, the default) draws the sun and moon disc; `window2` passes `celestial={false}`, so a second window never mints a second sun. The two windows face perpendicular walls, so physically the sun belongs to at most one of them anyway. The rooftop, being outdoors, shows the same single sun on the same `dayCycle` curve.
- **Sun stays outside.** Every outdoor layer — sky backdrop, sun, moon, stars, city lights, clouds, rain — is recessed to `z ≤ 0`, i.e. **behind the window's front frame face**, so the sun mesh can never intersect the glass or clip into the room. Sunlight still enters (the directional light and sky tint are unchanged); only the disc is held outside.

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
