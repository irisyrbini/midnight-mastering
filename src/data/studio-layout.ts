/**
 * `wall` anchors an object to a room wall: its position along the wall (and its height) come from the
 * layout, but its distance from the wall is derived from the wall plane in the renderer, so it stays
 * flush no matter how the room is sized. Everything wall-mounted (windows, posters, shelves, the wall
 * LED strip, the closet and bathroom doors on the right wall) carries this tag.
 */
export type StudioObject = { id: string; x: number; y: number; width: number; height: number; color: string; shape?: 'rect' | 'window' | 'guitar' | 'light'; rotationY?: number; wall?: 'back' | 'front' | 'right' | 'left' };

/** Original bedroom-studio map. Coordinates preserve the required window → desk → bed/door composition. */
export const STUDIO_OBJECTS: StudioObject[] = [
  { id: 'window', x: 120, y: 70, width: 330, height: 132, color: '#31597a', shape: 'window', wall: 'back' },
  // Second window on the bed side of the room, mounted flat against the right wall.
  { id: 'window2', x: 1168, y: 170, width: 100, height: 190, color: '#31597a', shape: 'window', rotationY: -Math.PI / 2, wall: 'right' },
  // Posters clumped into a left pair and a right pair with a deliberate gap between (a lived-in wall,
  // not an evenly-spaced gallery); posters2 hangs a little lower to break the row line.
  { id: 'posters', x: 432, y: 82, width: 100, height: 78, color: '#6d4056', wall: 'back' },
  { id: 'posters2', x: 690, y: 84, width: 100, height: 78, color: '#3a5a6d', wall: 'back' },
  { id: 'posters3', x: 800, y: 80, width: 100, height: 78, color: '#5c4a2e', wall: 'back' },
  { id: 'posters4', x: 312, y: 84, width: 100, height: 78, color: '#4a3550', wall: 'back' },
  { id: 'ledLights', x: 680, y: 62, width: 360, height: 22, color: '#b73545', shape: 'light', wall: 'back' },
  { id: 'shelves', x: 1150, y: 106, width: 112, height: 154, color: '#5e5560', wall: 'back' },
  // Extended to the right so its right edge sits side-by-side with the main desk's left edge (one long
  // counter). The model box + legs are lengthened to match (RoomObjectModel case 'instrumentTable').
  { id: 'instrumentTable', x: 60, y: 250, width: 340, height: 180, color: '#5a4a4c' },
  // Synth faces the WINDOW (rotated 180°); NPC1 performs from the window side (see SYNTH_PERFORMANCE_ANCHOR).
  { id: 'modularSynths', x: 143, y: 225, width: 170, height: 105, color: '#61455a', rotationY: Math.PI },
  { id: 'musicDesk', x: 492, y: 202, width: 350, height: 160, color: '#6c5b5c' },
  { id: 'chair', x: 604, y: 430, width: 90, height: 100, color: '#20242c' },
  { id: 'friendChair', x: 704, y: 430, width: 90, height: 100, color: '#292d36' },
  { id: 'dualMonitors', x: 586, y: 185, width: 155, height: 54, color: '#3d7480' },
  { id: 'mic', x: 484, y: 300, width: 46, height: 46, color: '#20242c' },
  { id: 'laptop', x: 626, y: 270, width: 92, height: 58, color: '#54728c' },
  { id: 'studioMonitors', x: 603, y: 180, width: 120, height: 60, color: '#d9d9d0' },
  { id: 'portasound', x: 120, y: 342, width: 154, height: 55, color: '#d8c6a4' },
  { id: 'sk5', x: 282, y: 348, width: 100, height: 48, color: '#aeb2b3' },
  { id: 'audioInterface', x: 752, y: 267, width: 54, height: 44, color: '#b73545' },
  { id: 'mechanicalKeyboard', x: 600, y: 402, width: 112, height: 30, color: '#20242c' },
  { id: 'mouse', x: 701, y: 359, width: 30, height: 28, color: '#343b48' },
  { id: 'lyricNotebook', x: 550, y: 320, width: 50, height: 38, color: '#e7e1d5' },
  { id: 'ashtray', x: 497, y: 351, width: 34, height: 26, color: '#8892a0' },
  { id: 'cigarettes', x: 520, y: 353, width: 46, height: 28, color: '#e8e2d6' },
  { id: 'vodka', x: 765, y: 331, width: 30, height: 66, color: '#55758a' },
  { id: 'redBull', x: 800, y: 337, width: 26, height: 54, color: '#d05e55' },
  { id: 'pillBottle', x: 736, y: 343, width: 25, height: 42, color: '#d9b64d' },
  { id: 'cables', x: 422, y: 420, width: 96, height: 45, color: '#313a48' },
  { id: 'guitarPedal', x: 438, y: 548, width: 58, height: 42, color: '#2c3440' },
  { id: 'switch', x: 526, y: 422, width: 76, height: 42, color: '#5d7a86' },
  { id: 'acousticGuitar', x: 235, y: 470, width: 62, height: 156, color: '#ba8653', shape: 'guitar' },
  { id: 'electricGuitar', x: 360, y: 470, width: 58, height: 156, color: '#e9e8df', shape: 'guitar' },
  { id: 'bed', x: 1075, y: 305, width: 218, height: 168, color: '#54667d', rotationY: Math.PI / 2 },
  { id: 'bedPhone', x: 1140, y: 335, width: 34, height: 54, color: '#0c0e14' },
  // Pushed up against the back wall (low y) and clear of the bed, which moved right.
  // Back face is aligned to the room's back-wall plane (the fridge remains a floor object).
  { id: 'miniFridge', x: 982, y: 20, width: 86, height: 132, color: '#a8aeb6', wall: 'back' },
  // A stylised ukulele leaning beside the bed — interactive (picked up + played). Not a collider.
  { id: 'ukulele', x: 975, y: 545, width: 50, height: 74, color: '#c68a4e' },
  // Grey bean bag in the front-left corner by the studio door — perch-height, sit-able by every character.
  // Anchored to the front wall opposite the main window; the backrest remains flush if the room resizes.
  { id: 'sofa', x: 545, y: 928, width: 260, height: 96, color: '#4a5464', rotationY: Math.PI, wall: 'front' },
  // Pushed to the front-right corner, clear of the bed.
  { id: 'bathroom', x: 1192, y: 690, width: 120, height: 88, color: '#456473', rotationY: -Math.PI / 2, wall: 'right' },
  // Studio exit door mounted flat against the LEFT wall (rotated a quarter turn), moved toward the front
  // corner so it's clear of the (now longer) instrument desk.
  { id: 'entrance', x: -78, y: 600, width: 112, height: 76, color: '#b73545', rotationY: Math.PI / 2 },
  // Slid along the right wall into the clear stretch between the bed and the bathroom (was overlapping the bed).
  { id: 'closet', x: 1205, y: 520, width: 94, height: 162, color: '#465164', rotationY: -Math.PI / 2, wall: 'right' },
];

// ── Object-relative interaction anchors ────────────────────────────────────────────────────────────
// One source of truth for where a character stands / snaps to use a piece of furniture, DERIVED from that
// furniture's layout transform. Move the furniture above and its anchor moves with it — no interaction
// coordinate is duplicated at an old position. Floor furniture is drawn ~1.4× its footprint (see
// FURNITURE_SCALE / FURNITURE_COLLISION_SCALE), so "front of" anchors clear that enlarged footprint.
export type Point = { x: number; y: number };
export const FOOTPRINT_SCALE = 1.4; // must match FURNITURE_SCALE (renderer) / FURNITURE_COLLISION_SCALE (store)

export const objectById = (id: string): StudioObject | undefined => STUDIO_OBJECTS.find((o) => o.id === id);

/** Centre of an object's footprint, in logical room coords. */
export const objectCenter = (id: string, fallback: Point = { x: 640, y: 510 }): Point => {
  const o = objectById(id);
  return o ? { x: o.x + o.width / 2, y: o.y + o.height / 2 } : fallback;
};

/** A standing anchor just beyond an object's FRONT (+y, room-facing) edge, clear of its scaled footprint. */
export const frontAnchor = (id: string, gap = 34, fallback: Point = { x: 640, y: 560 }): Point => {
  const o = objectById(id);
  if (!o) return fallback;
  const cx = o.x + o.width / 2;
  const front = o.y + o.height / 2 + (o.height * FOOTPRINT_SCALE) / 2; // scaled front edge
  return { x: cx, y: front + gap };
};

// The chair the producer sits in / the bed they lie on: the body snaps to the object centre, and the
// renderer places the GLB pose on top (see chairSit / bedLie root offsets in ThreeStudio).
export const CHAIR_SIT_ANCHOR = objectCenter('chair');
export const BED_LIE_ANCHOR = objectCenter('bed');
export const ENTRANCE_ANCHOR = objectCenter('entrance');

// Modular synth performance: the synth faces the WINDOW (rotated 180°), so NPC1 performs from the WINDOW
// SIDE — behind the table, clear of its scaled footprint — and faces the synth controls. Derived from the
// (moved) table + synth so it follows them.
export const SYNTH_CENTER = objectCenter('modularSynths', { x: 228, y: 277 });
export const SYNTH_PERFORMANCE_ANCHOR: Point = (() => {
  const table = objectById('instrumentTable');
  return {
    x: SYNTH_CENTER.x,
    y: table ? Math.max(160, table.y + table.height / 2 - (table.height * FOOTPRINT_SCALE) / 2 - 40) : 180,
  };
})();

// The ukulele beside the bed: the player walks to it to pick it up.
export const UKULELE_ANCHOR = objectCenter('ukulele', { x: 1000, y: 575 });

/** A small set of safe idle spots NPC1 can wander between (home base = the synth). Consumers should still
 *  collision-check before using one, so a spot that lands in furniture is simply skipped. */
// All spots sit in the OPEN FRONT floor (y ≳ 520), so straight-line walks between them stay clear of the
// back-wall furniture and the guitars; consumers still collision-check before using one.
export const NPC1_IDLE_SPOTS: Point[] = [
  SYNTH_PERFORMANCE_ANCHOR,          // home: at the modular synth
  { x: 470, y: 655 },                // open floor, front-centre-left (clear of the guitars)
  frontAnchor('musicDesk', 90),      // in front of the main desk
  { x: 820, y: 585 },                // open centre-right floor
  { x: 980, y: 640 },                // near the bed (in front of it)
];
