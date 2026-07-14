'use client';

import { useGameStore } from '@/store/game-store';

/** Freezes the run without ending it. Simulation halts because tick early-returns unless phase is 'playing'. */
export function PauseOverlay() {
  const phase = useGameStore((state) => state.phase);
  const resume = useGameStore((state) => state.resume);
  const restart = useGameStore((state) => state.restart);
  if (phase !== 'paused') return null;

  return <section className="absolute inset-0 z-30 grid place-items-center bg-night/75 backdrop-blur-sm">
    <div className="w-[min(360px,calc(100%-2.5rem))] rounded-2xl border border-paper/45 bg-[#111525]/90 p-7 text-center shadow-2xl">
      <p className="text-xs tracking-[0.22em] text-paper/55">PAUSED</p>
      <h2 className="mt-2 text-2xl font-semibold text-paper">The night waits</h2>
      <p className="mt-2 text-sm text-paper/65">Time is still. Take a breath.</p>
      <div className="mt-6 flex flex-col gap-2">
        <button onClick={resume} className="rounded-lg bg-ember px-5 py-3 font-semibold text-night hover:bg-[#f0805e]">Resume</button>
        <button onClick={restart} className="rounded-lg border border-paper/40 px-5 py-2.5 text-sm text-paper hover:bg-paper/10">Start over</button>
      </div>
      <p className="mt-5 text-[11px] tracking-[0.12em] text-paper/45">ESC TO RESUME</p>
    </div>
  </section>;
}
