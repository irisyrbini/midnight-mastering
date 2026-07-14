'use client';

import { useEffect, useRef } from 'react';
import { createPixiStage } from '@/game/rendering/createPixiStage';

export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    let stageInstance: Awaited<ReturnType<typeof createPixiStage>> | undefined;
    const resizeObserver = new ResizeObserver(() => stageInstance?.scene.resize(host.clientWidth, host.clientHeight));
    resizeObserver.observe(host);
    createPixiStage(host).then((result) => {
      if (destroyed) result.app.destroy(true);
      else {
        result.scene.resize(host.clientWidth, host.clientHeight);
        stageInstance = result;
      }
    });
    return () => { destroyed = true; resizeObserver.disconnect(); stageInstance?.scene.destroy(); stageInstance?.app.destroy(true); };
  }, []);

  return <div ref={hostRef} aria-label="Game scene" className="absolute inset-0" />;
}
