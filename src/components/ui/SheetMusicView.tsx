'use client';

import { useGameStore } from '@/store/game-store';
import { SHEET_PIECE_IDS, SHEET_PIECE_TOTAL, collectedCount } from '@/data/sheet-music';
import { SheetMusicPaper } from './SheetMusicPaper';

/**
 * The Torn Score view. Collected fragments are auto-assembled into their correct slots (no manual jigsaw);
 * missing fragments read as dark torn gaps in the page. As pieces accumulate the score becomes legible,
 * and the final piece resolves it into one whole page — quietly, no fanfare.
 */
export function SheetMusicView() {
  const open = useGameStore((s) => s.sheetMusicOpen);
  const close = useGameStore((s) => s.closeSheetMusic);
  const pieces = useGameStore((s) => s.sheetMusicPieces);
  const complete = useGameStore((s) => s.sheetMusicComplete);
  if (!open) return null;

  const collected = new Set<number>();
  SHEET_PIECE_IDS.forEach((id, i) => { if (pieces[id]) collected.add(i); });
  const count = collectedCount(pieces);

  return (
    <section className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6 backdrop-blur-sm" onClick={close}>
      <div
        className="w-[min(720px,100%)] rounded-2xl border border-paper/40 bg-[#12141f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-[#d8c79c]/80">TORN SCORE</p>
            <h2 className="mt-1 text-2xl font-semibold text-paper">{complete ? 'The score, whole again' : 'Piecing the score back together'}</h2>
            <p className="mt-1 text-sm text-paper/60">
              {complete
                ? 'Every fragment recovered. The finished song can be heard once the album is done and the crystal turns green.'
                : 'Each object you truly engage with gives up a torn fragment of the same page.'}
            </p>
          </div>
          <button onClick={close} className="rounded-md border border-paper/30 px-3 py-1 text-sm text-paper/70 hover:bg-paper/10">Close</button>
        </div>

        <div className={`mt-5 rounded-xl border p-4 transition-colors ${complete ? 'border-[#d8c79c]/50 bg-[#1c1d16]' : 'border-paper/15 bg-black/30'}`}>
          <SheetMusicPaper collected={collected} className={`w-full ${complete ? 'drop-shadow-[0_0_18px_rgba(216,199,156,0.25)]' : ''}`} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full border border-paper/25 bg-black/30">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(count / SHEET_PIECE_TOTAL) * 100}%`, backgroundColor: complete ? '#d8c79c' : '#b78a4e' }} />
          </div>
          <p className="font-mono text-sm text-paper/75">Sheet Music {count} / {SHEET_PIECE_TOTAL}</p>
        </div>
      </div>
    </section>
  );
}
