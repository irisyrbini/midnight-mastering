'use client';

import { useId } from 'react';
import { SHEET_COLS, SHEET_ROWS, SHEET_PIECE_TOTAL } from '@/data/sheet-music';

// ── One damaged sheet-music page, drawn as SVG. The whole score is laid out once across a grid of cells;
//    a fragment is simply the slice of that score under one cell. Because the ink is continuous, staves and
//    notation line up across fragments — collecting pieces gradually reveals a single recognizable page,
//    not a set of unrelated cards. Colours are fixed warm-paper tones (aged score), independent of theme. ──

const CELL = 100;
const PAGE_W = SHEET_COLS * CELL;
const PAGE_H = SHEET_ROWS * CELL;

const PAPER = '#e9dfc4';       // aged off-white
const PAPER_EDGE = '#d8cba6';  // slightly darker deckle
const INK = '#33301f';         // faded brown-black ink
const INK_SOFT = '#6a6247';    // lighter pencil
const GAP = '#171a24';         // the dark recess where a fragment is still missing

/** Deterministic tiny PRNG so the score is identical every render (and matches between page + fragment). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Note = { x: number; y: number; stemUp: boolean; beamNext: boolean; flag: boolean };
type System = { cy: number; lines: number[]; notes: Note[]; barlines: number[] };

/** Build the whole score once (module-level constant): one staff "system" per grid row, each with a run of
 *  notes at varied pitches, a few beamed pairs, flags, and bar lines. */
const SYSTEMS: System[] = (() => {
  const rng = mulberry32(0x5c04e);
  const out: System[] = [];
  for (let r = 0; r < SHEET_ROWS; r += 1) {
    const cy = r * CELL + 54;
    const lines = [-16, -8, 0, 8, 16].map((d) => cy + d);
    const notes: Note[] = [];
    const barlines: number[] = [];
    let x = 40;
    let sinceBar = 0;
    while (x < PAGE_W - 14) {
      const step = Math.round((rng() - 0.5) * 8); // pitch as staff steps from the middle line
      const y = cy + step * 4;
      const stemUp = y >= cy;
      const beamNext = rng() < 0.42 && x < PAGE_W - 60;
      const flag = !beamNext && rng() < 0.3;
      notes.push({ x, y, stemUp, beamNext, flag });
      x += beamNext ? 15 : 20 + Math.floor(rng() * 12);
      sinceBar += 1;
      if (sinceBar >= 4 && rng() < 0.5 && x < PAGE_W - 30) { barlines.push(x - 8); sinceBar = 0; }
    }
    out.push({ cy, lines, notes, barlines });
  }
  return out;
})();

/** All the ink of the full page, in PAGE_W×PAGE_H coordinates. Rendered once; masked/cropped by callers. */
function ScoreInk() {
  return (
    <g fill="none" stroke={INK} strokeWidth={0.8} strokeLinecap="round">
      {/* handwritten-looking title across the top margin */}
      <text x={PAGE_W / 2} y={20} fill={INK_SOFT} stroke="none" fontSize={13} fontStyle="italic"
        fontFamily="'Georgia','Times New Roman',serif" textAnchor="middle" opacity={0.8}>
        the song i keep almost finishing
      </text>
      {SYSTEMS.map((sys, i) => (
        <g key={i}>
          {/* staff */}
          {sys.lines.map((y, j) => <line key={j} x1={6} y1={y} x2={PAGE_W - 6} y2={y} opacity={0.85} />)}
          {/* stylised treble clef: a simple curl so it always renders (no glyph-font dependency) */}
          <path d={`M18 ${sys.cy + 18} C 6 ${sys.cy + 10}, 8 ${sys.cy - 14}, 20 ${sys.cy - 14} C 30 ${sys.cy - 14}, 30 ${sys.cy + 6}, 16 ${sys.cy + 8} C 8 ${sys.cy + 9}, 10 ${sys.cy - 2}, 18 ${sys.cy - 2}`}
            strokeWidth={1.4} opacity={0.85} />
          <line x1={19} y1={sys.cy - 20} x2={19} y2={sys.cy + 22} strokeWidth={1.4} opacity={0.85} />
          {/* time signature on the first system */}
          {i === 0 && <text x={34} y={sys.cy + 2} fill={INK} stroke="none" fontSize={17} fontWeight={700}
            fontFamily="'Georgia',serif" textAnchor="middle">4</text>}
          {i === 0 && <text x={34} y={sys.cy + 16} fill={INK} stroke="none" fontSize={17} fontWeight={700}
            fontFamily="'Georgia',serif" textAnchor="middle">4</text>}
          {sys.barlines.map((bx, j) => <line key={`b${j}`} x1={bx} y1={sys.lines[0]} x2={bx} y2={sys.lines[4]} strokeWidth={0.9} opacity={0.7} />)}
          {/* notes */}
          {sys.notes.map((n, j) => {
            const stemX = n.stemUp ? n.x + 3.6 : n.x - 3.6;
            const stemTopY = n.stemUp ? n.y - 22 : n.y + 22;
            const next = n.beamNext ? sys.notes[j + 1] : undefined;
            // ledger line for notes sitting off the staff
            const ledger = n.y < sys.lines[0] - 2 || n.y > sys.lines[4] + 2;
            return (
              <g key={j}>
                {ledger && <line x1={n.x - 6} y1={Math.round(n.y / 4) * 4} x2={n.x + 6} y2={Math.round(n.y / 4) * 4} opacity={0.7} />}
                <ellipse cx={n.x} cy={n.y} rx={4} ry={2.9} fill={INK} stroke="none" transform={`rotate(-22 ${n.x} ${n.y})`} />
                <line x1={stemX} y1={n.y} x2={stemX} y2={stemTopY} strokeWidth={1.1} />
                {next && <line x1={stemX} y1={stemTopY} x2={(next.stemUp ? next.x + 3.6 : next.x - 3.6)} y2={next.stemUp ? next.y - 22 : next.y + 22} strokeWidth={2.2} />}
                {n.flag && <path d={`M${stemX} ${stemTopY} q 7 4 4 12`} strokeWidth={1.2} />}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

/** Shared <defs>: a paper fill with a torn/deckled edge (turbulence displacement) and a soft drop shadow. */
function PaperDefs({ tornId, shadowId }: { tornId: string; shadowId: string }) {
  return (
    <defs>
      <filter id={tornId} x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.11 0.14" numOctaves={2} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={5.5} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.4" stdDeviation="1.8" floodColor="#000" floodOpacity="0.5" />
      </filter>
    </defs>
  );
}

/** One aged-paper fragment tile (a single grid cell), torn-edged. */
function PaperTile({ col, row, tornId }: { col: number; row: number; tornId: string }) {
  return (
    <g filter={`url(#${tornId})`}>
      <rect x={col * CELL + 1.5} y={row * CELL + 1.5} width={CELL - 3} height={CELL - 3} rx={2} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.2} />
    </g>
  );
}

/**
 * The full torn page. `collected` is the set of piece INDICES present. Collected cells show aged paper +
 * their slice of the score; missing cells are dark recesses. The score ink is drawn once and masked so it
 * only shows through collected paper — the notation lines up across fragments as they accumulate.
 */
export function SheetMusicPaper({ collected, className }: { collected: Set<number>; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const tornId = `torn-${uid}`, shadowId = `sh-${uid}`, maskId = `mask-${uid}`;
  const cells = Array.from({ length: SHEET_PIECE_TOTAL }, (_, i) => ({ i, col: i % SHEET_COLS, row: Math.floor(i / SHEET_COLS) }));
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className={className} role="img" aria-label="Torn sheet music">
      <PaperDefs tornId={tornId} shadowId={shadowId} />
      <mask id={maskId}>
        <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="black" />
        {cells.filter((c) => collected.has(c.i)).map((c) => (
          <g key={c.i} filter={`url(#${tornId})`}>
            <rect x={c.col * CELL + 1.5} y={c.row * CELL + 1.5} width={CELL - 3} height={CELL - 3} rx={2} fill="white" />
          </g>
        ))}
      </mask>

      {/* missing cells: dark torn recesses with a faint ghost of the tear */}
      {cells.filter((c) => !collected.has(c.i)).map((c) => (
        <rect key={c.i} x={c.col * CELL + 2.5} y={c.row * CELL + 2.5} width={CELL - 5} height={CELL - 5} rx={2}
          fill={GAP} stroke="#2a2f3c" strokeWidth={1} strokeDasharray="3 4" opacity={0.9} />
      ))}

      {/* collected paper tiles (with shadow), then the score masked to only show through them */}
      <g filter={`url(#${shadowId})`}>
        {cells.filter((c) => collected.has(c.i)).map((c) => <PaperTile key={c.i} col={c.col} row={c.row} tornId={tornId} />)}
      </g>
      <g mask={`url(#${maskId})`}><ScoreInk /></g>
    </svg>
  );
}

/** A single torn fragment shown close-up (the collection toast). Crops the full score to one cell so the
 *  notation it carries is exactly what will sit in that slot on the assembled page. */
export function SheetMusicFragment({ index, className }: { index: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const tornId = `torn-${uid}`, shadowId = `sh-${uid}`;
  const col = index % SHEET_COLS, row = Math.floor(index / SHEET_COLS);
  const pad = 6;
  return (
    <svg viewBox={`${col * CELL - pad} ${row * CELL - pad} ${CELL + pad * 2} ${CELL + pad * 2}`} className={className} role="img" aria-label="Torn sheet-music fragment">
      <PaperDefs tornId={tornId} shadowId={shadowId} />
      <g filter={`url(#${shadowId})`}><PaperTile col={col} row={row} tornId={tornId} /></g>
      <clipPath id={`clip-${uid}`}>
        <rect x={col * CELL + 1.5} y={row * CELL + 1.5} width={CELL - 3} height={CELL - 3} rx={2} />
      </clipPath>
      <g clipPath={`url(#clip-${uid})`}><ScoreInk /></g>
    </svg>
  );
}
