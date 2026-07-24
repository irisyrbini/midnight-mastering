'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { playConsoleBlip, playInteractionSfx, startRain, stopRain } from '@/game/audio/sfx';

/** Plays a synthesized sound cue whenever an interaction fires (guitars strum, notebook scribbles). */
export function SfxPlayer() {
  const cue = useGameStore((state) => state.sfxCue);
  const weather = useGameStore((state) => state.weather);
  const paused = useGameStore((state) => state.phase !== 'playing');
  const gaming = useGameStore((state) => state.activeVideoId === 'switch' || state.friendActivity === 'video-game');
  useEffect(() => {
    if (cue.n > 0) playInteractionSfx(cue.id);
  }, [cue]);
  // Gentle rain ambience for as long as the weather holds; hail runs the same loop at a much lower level.
  useEffect(() => {
    if (!paused && (weather === 'rain' || weather === 'hail')) startRain(weather === 'hail');
    else stopRain();
    return stopRain;
  }, [weather, paused]);
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
