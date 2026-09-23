'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { DAW_STEP_COUNT, DAW_STEP_MS, DAW_TRACK_COUNT, GROUP_COLOR, SOUND_BYTES, soundByteById } from '@/data/sound-bytes';
import { setSoundByteLiveVolume, stopAllSoundByteSamples } from '@/game/audio/sound-byte-samples';

const REQUIRED_INSTRUMENTS = ['acousticGuitar', 'electricGuitar', 'portasound', 'sk5', 'modularSynths', 'mic', 'lyricNotebook'];
const DRAG_THRESHOLD = 5; // px of pointer movement before a press becomes a drag rather than a click

/** A short deterministic "waveform" for a clip block — same piece always draws the same squiggle, so the
 *  timeline reads as real audio clips rather than random noise on every render. */
function waveformBars(seed: string, count = 8): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.25 + ((h >>> 8) % 100) / 100 * 0.7; // 0.25–0.95
  });
}

function Waveform({ id, group }: { id: string; group: keyof typeof GROUP_COLOR }) {
  return (
    <span className="pointer-events-none flex h-full w-full items-end justify-center gap-[1.5px] px-1 pb-1">
      {waveformBars(id).map((h, i) => <span key={i} className="w-[2px] rounded-sm" style={{ height: `${h * 70}%`, backgroundColor: GROUP_COLOR[group] }} />)}
    </span>
  );
}

type DragState = {
  pieceId: string;
  from: { track: number; step: number } | null; // null = dragged straight from the palette, never placed yet
  x: number; y: number;      // current pointer position, viewport coords (for the floating ghost)
  overTrack: number | null;  // grid cell currently hovered, if any
  overStep: number | null;
};

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
  const trackMuted = useGameStore((state) => state.trackMuted);
  const trackVolume = useGameStore((state) => state.trackVolume);
  const toggleTrackMute = useGameStore((state) => state.toggleTrackMute);
  const setTrackVolume = useGameStore((state) => state.setTrackVolume);

  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null); // mirrors `drag` for the window listeners' closures
  const cellRefs = useRef<(HTMLDivElement | null)[][]>(Array.from({ length: DAW_TRACK_COUNT }, () => Array(DAW_STEP_COUNT).fill(null)));
  const pressRef = useRef<{ pieceId: string; from: { track: number; step: number } | null; startX: number; startY: number; dragging: boolean } | null>(null);

  // Cell lookup: track -> step -> pieceId, built fresh each render from the flat placedClips map.
  const grid: (string | null)[][] = Array.from({ length: DAW_TRACK_COUNT }, () => Array(DAW_STEP_COUNT).fill(null));
  for (const [pieceId, cell] of Object.entries(placedClips)) {
    if (grid[cell.track]) grid[cell.track][cell.step] = pieceId;
  }

  // Mute/volume take effect immediately, not just on the next time the step loop retriggers that clip.
  // Muting can always just ramp the currently-sounding clip's gain down — it's already audible, so a live
  // gain change is heard right away. Unmuting is not symmetric: the muted track's clip stopped being
  // retriggered the whole time it was muted (see the `trackMuted[track]` skip in playColumn below), so by
  // the time you unmute, its previous source has very likely already finished playing — there's nothing
  // live left to ramp back up, and the byte would otherwise stay silent until the step loop happened to
  // cycle back around to this clip's column (up to a full 32-step bar later), which read as "unmute does
  // nothing until you press Mix / Finish" (Mix/Finish forces an immediate fresh trigger of every column).
  // So a mute→unmute transition while playing instead forces a fresh trigger, same as Mix/Finish does.
  const prevMutedRef = useRef<boolean[]>(trackMuted);
  useEffect(() => {
    const prevMuted = prevMutedRef.current;
    for (const [pieceId, cell] of Object.entries(placedClips)) {
      const muted = trackMuted[cell.track];
      if (!muted && prevMuted[cell.track] && isPlaying) soundByteById[pieceId]?.play(trackVolume[cell.track]);
      else setSoundByteLiveVolume(pieceId, muted ? 0 : trackVolume[cell.track]);
    }
    prevMutedRef.current = trackMuted;
  }, [trackMuted, trackVolume, placedClips, isPlaying]);

  const playColumn = useCallback((col: number) => {
    for (let track = 0; track < DAW_TRACK_COUNT; track += 1) {
      if (trackMuted[track]) continue;
      const pieceId = grid[track][col];
      if (pieceId) soundByteById[pieceId]?.play(trackVolume[track]);
    }
  }, [placedClips, trackMuted, trackVolume]); // eslint-disable-line react-hooks/exhaustive-deps -- `grid` is derived fresh from placedClips each render

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    stopAllSoundByteSamples(); // these are full-length real stems, not short decaying notes — cut them off explicitly
    setIsPlaying(false);
    setStep(0);
  }, []);

  const startPlayback = useCallback(() => {
    setIsPlaying((already) => {
      if (already) return already;
      setStep(0);
      playColumn(0);
      let col = 0;
      timerRef.current = window.setInterval(() => {
        col = (col + 1) % DAW_STEP_COUNT;
        setStep(col);
        playColumn(col);
      }, DAW_STEP_MS);
      return true;
    });
  }, [playColumn]);

  // Stop cleanly if the panel closes (or unmounts) mid-playback — never leave a stray interval or a real
  // audio stem still ringing.
  useEffect(() => () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); stopAllSoundByteSamples(); }, []);
  useEffect(() => { if (!dawOpen) stopPlayback(); }, [dawOpen, stopPlayback]);

  // ── Drag-and-drop. A press becomes a drag once the pointer moves past a small threshold; until then it's
  //    a plain click (used to remove an already-placed clip with a single tap). While dragging, a floating
  //    ghost clip follows the cursor and every grid cell's real DOM rect is hit-tested each move — this
  //    avoids re-deriving the CSS grid's column math and stays correct if the layout ever changes. ──
  const beginPress = (pieceId: string, from: { track: number; step: number } | null, e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    pressRef.current = { pieceId, from, startX: e.clientX, startY: e.clientY, dragging: false };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      const dx = e.clientX - press.startX, dy = e.clientY - press.startY;
      if (!press.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      press.dragging = true;
      // Hit-test every cell's real rect — small grid, negligible cost, and always exactly right.
      let overTrack: number | null = null, overStep: number | null = null;
      for (let t = 0; t < DAW_TRACK_COUNT && overTrack === null; t += 1) {
        for (let s = 0; s < DAW_STEP_COUNT; s += 1) {
          const el = cellRefs.current[t][s];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { overTrack = t; overStep = s; break; }
        }
      }
      const next: DragState = { pieceId: press.pieceId, from: press.from, x: e.clientX, y: e.clientY, overTrack, overStep };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      const press = pressRef.current;
      const current = dragRef.current;
      if (press && !press.dragging) {
        // A plain click (no real drag): clicking an already-placed clip removes it. Clicking a palette
        // entry that hasn't moved does nothing — placement now happens by dragging, not by arming+tapping.
        if (press.from) removeClip(press.pieceId);
      } else if (current) {
        if (current.overTrack !== null && current.overStep !== null) placeClip(current.pieceId, current.overTrack, current.overStep);
        // else: released outside the valid grid area — cancelled, piece stays (or returns to) where it was.
      }
      pressRef.current = null;
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [placeClip, removeClip]);

  if (!dawOpen) return null;

  const inspired = inspirationMinutes > 0;
  const recorded = REQUIRED_INSTRUMENTS.filter((id) => instrumentsUsed[id]).length;
  const allRecorded = recorded === REQUIRED_INSTRUMENTS.length;
  const placedCount = Object.keys(placedClips).length;
  const draggedByte = drag ? soundByteById[drag.pieceId] : null;
  const dropOccupied = drag && drag.overTrack !== null && drag.overStep !== null && grid[drag.overTrack][drag.overStep] !== null && grid[drag.overTrack][drag.overStep] !== drag.pieceId;

  const finishMix = () => { stopPlayback(); startPlayback(); };

  return <section className="absolute inset-x-[8%] bottom-8 top-[14%] z-10 overflow-hidden rounded-2xl border border-paper/50 bg-[#151c2a]/95 shadow-2xl backdrop-blur">
    <header className="flex items-center justify-between border-b border-paper/25 bg-[#24364f] px-5 py-3">
      <div><p className="text-xs tracking-[0.2em] text-paper/65">MIDNIGHT MASTERING</p><h2 className="text-lg font-semibold text-paper">Untitled Session</h2></div>
      <button onClick={() => setDawOpen(false)} className="rounded border border-paper/45 px-3 py-1 text-sm text-paper hover:bg-paper/10">Close</button>
    </header>

    <div className="grid h-[calc(100%-72px)] grid-cols-[180px_1fr]">
      {/* Sound-byte palette. Locked (uncollected) pieces read as dark torn slots, matching the sheet-music
          view's language. A collected, unplaced piece is a real draggable clip — press and drag it onto the
          timeline; it is NOT a button, it never "does" anything on a plain click. A piece already on the
          timeline is dimmed here (it lives on the grid now — drag its block there, or tap it to remove). */}
      <aside className="overflow-y-auto border-r border-paper/20 p-3">
        <p className="mb-2 px-1 text-[10px] tracking-[0.18em] text-paper/50">SOUND BYTES</p>
        <div className="space-y-1.5">
          {SOUND_BYTES.map((byte) => {
            const collected = !!sheetMusicPieces[byte.id];
            const placed = !!placedClips[byte.id];
            const beingDragged = drag?.pieceId === byte.id && !drag.from;
            if (!collected) return <div key={byte.id} className="rounded-md border border-dashed border-paper/15 bg-black/20 px-2.5 py-1.5 text-[11px] text-paper/25">Locked fragment</div>;
            if (placed) return (
              <div key={byte.id} className="flex w-full cursor-default items-center gap-2 rounded-md border border-paper/10 bg-black/10 px-2.5 py-1.5 text-left text-[11px] text-paper/25">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <span className="truncate">{byte.label}</span>
                <span className="ml-auto shrink-0 text-[9px] tracking-wide">on grid</span>
              </div>
            );
            return (
              <div
                key={byte.id}
                onPointerDown={working ? (e) => beginPress(byte.id, null, e) : undefined}
                style={{ touchAction: 'none', opacity: beingDragged ? 0.35 : working ? 1 : 0.5 }}
                title={working ? undefined : 'Press "Work on music" to start arranging'}
                className={`flex w-full select-none items-center gap-2 rounded-md border border-paper/20 bg-paper/5 px-2.5 py-1.5 text-left text-[11px] text-paper/85 transition-colors ${working ? 'cursor-grab hover:bg-paper/10 active:cursor-grabbing' : 'cursor-not-allowed'}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: GROUP_COLOR[byte.group] }} />
                <span className="truncate">{byte.label}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-snug text-paper/35">{working ? 'Drag a sound byte onto the timeline. Drag a placed clip to move it; tap it once to send it back.' : 'Press "Work on music" below to start arranging clips.'}</p>
      </aside>

      {/* Timeline / arrangement view. */}
      <div className="relative flex min-h-0 flex-col p-5">
        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isPlaying ? 'border-[#d84f59] bg-[#d84f59]/20 text-[#f19a9f]' : 'border-[#6d9c7b] bg-[#6d9c7b]/15 text-[#a8d6b6] hover:bg-[#6d9c7b]/25'}`}
            aria-label={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? <span className="h-2.5 w-2.5 bg-current" /> : <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />}
          </button>
          <p className="font-mono text-xs text-paper/55">Bar 1 · step {step + 1}/{DAW_STEP_COUNT}</p>
          <button onClick={finishMix} disabled={placedCount === 0} title="Plays your current arrangement from the top, as the finished mix" className="ml-2 rounded-md border border-[#d8c79c]/50 bg-[#d8c79c]/10 px-3 py-1 text-xs font-medium text-[#e9dcc0] transition-colors hover:bg-[#d8c79c]/20 disabled:cursor-not-allowed disabled:opacity-30">Mix / Finish</button>
          <p className="ml-auto text-xs text-paper/50">{placedCount} clip{placedCount === 1 ? '' : 's'} arranged</p>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-paper/35">Mix / Finish plays your arranged clips from the top, as the finished song.</p>

        {/* Track lanes + step grid. 20 lanes no longer fit one-per-fraction in the available height, so the
            lanes get a fixed row height and the whole block scrolls vertically; the step ruler stays pinned
            above it (not inside the scroll area) so the playhead labels are always visible. */}
        <div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-paper/15 bg-black/20 p-3">
          {/* Step ruler — shares the exact same column template as the track rows below, so the highlighted
              step lines up with the playhead without any pixel-math guesswork. */}
          <div className="mb-2 grid items-stretch gap-1.5" style={{ gridTemplateColumns: `148px repeat(${DAW_STEP_COUNT}, 1fr)` }}>
            <div />
            {Array.from({ length: DAW_STEP_COUNT }, (_, col) => (
              <div key={col} className={`rounded-sm py-0.5 text-center font-mono text-[9px] transition-colors ${isPlaying && step === col ? 'bg-[#d8c79c]/25 text-[#d8c79c]' : 'text-paper/30'}`}>{col + 1}</div>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 content-start overflow-y-auto" style={{ gridTemplateRows: `repeat(${DAW_TRACK_COUNT}, 28px)`, gap: '0.375rem' }}>
            {Array.from({ length: DAW_TRACK_COUNT }, (_, track) => {
              const muted = trackMuted[track];
              const volume = trackVolume[track];
              return (
              <div key={track} className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: `148px repeat(${DAW_STEP_COUNT}, 1fr)` }}>
                {/* Per-track mixer strip: track number, mute toggle, volume slider. Mute/volume apply to
                    whatever clip currently sits in this row — a track is a slot, not a fixed instrument. */}
                <div className="flex items-center gap-1.5 pr-1">
                  <span className="w-4 shrink-0 text-right text-[9px] tracking-wide text-paper/40">{track + 1}</span>
                  <button
                    onClick={() => toggleTrackMute(track)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[8px] font-bold leading-none transition-colors ${
                      muted ? 'border-[#d84f59] bg-[#d84f59]/25 text-[#f19a9f]' : 'border-paper/25 text-paper/40 hover:bg-paper/10'
                    }`}
                    title={muted ? `Track ${track + 1} muted — click to unmute` : `Mute track ${track + 1}`}
                    aria-pressed={muted}
                  >
                    M
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => setTrackVolume(track, Number(e.currentTarget.value) / 100)}
                    className="h-1 w-16 shrink-0 accent-[#d8c79c] disabled:opacity-30"
                    disabled={muted}
                    title={`Track ${track + 1} volume — ${Math.round(volume * 100)}%`}
                  />
                </div>
                {Array.from({ length: DAW_STEP_COUNT }, (_, col) => {
                  const pieceId = grid[track][col];
                  const byte = pieceId ? soundByteById[pieceId] : null;
                  const active = isPlaying && step === col;
                  const isDragSource = drag?.from && drag.from.track === track && drag.from.step === col;
                  const isHovered = drag && drag.overTrack === track && drag.overStep === col;
                  return (
                    <div
                      key={col}
                      ref={(el) => { cellRefs.current[track][col] = el; }}
                      onPointerDown={byte && working ? (e) => beginPress(byte.id, { track, step: col }, e) : undefined}
                      style={{
                        touchAction: 'none',
                        opacity: muted ? 0.35 : 1,
                        ...(byte && !isDragSource ? { backgroundColor: `${GROUP_COLOR[byte.group]}33` } : {}),
                        boxShadow: active && !byte ? undefined : active ? `inset 0 0 0 2px #d8c79c` : isHovered ? `inset 0 0 0 2px ${dropOccupied ? '#d84f59' : '#6d9c7b'}` : undefined,
                      }}
                      className={`relative select-none overflow-hidden rounded border transition-colors ${
                        isDragSource ? 'border-dashed border-paper/20 bg-paper/[0.02] opacity-40'
                        : byte ? `border-transparent ${working ? 'cursor-grab active:cursor-grabbing' : ''}`
                        : drag ? 'border-dashed border-[#d8c79c]/35 bg-paper/[0.03]'
                        : 'border-paper/10 bg-paper/[0.02]'
                      } ${active && !byte && !isHovered ? 'bg-[#d8c79c]/10' : ''} ${isHovered && !byte ? (dropOccupied ? 'bg-[#d84f59]/10' : 'bg-[#6d9c7b]/10') : ''}`}
                      title={byte ? (working ? `${byte.label} — drag to move, tap to remove` : `${byte.label} (press "Work on music" to rearrange)`) : undefined}
                    >
                      {byte && !isDragSource && <Waveform id={byte.id} group={byte.group} />}
                    </div>
                  );
                })}
              </div>
              );
            })}
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

    {/* Floating drag ghost — follows the cursor exactly; pointer-events-none so it never steals the drop hit-test. */}
    {drag && draggedByte && (
      <div
        className="pointer-events-none fixed z-50 flex h-10 w-24 items-end justify-center gap-[1.5px] rounded border-2 px-1 pb-1 shadow-2xl"
        style={{ left: drag.x - 48, top: drag.y - 20, backgroundColor: `${GROUP_COLOR[draggedByte.group]}55`, borderColor: GROUP_COLOR[draggedByte.group] }}
      >
        {waveformBars(draggedByte.id).map((h, i) => <span key={i} className="w-[2px] rounded-sm" style={{ height: `${h * 70}%`, backgroundColor: GROUP_COLOR[draggedByte.group] }} />)}
      </div>
    )}
  </section>;
}
