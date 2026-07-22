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

  /** Browser save file: keeps the complete simulation snapshot and restores it on the next visit. */
  useEffect(() => {
    const key = 'mmha-save-v1';
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) useGameStore.getState().hydrateSession(JSON.parse(saved) as never);
    } catch { /* An invalid/old local save should never prevent a new game from starting. */ }
    let lastWrite = 0;
    return useGameStore.subscribe((state) => {
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      try { window.localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage may be disabled */ }
    });
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
        // The corridor has one purposeful exit: the studio door.  Making Enter
        // work here keeps re-entry reliable even if the door is off-screen or
        // an overlay intercepts a pointer click.
        if (state.activeLocationId === 'apartment-corridor') { state.returnToStudio(); return; }
        // Enter toggles: if an interaction overlay is open, a second Enter closes it; otherwise interact.
        if (state.activeVideoId) { state.closeVideo(); return; }
        if (state.friendMenuOpen) { state.closeFriendMenu(); return; }
        if (state.dawOpen) { state.setDawOpen(false); return; }
        if (state.selectedObjectId === 'visitor') { state.openFriendMenu(); return; }
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
