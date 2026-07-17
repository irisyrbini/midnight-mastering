'use client';

import { useGameStore } from '@/store/game-store';

const REQUIRED_INSTRUMENTS = ['acousticGuitar', 'electricGuitar', 'portasound', 'sk5', 'modularSynths', 'mic', 'lyricNotebook'];

export function DawPanel() {
  const dawOpen = useGameStore((state) => state.dawOpen);
  const working = useGameStore((state) => state.workingOnMusic);
  const quality = useGameStore((state) => state.musicQuality);
  const inspirationMinutes = useGameStore((state) => state.inspirationMinutes);
  const albumProgress = useGameStore((state) => state.albumProgress);
  const crystal = useGameStore((state) => state.crystal);
  const albumCompleted = useGameStore((state) => state.albumCompleted);
  const instrumentsUsed = useGameStore((state) => state.instrumentsUsed);
  const setDawOpen = useGameStore((state) => state.setDawOpen);
  const setWorkingOnMusic = useGameStore((state) => state.setWorkingOnMusic);
  if (!dawOpen) return null;

  const inspired = inspirationMinutes > 0;
  const recorded = REQUIRED_INSTRUMENTS.filter((id) => instrumentsUsed[id]).length;
  const allRecorded = recorded === REQUIRED_INSTRUMENTS.length;
  return <section className="absolute inset-x-[12%] bottom-8 top-[18%] z-10 overflow-hidden rounded-2xl border border-paper/50 bg-[#151c2a]/95 shadow-2xl backdrop-blur">
    <header className="flex items-center justify-between border-b border-paper/25 bg-[#24364f] px-5 py-3">
      <div><p className="text-xs tracking-[0.2em] text-paper/65">MIDNIGHT MASTERING</p><h2 className="text-lg font-semibold text-paper">Untitled Session</h2></div>
      <button onClick={() => setDawOpen(false)} className="rounded border border-paper/45 px-3 py-1 text-sm text-paper hover:bg-paper/10">Close</button>
    </header>
    <div className="grid h-[calc(100%-72px)] grid-cols-[150px_1fr]">
      <aside className="border-r border-paper/20 p-4 text-xs text-paper/65"><p className="mb-4 tracking-[0.15em]">TRACKS</p><p className="rounded bg-paper/10 px-3 py-2 text-paper">01 · Sketch</p><p className="mt-2 px-3 py-2">02 · Empty</p><p className="mt-2 px-3 py-2">03 · Empty</p></aside>
      <div className="relative p-6">
        <div className="absolute inset-x-6 top-8 h-36 rounded border border-[#4f8f9c]/55 bg-[#1d3146] opacity-80"><div className="ml-[16%] mt-10 h-8 w-[45%] rounded bg-[#b73545]/70" /><div className="ml-[35%] mt-3 h-6 w-[34%] rounded bg-[#4f8f9c]/70" /></div>
        <div className="absolute inset-x-6 top-48 flex items-center justify-between"><div><p className="text-xs tracking-[0.18em] text-paper/65">MUSIC QUALITY</p><p className="mt-1 font-mono text-3xl text-paper">{Math.round(quality)}<span className="text-base text-paper/55"> / 100</span></p></div>{inspired && <div className="rounded-full border border-ember/70 bg-ember/15 px-4 py-2 text-sm font-medium text-[#ffd1a8]">✦ Inspiration active · {Math.ceil(inspirationMinutes)}m</div>}</div>
        <div className="absolute inset-x-6 bottom-[104px] flex items-center justify-between text-sm"><span className="text-paper/65">Instruments recorded</span><span className={`font-mono ${allRecorded ? 'text-[#6d9c7b]' : 'text-paper/80'}`}>{recorded} / {REQUIRED_INSTRUMENTS.length}{allRecorded ? ' ✓' : ''}</span></div>
        <div className="absolute inset-x-6 bottom-20 rounded border border-paper/20 bg-black/15 p-3 text-sm text-paper/75">Album progress: <span className="font-mono text-paper">{Math.round(albumProgress)}%</span> · Crystal: <span className="font-semibold capitalize">{crystal}</span>{albumCompleted ? ' · Album complete' : allRecorded ? ' · Needs 100% + green crystal' : ' · Record every instrument first'}</div>
        <div className="absolute inset-x-6 bottom-6 flex items-center gap-3"><button onClick={() => setWorkingOnMusic(!working)} className="rounded-lg bg-ember px-5 py-3 font-semibold text-night hover:bg-[#f0805e]">{working ? 'Stop working' : 'Work on music'}</button><p className="text-sm text-paper/65">Work improves the album, but drains physical and social wellbeing.</p></div>
      </div>
    </div>
  </section>;
}
