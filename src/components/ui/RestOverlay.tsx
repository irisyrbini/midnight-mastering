'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/game-store';

/**
 * The forced-rest beat — what used to be the "collapse" lose screen. There is no failure here: the
 * producer ran out of the night and fell asleep, a day slipped by, and they wake rested. Everything they
 * made stays. The room is still visible behind a soft wash; the copy is gentle and the only action is to
 * keep going (see docs/Vision.md — "Falling asleep just becomes part of the story").
 */
export function RestOverlay() {
  const sleeping = useGameStore((state) => state.sleeping);
  const resume = useGameStore((state) => state.resume);

  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!sleeping) { setStage(0); return; }
    const timers = [700, 3400, 6600].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [sleeping]);
  if (!sleeping) return null;

  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transform: `translateY(${on ? 0 : 8}px)`, transition: 'opacity 1800ms ease-out, transform 1800ms ease-out' });
  return <section className="absolute inset-0 z-40 grid place-items-center p-6 text-center">
    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 45%, rgba(12,14,26,0.35) 0%, rgba(10,12,22,0.66) 70%, rgba(8,10,18,0.82) 100%)' }} />
    <div className="relative max-w-[42ch]">
      <p className="text-lg leading-relaxed text-paper/90 md:text-xl" style={fade(stage >= 1)}>You fell asleep at the desk.</p>
      <p className="mt-4 text-base leading-relaxed text-paper/70" style={fade(stage >= 2)}>A day slipped by. Nothing you made is gone — the album, the room, all of it is still here.</p>
      <p className="mt-4 text-base leading-relaxed text-paper/70" style={fade(stage >= 2)}>So are you.</p>
      <div className="mt-9" style={fade(stage >= 3)}>
        <button onClick={resume} className="pointer-events-auto rounded-lg border border-paper/45 px-7 py-3 text-sm text-paper transition-colors hover:bg-paper/10">Keep going</button>
      </div>
    </div>
  </section>;
}
