'use client';

import { useGameStore } from '@/store/game-store';

export function FriendMenu() {
  const open = useGameStore((state) => state.friendMenuOpen);
  const doActivity = useGameStore((state) => state.doFriendActivity);
  const close = useGameStore((state) => state.closeFriendMenu);
  if (!open) return null;
  return <section className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
    <div className="w-[min(440px,100%)] rounded-2xl border border-paper/50 bg-[#131c2b] p-6 shadow-2xl">
      <p className="text-xs tracking-[0.18em] text-paper/60">FRIEND VISIT</p>
      <h2 className="mt-1 text-2xl font-semibold text-paper">What should you do together?</h2>
      <div className="mt-5 grid gap-3">
        <button onClick={() => doActivity('tune')} className="rounded-lg border border-[#4f8f9c]/60 bg-[#4f8f9c]/10 px-4 py-3 text-left text-paper hover:bg-[#4f8f9c]/20"><strong>Make a tune together</strong><span className="block text-sm text-paper/65">Boosts creativity and doubles album progress briefly.</span></button>
        <button onClick={() => doActivity('vodka')} className="rounded-lg border border-[#b87882]/60 bg-[#b87882]/10 px-4 py-3 text-left text-paper hover:bg-[#b87882]/20"><strong>Drink vodka together</strong><span className="block text-sm text-paper/65">Raises connection, but feeds addiction.</span></button>
        <button onClick={() => doActivity('video-game')} className="rounded-lg border border-[#6d9c7b]/60 bg-[#6d9c7b]/10 px-4 py-3 text-left text-paper hover:bg-[#6d9c7b]/20"><strong>Play a video game</strong><span className="block text-sm text-paper/65">Raises Love and Social while easing burnout.</span></button>
      </div>
      <button onClick={close} className="mt-5 text-sm text-paper/60 hover:text-paper">Not now</button>
    </div>
  </section>;
}
