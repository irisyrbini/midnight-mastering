'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { interactionLine } from '@/data/interaction-lines';

/**
 * The message card: the object's name over its little sentence, centred at the bottom. It rises in, holds
 * long enough to read (longer lines stay longer), then fades — the room is the subject, not the card.
 * The sheet-music toast takes the moment when a fragment is picked up.
 */
export function InteractionCard() {
  const cue = useGameStore((s) => s.sfxCue);
  const pieceCue = useGameStore((s) => s.sheetPieceCue);
  const [card, setCard] = useState<{ title: string; text: string; key: number; leaving: boolean } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (cue.n <= 0) return;
    const state = useGameStore.getState();
    const interaction = state.lastInteraction;
    if (!interaction || interaction.id !== cue.id) return;
    const text = interactionLine(interaction, state);
    const hold = 3600 + text.length * 45;
    timers.current.forEach(window.clearTimeout);
    setCard({ title: interaction.label, text, key: cue.n, leaving: false });
    timers.current = [
      window.setTimeout(() => setCard((c) => (c ? { ...c, leaving: true } : c)), hold),
      window.setTimeout(() => setCard(null), hold + 700),
    ];
  }, [cue]);

  useEffect(() => {
    if (pieceCue.n > 0) setCard(null);
  }, [pieceCue]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  if (!card) return null;
  return (
    <aside
      key={card.key}
      className={`pointer-events-none absolute bottom-[4.5rem] left-1/2 z-20 w-[min(460px,calc(100%-2.5rem))] -translate-x-1/2 transition-opacity duration-700 ${card.leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="relative rounded-xl border border-paper/25 bg-night/90 px-5 pb-3.5 pt-3 text-center shadow-2xl backdrop-blur-sm animate-[fadeInUp_0.35s_ease]">
        <span aria-hidden className="absolute left-1/2 top-0 h-0.5 w-9 -translate-x-1/2 rounded-full bg-[#d8c79c]/90" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#d8c79c]">{card.title.toUpperCase()}</p>
        <p className="mt-1 text-sm leading-snug text-paper">{card.text}</p>
      </div>
    </aside>
  );
}
