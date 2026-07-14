'use client';

import { interactionById } from '@/data/interactions';
import { INTERACTION_MEDIA } from '@/data/interaction-media';
import { useGameStore } from '@/store/game-store';

/** Item-inspection overlay. Shows the item's authored image/video if one is registered, else a procedural visual. */
export function InteractionVideo() {
  const activeVideoId = useGameStore((state) => state.activeVideoId);
  const closeVideo = useGameStore((state) => state.closeVideo);
  if (!activeVideoId) return null;
  const interaction = interactionById[activeVideoId];
  const media = INTERACTION_MEDIA[activeVideoId];
  return <section className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
    <div className="w-[min(760px,100%)] overflow-hidden rounded-2xl border border-paper/50 bg-[#0b1220] shadow-2xl">
      <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#31597a,transparent_35%),linear-gradient(135deg,#121d30,#080b12)]">
        {media?.type === 'image' && <img src={media.src} alt={interaction?.label} className="h-full w-full object-cover" />}
        {media?.type === 'video' && <video src={media.src} className="h-full w-full object-cover" autoPlay loop muted playsInline controls />}
        {!media && <>
          <div className="absolute inset-x-0 bottom-[38%] h-px bg-paper/30" />
          <div className="absolute inset-x-[12%] bottom-[28%] flex items-end gap-1 opacity-80">{Array.from({ length: 38 }, (_, index) => <span key={index} className="animate-pulse bg-ember/80" style={{ height: `${18 + ((index * 17) % 68)}px`, width: '5px', animationDelay: `${index * 55}ms` }} />)}</div>
        </>}
        <p className="absolute left-6 top-6 text-xs tracking-[0.24em] text-paper/65">{media ? 'INSPECT' : 'SESSION PLAYBACK · LIVE VISUAL'}</p>
        <p className="absolute bottom-6 left-6 text-2xl font-semibold text-paper drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">{interaction?.label}</p>
      </div>
      <div className="flex items-center justify-between px-5 py-4"><p className="text-sm text-paper/70">{media?.caption ?? interaction?.description}</p><button onClick={closeVideo} className="rounded border border-paper/45 px-3 py-1.5 text-sm text-paper hover:bg-paper/10">Close</button></div>
    </div>
  </section>;
}
