'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { playInteractionSfx, startRain, stopRain } from '@/game/audio/sfx';

/** Plays a synthesized sound cue whenever an interaction fires (guitars strum, notebook scribbles). */
export function SfxPlayer() {
  const cue = useGameStore((state) => state.sfxCue);
  const weather = useGameStore((state) => state.weather);
  const paused = useGameStore((state) => state.phase !== 'playing');
  useEffect(() => {
    if (cue.n > 0) playInteractionSfx(cue.id);
  }, [cue]);
  // Gentle rain ambience for as long as the weather holds; it fades out when it clears or the game pauses.
  useEffect(() => {
    if (!paused && (weather === 'rain' || weather === 'hail')) startRain();
    else stopRain();
    return stopRain;
  }, [weather, paused]);
  return null;
}
