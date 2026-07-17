'use client';

import { useGameStore } from '@/store/game-store';

/** A small choice prompt (e.g. "Drink a beer?" from the fridge, "Call a friend / Doom-scroll" from the bed phone). */
export function PromptOverlay() {
  const prompt = useGameStore((state) => state.prompt);
  const choose = useGameStore((state) => state.choose);
  if (!prompt) return null;
  return <section className="absolute inset-0 z-30 grid place-items-center bg-night/70 p-6 backdrop-blur-sm">
    <div className="w-[min(360px,calc(100%-2.5rem))] rounded-2xl border border-paper/45 bg-[#111525]/92 p-6 text-center shadow-2xl">
      <p className="text-lg font-semibold text-paper">{prompt.title}</p>
      {prompt.note && <p className="mt-1 text-sm text-paper/60">{prompt.note}</p>}
      <div className="mt-5 flex flex-col gap-2">
        {prompt.choices.map((choice) => (
          <button key={choice.kind} onClick={() => choose(choice.kind)} className="rounded-lg border border-paper/40 bg-paper/5 px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ember hover:text-night">{choice.label}</button>
        ))}
      </div>
    </div>
  </section>;
}
