'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The game, as built by Unity for the web (public/unity, from the Unity project's MMHA → Build for the Web).
 * Loads Unity's loader script, starts the player on a full-window canvas, and shows a quiet MMHA loading
 * screen with real progress until the first frame is ready. The older browser build lives at /classic.
 */
type UnityInstance = { Quit: () => Promise<void> };
type CreateUnityInstance = (canvas: HTMLCanvasElement, config: Record<string, unknown>, onProgress?: (p: number) => void) => Promise<UnityInstance>;

const BUILD = '/unity/Build';
const NAME = 'unity';

/** A phone or tablet (a coarse pointer, no hover): the game switches to its touch layout on these. */
function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(hover: hover)').matches;
}

export function UnityGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [touch, setTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // The game is laid out for a landscape screen: on a phone held upright, ask for a turn.
  useEffect(() => {
    const update = () => {
      const isTouch = isTouchDevice();
      setTouch(isTouch);
      setPortrait(isTouch && window.innerHeight > window.innerWidth);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  // Pinches belong to the game (it zooms the room): stop Safari from zooming the page instead, which it does even
  // with user-scalable=no.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const multiTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener('gesturestart', block);
    document.addEventListener('gesturechange', block);
    document.addEventListener('touchmove', multiTouch, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('touchmove', multiTouch);
    };
  }, []);

  // First touch on a phone: go fullscreen and hold landscape where the browser allows it (Android; iOS ignores it).
  const goLandscape = async () => {
    canvas.current?.focus(); // keys (Esc, Enter, WASD) reach the game straight away
    if (!touch) return;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.('landscape');
    } catch { /* not every browser lets a page do this; rotating the phone works everywhere */ }
  };

  useEffect(() => {
    let instance: UnityInstance | null = null;
    let cancelled = false;
    const script = document.createElement('script');
    script.src = `${BUILD}/${NAME}.loader.js`;
    script.onload = () => {
      const create = (window as unknown as { createUnityInstance?: CreateUnityInstance }).createUnityInstance;
      if (!create || !canvas.current) { setFailed('The game could not start.'); return; }
      create(canvas.current, {
        dataUrl: `${BUILD}/${NAME}.data.unityweb`,
        frameworkUrl: `${BUILD}/${NAME}.framework.js.unityweb`,
        codeUrl: `${BUILD}/${NAME}.wasm.unityweb`,
        streamingAssetsUrl: '/unity/StreamingAssets',
        companyName: 'Iris Yebin',
        productName: 'Make Me Happy Again',
        productVersion: '0.1.0',
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        autoSyncPersistentDataPath: true, // saves land in the browser's storage as they're written
      }, (p) => setProgress(p))
        .then((unity) => { instance = unity; if (cancelled) unity.Quit(); else { setReady(true); canvas.current?.focus(); } })
        .catch((error: unknown) => setFailed(String(error)));
    };
    script.onerror = () => setFailed('The game files could not be loaded.');
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      instance?.Quit();
      script.remove();
    };
  }, []);

  return (
    // The canvas stays inside the safe area: clear of the notch / Dynamic Island and the home bar on iPhones
    // (the page is laid out edge to edge, viewport-fit=cover; the edges are just the background).
    <main className="fixed inset-0 overflow-hidden bg-[#05070d]" onPointerDown={goLandscape}
      style={{ touchAction: 'none', overscrollBehavior: 'none',
        padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      <canvas ref={canvas} id="unity-canvas" tabIndex={-1} className="h-full w-full select-none outline-none"
        style={{ display: 'block', touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }} />
      {portrait && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#05070d]/95 p-8 text-center">
          <div className="flex flex-col items-center gap-5">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden className="animate-[turnPhone_2.4s_ease-in-out_infinite_alternate]">
              <rect x="20" y="8" width="24" height="44" rx="4" stroke="#dbc79a" strokeWidth="3" />
              <circle cx="32" cy="45" r="2" fill="#dbc79a" />
            </svg>
            <p className="text-lg text-[#f0e8d9]">Turn your phone sideways</p>
            <p className="max-w-[28ch] text-sm text-[#f0e8d9]/55">The studio is a wide room. It opens up when you hold the phone in landscape.</p>
          </div>
        </div>
      )}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#05070d] text-center">
          <div className="flex flex-col items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/unity/smiley.png" alt="" className="h-20 w-20 opacity-90" />
            <p className="text-5xl font-bold tracking-tight text-[#f0e8d9]">MMHA</p>
            <p className="text-[11px] font-bold tracking-[0.42em] text-[#dbc79a]">MAKE ME HAPPY AGAIN</p>
            {failed ? (
              <p className="max-w-[40ch] text-sm text-[#f0e8d9]/70">{failed}</p>
            ) : (
              <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#dbc79a] transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            <p className="text-[11px] text-[#f0e8d9]/40">{failed ? '' : progress < 0.9 ? 'Unpacking the studio…' : 'Turning the lights on…'}</p>
          </div>
        </div>
      )}
    </main>
  );
}
