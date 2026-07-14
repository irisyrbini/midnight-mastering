'use client';

import { useGameStore } from '@/store/game-store';

/** Terminal-outcome screen. Framed per docs/Story.md §6 — release, not triumph; an invitation, not a sting. */
const COPY = {
  finished: {
    tag: 'FINISHED',
    title: 'The record is done',
    body: 'You mastered the last track a little after midnight — and this time you were well enough to hear that it is good. You save the session, turn off the monitors, and let the room go quiet.',
    accent: '#62cf86',
  },
  collapse: {
    tag: 'COLLAPSE',
    title: 'The night ran out',
    body: 'You have nothing left to give it tonight. The album is still unfinished, but so are you — and that is allowed. You close the laptop and let the dark be dark.',
    accent: '#b87882',
  },
} as const;

export function EndingOverlay() {
  const phase = useGameStore((state) => state.phase);
  const ending = useGameStore((state) => state.ending);
  const albumProgress = useGameStore((state) => state.albumProgress);
  const day = useGameStore((state) => state.clock.day);
  const restart = useGameStore((state) => state.restart);
  if (phase !== 'ending' || !ending) return null;

  const copy = COPY[ending];
  return <section className="absolute inset-0 z-40 grid place-items-center bg-night/85 p-6 backdrop-blur">
    <div className="w-[min(460px,100%)] rounded-2xl border border-paper/45 bg-[#111525]/95 p-8 text-center shadow-2xl">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: copy.accent }} />
      <p className="mt-3 text-xs tracking-[0.24em] text-paper/55">{copy.tag}</p>
      <h2 className="mt-2 text-3xl font-semibold text-paper">{copy.title}</h2>
      <p className="mx-auto mt-4 max-w-[38ch] text-sm leading-relaxed text-paper/70">{copy.body}</p>
      <p className="mt-5 font-mono text-xs text-paper/50">DAY {day} · ALBUM {Math.round(albumProgress)}%</p>
      <button onClick={restart} className="mt-6 rounded-lg bg-ember px-6 py-3 font-semibold text-night hover:bg-[#f0805e]">Begin again</button>
    </div>
  </section>;
}
