'use client';

import { useGameStore } from '@/store/game-store';
import { emotionalScore } from '@/game/simulation/emotionalGraph';
import type { NeedKey } from '@/types/game';
import { DawPanel } from './DawPanel';
import { InteractionVideo } from './InteractionVideo';
import { PauseOverlay } from './PauseOverlay';
import { EndingOverlay } from './EndingOverlay';

const NEEDS: { key: NeedKey; label: string; color: string }[] = [
  { key: 'hunger', label: 'Hunger', color: '#d6a447' },
  { key: 'energy', label: 'Energy', color: '#4f8f9c' },
  { key: 'hygiene', label: 'Hygiene', color: '#6d9c7b' },
  { key: 'social', label: 'Social', color: '#b87882' },
  { key: 'creativity', label: 'Creativity', color: '#d85d58' },
  { key: 'love', label: 'Love', color: '#c6798d' },
];

function formatTime(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60) % 24;
  const minutes = Math.floor(minuteOfDay % 60).toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${((hours + 11) % 12) + 1}:${minutes} ${period}`;
}

/** React overlay for readable controls, menus, and status—not world rendering. */
export function GameHud() {
  const needs = useGameStore((state) => state.needs);
  const stress = useGameStore((state) => state.stress);
  const clock = useGameStore((state) => state.clock);
  const lastInteraction = useGameStore((state) => state.lastInteraction);
  const crystal = useGameStore((state) => state.crystal);
  const emotionalGraph = useGameStore((state) => state.emotionalGraph);
  const albumProgress = useGameStore((state) => state.albumProgress);
  const albumCompleted = useGameStore((state) => state.albumCompleted);
  const emotion = emotionalScore(emotionalGraph);
  const crystalHex = crystal === 'red' ? '#d84f59' : crystal === 'yellow' ? '#e6c34c' : '#62cf86';
  return <>
    <header className="pointer-events-none absolute inset-x-0 top-5 z-10 text-center">
      <h1 className="text-xl font-semibold tracking-[0.14em] text-paper">MAKE ME HAPPY AGAIN</h1>
      <p className="mt-1 text-xs tracking-[0.12em] text-paper/60">RESTORE THE CRYSTAL · FINISH THE ALBUM</p>
    </header>
    <aside className="pointer-events-none absolute left-4 top-4 w-48 rounded-lg border border-paper/40 bg-night/80 p-3 shadow-2xl backdrop-blur-sm">
      <p className="mb-2 text-[10px] tracking-[0.16em] text-paper/60">STATUS</p>
      <div className="space-y-2">{NEEDS.map(({ key, label, color }) => <div key={key}>
        <div className="mb-0.5 flex justify-between text-xs text-paper"><span>{label}</span><span className="font-mono text-paper/65">{Math.round(needs[key])}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full border border-paper/35 bg-black/25"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${needs[key]}%`, backgroundColor: color }} /></div>
      </div>)}</div>
      <div className="mt-3 border-t border-paper/20 pt-2">
        <div className="mb-0.5 flex justify-between text-xs"><span className="text-paper">Stress</span><span className="font-mono text-paper/65">{Math.round(stress)}</span></div>
        <div className="h-2 overflow-hidden rounded-full border border-paper/35 bg-black/25"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${stress}%`, backgroundColor: stress > 66 ? '#d84f59' : stress > 33 ? '#d6a447' : '#6d9c7b' }} /></div>
      </div>
    </aside>
    <aside className="pointer-events-none absolute right-5 top-5 rounded-xl border border-paper/45 bg-night/85 px-5 py-4 text-right shadow-2xl backdrop-blur-sm">
      <p className="text-xs tracking-[0.18em] text-paper/60">DAY {clock.day}</p><p className="mt-1 font-mono text-xl text-paper">{formatTime(clock.minuteOfDay)}</p>
    </aside>
    <aside className="pointer-events-none absolute bottom-5 right-5 w-60 rounded-xl border border-paper/45 bg-night/85 p-4 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between"><p className="text-xs tracking-[0.14em] text-paper/60">EMOTIONAL CRYSTAL</p><span className="h-3 w-3 rounded-full" style={{ backgroundColor: crystalHex }} /></div>
      <div className="mt-1 flex items-baseline justify-between"><p className="text-sm font-semibold capitalize text-paper">{crystal} state</p><p className="font-mono text-sm text-paper/75">{emotion}%</p></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-paper/35 bg-black/25"><div className="h-full transition-[width] duration-500" style={{ width: `${emotion}%`, backgroundColor: crystalHex }} /></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full border border-paper/35 bg-black/25"><div className="h-full bg-ember transition-[width] duration-300" style={{ width: `${albumProgress}%` }} /></div>
      <p className="mt-1 text-xs text-paper/65">Album {Math.round(albumProgress)}%{albumCompleted ? ' · Complete' : ' · Requires green crystal'}</p>
    </aside>
    {lastInteraction && <aside className="pointer-events-none absolute bottom-5 left-1/2 w-[min(440px,calc(100%-2.5rem))] -translate-x-1/2 rounded-xl border border-paper/45 bg-night/90 px-5 py-4 text-center shadow-2xl">
      <p className="text-sm text-paper"><span className="font-semibold">{lastInteraction.label}</span> · {lastInteraction.description}</p>
    </aside>}
    <DawPanel />
    <InteractionVideo />
    <PauseOverlay />
    <EndingOverlay />
  </>;
}
