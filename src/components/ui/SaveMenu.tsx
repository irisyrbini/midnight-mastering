'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/game-store';

type SaveSlot = { timestamp: string; time: string; albumProgress: number; crystal: string; snapshot: unknown } | null;
const KEY = 'mmha-save-slots-v1';

function readSlots(): SaveSlot[] {
  try { const saved = window.localStorage.getItem(KEY); return saved ? JSON.parse(saved) : [null, null, null]; } catch { return [null, null, null]; }
}

export function SaveMenu() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SaveSlot[]>([null, null, null]);
  const [overwrite, setOverwrite] = useState<number | null>(null);
  const state = useGameStore();
  const openMenu = () => { setSlots(readSlots()); setOpen(true); setOverwrite(null); };
  const write = (index: number) => {
    const h = Math.floor(state.clock.minuteOfDay / 60) % 24;
    const m = Math.floor(state.clock.minuteOfDay % 60).toString().padStart(2, '0');
    const next = [...slots];
    next[index] = { timestamp: new Date().toLocaleString(), time: `${String(h).padStart(2, '0')}:${m}`, albumProgress: state.albumProgress, crystal: state.crystal, snapshot: JSON.parse(JSON.stringify(state)) };
    window.localStorage.setItem(KEY, JSON.stringify(next)); setSlots(next); setOverwrite(null);
  };
  const load = (slot: SaveSlot) => { if (!slot) return; useGameStore.getState().hydrateSession(slot.snapshot as never); useGameStore.getState().setPhase('playing'); setOpen(false); };
  return <>
    <button onClick={openMenu} className="absolute bottom-5 right-72 z-20 rounded border border-paper/45 bg-night/85 px-3 py-2 text-xs tracking-[0.12em] text-paper hover:bg-paper/10">SAVE</button>
    {open && <section className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-[min(600px,100%)] rounded-2xl border border-paper/50 bg-[#111525] p-6 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="text-xs tracking-[0.18em] text-paper/60">SAVE FILES</p><h2 className="text-2xl font-semibold text-paper">Make Me Happy Again</h2></div><button onClick={() => setOpen(false)} className="text-paper/60 hover:text-paper">Close</button></div>
        <div className="mt-5 grid gap-3">{slots.map((slot, index) => <div key={index} className="rounded-lg border border-paper/25 bg-paper/5 p-4">
          <div className="flex items-center justify-between"><div>{slot ? <><p className="font-semibold text-paper">Slot {index + 1} · {slot.crystal.toUpperCase()} crystal</p><p className="mt-1 text-sm text-paper/65">{slot.timestamp} · {slot.time} · Album {Math.round(slot.albumProgress)}%</p></> : <p className="font-semibold text-paper">Slot {index + 1} · Empty</p>}</div>{slot && <button onClick={() => load(slot)} className="rounded border border-paper/40 px-3 py-1 text-sm text-paper hover:bg-paper/10">Load</button>}</div>
          <div className="mt-3">{slot ? (overwrite === index ? <span className="flex gap-2"><button onClick={() => write(index)} className="rounded bg-ember px-3 py-1 text-sm font-semibold text-night">Confirm overwrite</button><button onClick={() => setOverwrite(null)} className="text-sm text-paper/65">Cancel</button></span> : <button onClick={() => setOverwrite(index)} className="text-sm text-paper/70 hover:text-paper">Overwrite slot</button>) : <button onClick={() => write(index)} className="rounded bg-[#4f8f9c] px-3 py-1 text-sm font-semibold text-night">Create save</button>}</div>
        </div>)}</div>
      </div>
    </section>}
  </>;
}
