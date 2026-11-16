'use client';

import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

function Shot({ url, onOpen }: { url: string; onOpen: () => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  return (
    <button className="shot" onClick={onOpen} aria-label="Open screenshot" style={state !== 'ok' ? { width: 160 } : undefined}>
      {state === 'failed' ? (
        <ImageOff size={24} color="var(--muted)" />
      ) : (
        <>
          {state === 'loading' && <div className="spinner sm" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="App screenshot"
            height={280}
            style={state === 'loading' ? { position: 'absolute', opacity: 0 } : undefined}
            onLoad={() => setState('ok')}
            onError={() => setState('failed')}
          />
        </>
      )}
    </button>
  );
}

/** Horizontal strip of screenshots (max 5); click opens a full-size viewer. */
export function ScreenshotGallery({ urls }: { urls: string[] }) {
  const shown = urls.slice(0, 5);
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : Math.min(shown.length - 1, Math.max(0, i + d)))),
    [shown.length],
  );
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, move]);

  if (shown.length === 0) return null;
  return (
    <>
      <div className="shots" style={{ height: 280 }}>
        {shown.map((u, i) => (
          <Shot key={u} url={u} onOpen={() => setOpen(i)} />
        ))}
      </div>
      {open !== null && (
        <div className="scrim dialog-scrim" onClick={() => setOpen(null)}>
          <div className="viewer" role="dialog" aria-label="Screenshot viewer" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown[open]} alt="App screenshot" />
            <button className="v-btn" style={{ top: 8, right: 8 }} onClick={() => setOpen(null)} aria-label="Close"><X size={24} /></button>
            {open > 0 && <button className="v-btn" style={{ left: 8, top: '50%', marginTop: -24 }} onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={32} /></button>}
            {open < shown.length - 1 && <button className="v-btn" style={{ right: 8, top: '50%', marginTop: -24 }} onClick={() => move(1)} aria-label="Next"><ChevronRight size={32} /></button>}
            <span className="v-count">{open + 1} / {shown.length}</span>
          </div>
        </div>
      )}
    </>
  );
}
