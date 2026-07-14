'use client';

import { useEffect } from 'react';
import { GameEngine } from '@/game/core/GameEngine';
import { ThreeStudio } from './ThreeStudio';
import { GameHud } from '@/components/ui/GameHud';
import { useGameStore } from '@/store/game-store';

export function GameShell() {
  useEffect(() => {
    const engine = new GameEngine();
    engine.start();
    return () => engine.stop();
  }, []);

  useEffect(() => {
    const pressed = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        const { phase, pause, resume } = useGameStore.getState();
        if (phase === 'playing') pause();
        else if (phase === 'paused') resume();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const state = useGameStore.getState();
        // Enter toggles: if an interaction overlay is open, a second Enter closes it; otherwise interact.
        if (state.activeVideoId) { state.closeVideo(); return; }
        if (state.dawOpen) { state.setDawOpen(false); return; }
        if (state.selectedObjectId) state.interact(state.selectedObjectId);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'shift') { pressed.add('shift'); return; }
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) return;
      event.preventDefault();
      pressed.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.key.toLowerCase());
    let frame = 0;
    const move = () => {
      const running = pressed.has('shift');
      const boost = running ? 1.85 : 1; // Shift to run
      const dx = ((pressed.has('arrowright') || pressed.has('d') ? 2.4 : 0) - (pressed.has('arrowleft') || pressed.has('a') ? 2.4 : 0)) * boost;
      const dy = ((pressed.has('arrowdown') || pressed.has('s') ? 1.6 : 0) - (pressed.has('arrowup') || pressed.has('w') ? 1.6 : 0)) * boost;
      const store = useGameStore.getState();
      store.setRunning(running);
      if (dx || dy) store.movePlayer({ x: dx, y: dy });
      frame = requestAnimationFrame(move);
    };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); frame = requestAnimationFrame(move);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); cancelAnimationFrame(frame); };
  }, []);

  return <section className="relative min-h-dvh overflow-hidden"><ThreeStudio /><GameHud /><p className="pointer-events-none absolute bottom-5 left-5 text-xs tracking-[0.12em] text-paper/55">CLICK TO MOVE · SHIFT TO RUN · DRAG TO ROTATE · WASD / ARROWS · CLICK OR ENTER TO INTERACT</p></section>;
}
