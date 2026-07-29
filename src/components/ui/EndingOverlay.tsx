'use client';

import { useGameStore } from '@/store/game-store';

/** Terminal-outcome screen. Framed per docs/Story.md §6 — release, not triumph; an invitation, not a sting. */
const COPY = {
  finished: {
    tag: 'CHAPTER 1 COMPLETE',
    title: 'Make Me Happy Again',
    body: 'The album is complete, and the crystal above your head finally glows bright green. For once, the room feels warm enough to stay in.',
    accent: '#ff87b8',
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
  const continueAfterChapter = useGameStore((state) => state.continueAfterChapter);
  if (phase !== 'ending' || !ending) return null;

  const copy = COPY[ending];
  const finished = ending === 'finished';
  return <section className={`absolute inset-0 z-40 grid place-items-center p-6 backdrop-blur transition-colors duration-[4000ms] ${finished ? 'bg-[#5b214c]/72' : 'bg-night/85'}`}>
    {finished && <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-90">{Array.from({ length: 42 }).map((_, i) => <span key={i} className="absolute h-2 w-1.5 animate-bounce rounded-sm" style={{ left: `${(i * 37) % 100}%`, top: `${8 + ((i * 19) % 78)}%`, backgroundColor: ['#ff87b8', '#ffd34d', '#62cf86', '#8dc7e5'][i % 4], transform: `rotate(${(i * 29) % 180}deg)`, animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${1.1 + (i % 5) * 0.22}s` }} />)}</div>}
    <div className={`relative w-[min(460px,100%)] rounded-2xl border p-8 text-center shadow-2xl ${finished ? 'border-[#ffb7d4]/70 bg-[#321b38]/90' : 'border-paper/45 bg-[#111525]/95'}`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: copy.accent }} />
      <p className="mt-3 text-xs tracking-[0.24em] text-paper/55">{copy.tag}</p>
      <h2 className="mt-2 text-3xl font-semibold text-paper">{copy.title}</h2>
      <p className="mx-auto mt-4 max-w-[38ch] text-sm leading-relaxed text-paper/70">{copy.body}</p>
      <p className="mt-5 font-mono text-xs text-paper/50">DAY {day} · ALBUM {Math.round(albumProgress)}%</p>
      {finished ? <>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[#ffb7d4]">New Chapter Unlocked</p>
        <p className="mt-2 text-sm text-paper/65">The apartment entrance is open. The greenhouse beyond it is coming soon.</p>
        <button onClick={continueAfterChapter} className="mt-6 rounded-lg bg-[#ff87b8] px-6 py-3 font-semibold text-[#321b38] hover:bg-[#ffb7d4]">Continue Your Journey</button>
      </> : <button onClick={restart} className="mt-6 rounded-lg bg-ember px-6 py-3 font-semibold text-night hover:bg-[#f0805e]">Begin again</button>}
    </div>
  </section>;
}
