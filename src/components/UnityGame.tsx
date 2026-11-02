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

export function UnityGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

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
        .then((unity) => { instance = unity; if (cancelled) unity.Quit(); else setReady(true); })
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
    <main className="fixed inset-0 bg-[#05070d]">
      <canvas ref={canvas} id="unity-canvas" tabIndex={-1} className="h-full w-full outline-none" style={{ display: 'block' }} />
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
