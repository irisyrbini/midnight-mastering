'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/game-store';

/**
 * Chapter completion. Not a victory screen — a quiet recognition. The room is held in morning light and
 * stays visible behind a soft warm wash (nothing resets; everything the player made is still there). The
 * lines fade in slowly, then the title returns with its meaning turned from plea to realization. No
 * confetti, no score, no fanfare (see docs/Vision.md §"End of a chapter" / Story.md §7).
 */
export function EndingOverlay() {
  const phase = useGameStore((state) => state.phase);
  const ending = useGameStore((state) => state.ending);
  const continueAfterChapter = useGameStore((state) => state.continueAfterChapter);
  const restart = useGameStore((state) => state.restart);
  const shown = phase === 'ending' && !!ending;

  // Stage the reveal: line 1 → line 2 → title → the quiet affordance. Reset when the overlay opens.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!shown) { setStage(0); return; }
    const timers = [900, 4200, 7800, 10800].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [shown]);
  if (!shown) return null;

  const fade = (on: boolean, y = 8) => ({ opacity: on ? 1 : 0, transform: `translateY(${on ? 0 : y}px)`, transition: 'opacity 2200ms ease-out, transform 2200ms ease-out' });
  return <section className="absolute inset-0 z-40 grid place-items-center p-6 text-center">
    {/* A soft, warm morning wash — deliberately translucent so the finished room shows through. */}
    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, rgba(20,14,26,0.15) 0%, rgba(24,16,20,0.5) 55%, rgba(14,10,16,0.72) 100%)' }} />
    <div className="pointer-events-none absolute inset-0" style={{ ...fade(stage >= 1, 0), background: 'linear-gradient(180deg, rgba(255,214,150,0.05) 0%, rgba(255,183,120,0.03) 45%, transparent 70%)' }} />
    <div className="relative max-w-[46ch]">
      <p className="text-lg leading-relaxed text-paper/90 md:text-xl" style={fade(stage >= 1)}>You didn&rsquo;t just finish a chapter.</p>
      <p className="mt-4 text-lg leading-relaxed text-paper/90 md:text-xl" style={fade(stage >= 2)}>You found a part of yourself waiting for you.</p>
      <h2 className="mt-10 text-2xl font-semibold tracking-[0.16em] text-paper md:text-3xl" style={fade(stage >= 3, 4)}>MAKE ME HAPPY AGAIN</h2>
      <div className="mt-10 flex flex-col items-center gap-3" style={fade(stage >= 4, 0)}>
        <p className="text-sm text-paper/55">There&rsquo;s another room, when you want it.</p>
        <button onClick={continueAfterChapter} className="pointer-events-auto rounded-lg border border-paper/45 px-6 py-2.5 text-sm text-paper transition-colors hover:bg-paper/10">Step outside</button>
        <button onClick={restart} className="pointer-events-auto text-[11px] tracking-[0.12em] text-paper/40 hover:text-paper/70">start a new chapter</button>
      </div>
    </div>
  </section>;
}
