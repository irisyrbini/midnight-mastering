'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { SHEET_PIECE_TOTAL, collectedCount, pieceIndex, pieceLabel } from '@/data/sheet-music';
import { SheetMusicFragment } from './SheetMusicPaper';

/**
 * Short, subtle collection moment. When a fragment is torn loose it slides in for a couple of seconds:
 * the piece itself, its source, and the running count. The pickup that completes the page shows a quiet
 * "score reconstructed" note instead of a number. Never blocks input — it's an aside, not a modal.
 */
export function SheetMusicToast() {
  const cue = useGameStore((s) => s.sheetPieceCue);
  const openSheetMusic = useGameStore((s) => s.openSheetMusic);
  const [shown, setShown] = useState<{ index: number; label: string; count: number; complete: boolean } | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (cue.n <= 0) return;
    // Read the live collection at the moment of the cue (the store has already recorded this piece).
    const { sheetMusicPieces } = useGameStore.getState();
    const count = collectedCount(sheetMusicPieces);
    const complete = count >= SHEET_PIECE_TOTAL;
    setShown({ index: pieceIndex(cue.id), label: pieceLabel(cue.id), count, complete });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(null), complete ? 4200 : 2800);
    return () => window.clearTimeout(timer.current);
  }, [cue]);

  if (!shown) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2">
      <button
        onClick={openSheetMusic}
        className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#c9b892]/40 bg-night/90 px-4 py-3 text-left shadow-2xl backdrop-blur-sm animate-[fadeInUp_0.35s_ease]"
      >
        <SheetMusicFragment index={shown.index} className="h-14 w-14 shrink-0 drop-shadow" />
        <div className="pr-1">
          <p className="text-[10px] tracking-[0.18em] text-[#d8c79c]">
            {shown.complete ? 'SHEET MUSIC · RECONSTRUCTED' : 'SHEET MUSIC RECOVERED'}
          </p>
          <p className="text-sm font-semibold text-paper">
            {shown.complete ? 'The score is whole again' : `A fragment from the ${shown.label.toLowerCase()}`}
          </p>
          <p className="mt-0.5 font-mono text-xs text-paper/70">
            {shown.complete ? `${SHEET_PIECE_TOTAL} / ${SHEET_PIECE_TOTAL} · tap to view` : `${shown.count} / ${SHEET_PIECE_TOTAL}`}
          </p>
        </div>
      </button>
    </div>
  );
}
