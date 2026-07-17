'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { playInteractionSfx } from '@/game/audio/sfx';

/** Plays a synthesized sound cue whenever an interaction fires (guitars strum, notebook scribbles). */
export function SfxPlayer() {
  const cue = useGameStore((state) => state.sfxCue);
  useEffect(() => {
    if (cue.n > 0) playInteractionSfx(cue.id);
  }, [cue]);
  return null;
}
