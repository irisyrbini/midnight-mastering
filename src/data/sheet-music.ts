import { interactionById } from './interactions';

/**
 * Torn sheet-music puzzle. Every significant interactive room object holds ONE fragment of a single
 * damaged score; engaging with it for the FIRST time tears that fragment loose. Collect them all and the
 * page reassembles — one of the conditions for hearing the finished song (see the album gate in the store).
 *
 * The order here IS the reading order of the reconstructed page: left→right, top→bottom across a grid of
 * `SHEET_COLS` columns. Each id must be a real interaction id (see data/interactions.ts). This list is the
 * single source of truth shared by the store (awarding) and the UI (toast + assembly view).
 *
 * Curated from the room's genuinely interactive objects — instruments, gear, and the life-props the player
 * actually engages with — rather than every incidental prop, so the count reads as a real score page and
 * the fragments feel like scattered pieces of the music, not completionist filler.
 */
export const SHEET_PIECE_IDS: readonly string[] = [
  // System 1 — the setup: where the record is written and heard back
  'laptop', 'modularSynths', 'mechanicalKeyboard', 'dualMonitors', 'studioMonitors',
  // System 2 — the instruments: the melody and its texture
  'portasound', 'sk5', 'acousticGuitar', 'electricGuitar', 'mic',
  // System 3 — voice, words, and the room breathing
  'ukulele', 'lyricNotebook', 'audioInterface', 'shelves', 'window',
  // System 4 — the life around the work: rest, hunger, escape, the vices
  'bed', 'miniFridge', 'switch', 'vodka', 'cigarettes',
];

export const SHEET_PIECE_TOTAL = SHEET_PIECE_IDS.length;
export const SHEET_COLS = 5;
export const SHEET_ROWS = Math.ceil(SHEET_PIECE_TOTAL / SHEET_COLS);

/** Ordered index of a piece (its slot on the page), or -1 if the object isn't a piece source. */
export const pieceIndex = (id: string): number => SHEET_PIECE_IDS.indexOf(id);

/** Grid cell (column, row) for a piece slot. */
export const pieceCell = (index: number): { col: number; row: number } => ({
  col: index % SHEET_COLS,
  row: Math.floor(index / SHEET_COLS),
});

/** Human label for a fragment, taken from its interaction so the two stay in sync. */
export const pieceLabel = (id: string): string => interactionById[id]?.label ?? id;

/** How many of the ordered pieces are present in a collected-map. */
export const collectedCount = (pieces: Record<string, boolean>): number =>
  SHEET_PIECE_IDS.reduce((n, id) => (pieces[id] ? n + 1 : n), 0);
