'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { playConsoleBlip, playInteractionSfx, playPaperPickup, playPaperReveal, playSheetComplete, startRain, stopRain } from '@/game/audio/sfx';
import { SHEET_PIECE_TOTAL, collectedCount } from '@/data/sheet-music';

/** Plays a synthesized sound cue whenever an interaction fires (guitars strum, notebook scribbles). */
export function SfxPlayer() {
  const cue = useGameStore((state) => state.sfxCue);
  const pieceCue = useGameStore((state) => state.sheetPieceCue);
  const revealCue = useGameStore((state) => state.sheetRevealCue);
  const pieces = useGameStore((state) => state.sheetMusicPieces);
  const weather = useGameStore((state) => state.weather);
  const paused = useGameStore((state) => state.phase !== 'playing');
  const rainMuted = useGameStore((state) => state.rainMuted);
  const gaming = useGameStore((state) => state.activeVideoId === 'switch' || state.friendActivity === 'video-game');
  useEffect(() => {
    if (cue.n > 0) playInteractionSfx(cue.id);
  }, [cue]);
  // A torn sheet-music fragment was just collected: a paper rustle, or the warm resolving chord if that
  // pickup was the one that completed the whole score.
  useEffect(() => {
    if (pieceCue.n <= 0) return;
    if (collectedCount(pieces) >= SHEET_PIECE_TOTAL) playSheetComplete();
    else playPaperPickup();
  }, [pieceCue]); // eslint-disable-line react-hooks/exhaustive-deps -- fire on the cue only, read pieces at that moment
  // A fragment was just revealed (spawned floating above its object).
  useEffect(() => { if (revealCue.n > 0) playPaperReveal(); }, [revealCue]);
  // Gentle rain ambience for as long as the weather holds; hail runs the same loop at a much lower level.
  // Muted by the HUD rain toggle.
  useEffect(() => {
    if (!paused && !rainMuted && (weather === 'rain' || weather === 'hail')) startRain(weather === 'hail');
    else stopRain();
    return stopRain;
  }, [weather, paused, rainMuted]);
  // Retro console chirps while a game is being played — irregularly spaced so they stay playful, not rhythmic.
  useEffect(() => {
    if (paused || !gaming) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => { playConsoleBlip(); schedule(); }, 700 + Math.random() * 1800);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [gaming, paused]);
  return null;
}
