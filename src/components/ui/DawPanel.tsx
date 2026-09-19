'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { DAW_STEP_COUNT, DAW_STEP_MS, DAW_TRACK_COUNT, GROUP_COLOR, SOUND_BYTES, soundByteById } from '@/data/sound-bytes';

const REQUIRED_INSTRUMENTS = ['acousticGuitar', 'electricGuitar', 'portasound', 'sk5', 'modularSynths', 'mic', 'lyricNotebook'];

/** A short deterministic "waveform" for a clip block — same piece always draws the same squiggle, so the
 *  timeline reads as real audio clips rather than random noise on every render. */
function waveformBars(seed: string, count = 14): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.25 + ((h >>> 8) % 100) / 100 * 0.7; // 0.25–0.95
  });
}

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
  const sheetMusicPieces = useGameStore((state) => state.sheetMusicPieces);
  const placedClips = useGameStore((state) => state.placedClips);
  const placeClip = useGameStore((state) => state.placeClip);
  const removeClip = useGameStore((state) => state.removeClip);

  const [armed, setArmed] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Cell lookup: track -> step -> pieceId, built fresh each render from the flat placedClips map.
  const grid: (string | null)[][] = Array.from({ length: DAW_TRACK_COUNT }, () => Array(DAW_STEP_COUNT).fill(null));
  for (const [pieceId, cell] of Object.entries(placedClips)) {
    if (grid[cell.track]) grid[cell.track][cell.step] = pieceId;
  }

  const playColumn = (col: number) => {
    for (let track = 0; track < DAW_TRACK_COUNT; track += 1) {
      const pieceId = grid[track][col];
      if (pieceId) soundByteById[pieceId]?.play();
    }
  };

  const stopPlayback = () => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setIsPlaying(false);
    setStep(0);
  };

  const startPlayback = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setStep(0);
    playColumn(0);
    let col = 0;
    timerRef.current = window.setInterval(() => {
      col = (col + 1) % DAW_STEP_COUNT;
      setStep(col);
      playColumn(col);
    }, DAW_STEP_MS);
  };

  // Stop cleanly if the panel closes (or unmounts) mid-playback — never leave a stray interval running.
  useEffect(() => () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); }, []);
  useEffect(() => { if (!dawOpen) stopPlayback(); }, [dawOpen]);

  if (!dawOpen) return null;

  const inspired = inspirationMinutes > 0;
  const recorded = REQUIRED_INSTRUMENTS.filter((id) => instrumentsUsed[id]).length;
  const allRecorded = recorded === REQUIRED_INSTRUMENTS.length;
  const placedCount = Object.keys(placedClips).length;

  const clickCell = (track: number, col: number) => {
    const occupant = grid[track][col];
    if (occupant) { removeClip(occupant); if (armed === occupant) setArmed(null); return; }
    if (armed) { placeClip(armed, track, col); setArmed(null); }
  };

  return <section className="absolute inset-x-[8%] bottom-8 top-[14%] z-10 overflow-hidden rounded-2xl border border-paper/50 bg-[#151c2a]/95 shadow-2xl backdrop-blur">
    <header className="flex items-center justify-between border-b border-paper/25 bg-[#24364f] px-5 py-3">
      <div><p className="text-xs tracking-[0.2em] text-paper/65">MIDNIGHT MASTERING</p><h2 className="text-lg font-semibold text-paper">Untitled Session</h2></div>
      <button onClick={() => setDawOpen(false)} className="rounded border border-paper/45 px-3 py-1 text-sm text-paper hover:bg-paper/10">Close</button>
    </header>

    <div className="grid h-[calc(100%-72px)] grid-cols-[180px_1fr]">
      {/* Sound-byte palette: one entry per sheet-music piece. Locked (uncollected) pieces read as dark torn
          slots, matching the sheet-music view's language; collected + unplaced pieces are clickable clips
          waiting to be armed; a collected piece currently on the timeline is dimmed here (it lives on the
          grid now — click its block there to bring it back). */}
      <aside className="overflow-y-auto border-r border-paper/20 p-3">
        <p className="mb-2 px-1 text-[10px] tracking-[0.18em] text-paper/50">SOUND BYTES</p>
        <div className="space-y-1.5">
          {SOUND_BYTES.map((byte) => {
            const collected = !!sheetMusicPieces[byte.id];
            const placed = !!placedClips[byte.id];
            if (!collected) return <div key={byte.id} className="rounded-md border border-dashed border-paper/15 bg-black/20 px-2.5 py-1.5 text-[11px] text-paper/25">Locked fragment</div>;
            return (
              <button
                key={byte.id}
                disabled={placed}
                onClick={() => setArmed((cur) => (cur === byte.id ? null : byte.id))}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                  placed ? 'cursor-default border-paper/10 bg-black/10 text-paper/25'
                  : armed === byte.id ? 'border-[#d8c79c] bg-[#d8c79c]/15 text-paper'
                  : 'border-paper/20 bg-paper/5 text-paper/85 hover:bg-paper/10'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: placed ? 'rgba(255,255,255,0.15)' : GROUP_COLOR[byte.group] }} />
                <span className="truncate">{byte.label}</span>
                {placed && <span className="ml-auto shrink-0 text-[9px] tracking-wide">on grid</span>}
              </button>
            );
          })}
        </div>
        {armed && <p className="mt-3 rounded-md border border-[#d8c79c]/40 bg-[#d8c79c]/10 px-2.5 py-2 text-[10px] leading-snug text-[#e9dcc0]">Tap an empty cell on the timeline to drop it in.</p>}
      </aside>

      {/* Timeline / arrangement view. */}
      <div className="relative flex flex-col p-5">
        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isPlaying ? 'border-[#d84f59] bg-[#d84f59]/20 text-[#f19a9f]' : 'border-[#6d9c7b] bg-[#6d9c7b]/15 text-[#a8d6b6] hover:bg-[#6d9c7b]/25'}`}
            aria-label={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? <span className="h-2.5 w-2.5 bg-current" /> : <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />}
          </button>
          <p className="font-mono text-xs text-paper/55">Bar 1 · step {step + 1}/{DAW_STEP_COUNT}</p>
          <p className="ml-auto text-xs text-paper/50">{placedCount} clip{placedCount === 1 ? '' : 's'} arranged</p>
        </div>

        {/* Track lanes + step grid. */}
        <div className="relative mt-4 flex-1 rounded-lg border border-paper/15 bg-black/20 p-3">
          {/* Step ruler — shares the exact same column template as the track rows below, so the highlighted
              step lines up with the playhead without any pixel-math guesswork. */}
          <div className="mb-2 grid items-stretch gap-1.5" style={{ gridTemplateColumns: `56px repeat(${DAW_STEP_COUNT}, 1fr)` }}>
            <div />
            {Array.from({ length: DAW_STEP_COUNT }, (_, col) => (
              <div key={col} className={`rounded-sm py-0.5 text-center font-mono text-[9px] transition-colors ${isPlaying && step === col ? 'bg-[#d8c79c]/25 text-[#d8c79c]' : 'text-paper/30'}`}>{col + 1}</div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateRows: `repeat(${DAW_TRACK_COUNT}, 1fr)`, gap: '0.5rem', height: 'calc(100% - 1.5rem)' }}>
            {Array.from({ length: DAW_TRACK_COUNT }, (_, track) => (
              <div key={track} className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: `56px repeat(${DAW_STEP_COUNT}, 1fr)` }}>
                <div className="flex items-center text-[10px] tracking-wide text-paper/40">Track {track + 1}</div>
                {Array.from({ length: DAW_STEP_COUNT }, (_, col) => {
                  const pieceId = grid[track][col];
                  const byte = pieceId ? soundByteById[pieceId] : null;
                  const active = isPlaying && step === col;
                  return (
                    <button
                      key={col}
                      onClick={() => clickCell(track, col)}
                      className={`relative overflow-hidden rounded border transition-colors ${
                        byte ? 'border-transparent' : armed ? 'border-dashed border-[#d8c79c]/45 bg-paper/[0.03] hover:bg-[#d8c79c]/10' : 'border-paper/10 bg-paper/[0.02]'
                      } ${active && !byte ? 'border-[#d8c79c]/50 bg-[#d8c79c]/10' : ''}`}
                      style={byte ? { backgroundColor: `${GROUP_COLOR[byte.group]}33`, boxShadow: active ? `inset 0 0 0 2px #d8c79c` : undefined } : undefined}
                      title={byte ? `${byte.label} — click to remove` : armed ? 'Place here' : undefined}
                    >
                      {byte && (
                        <span className="pointer-events-none flex h-full w-full items-end justify-center gap-[1.5px] px-1 pb-1">
                          {waveformBars(byte.id, 8).map((h, i) => (
                            <span key={i} className="w-[2px] rounded-sm" style={{ height: `${h * 70}%`, backgroundColor: GROUP_COLOR[byte.group] }} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Status strip — the real, unchanged progression numbers, now a compact readout instead of the focal point. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-paper/70">
          <span>Music quality <span className="font-mono text-paper">{Math.round(quality)}/100</span></span>
          <span>Album <span className="font-mono text-paper">{Math.round(albumProgress)}%</span></span>
          <span>Crystal <span className="font-semibold capitalize text-paper">{crystal}</span></span>
          <span className={allRecorded ? 'text-[#8bbf9a]' : ''}>Instruments {recorded}/{REQUIRED_INSTRUMENTS.length}{allRecorded ? ' ✓' : ''}</span>
          {inspired && <span className="rounded-full border border-ember/60 bg-ember/15 px-2.5 py-0.5 text-[#ffd1a8]">✦ Inspiration · {Math.ceil(inspirationMinutes)}m</span>}
          {albumCompleted && <span className="text-[#8bbf9a]">Album complete</span>}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setWorkingOnMusic(!working)} className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-night hover:bg-[#f0805e]">{working ? 'Stop working' : 'Work on music'}</button>
          <p className="text-xs text-paper/55">Work improves the album, but drains physical and social wellbeing.</p>
        </div>
      </div>
    </div>
  </section>;
}
