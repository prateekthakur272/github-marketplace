'use client';

// A tiny client-side router that gives clean URLs (/app/OpenRest?tab=versions)
// on a static host, like the Flutter app's go_router. Unknown paths are served
// the app shell via 404.html (GitHub Pages), and this router renders them.
import { useCallback, useEffect, useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

const snapshot = () => window.location.pathname + window.location.search;
const serverSnapshot = () => '/';

/** Path + query without the deployment base path, e.g. `/app/x?tab=versions`. */
function useLocationKey(): string {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return BASE && raw.startsWith(BASE) ? raw.slice(BASE.length) || '/' : raw;
}

export function usePathname(): string {
  const key = useLocationKey();
  const p = key.split('?')[0].replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function useSearchParams(): URLSearchParams {
  const key = useLocationKey();
  return useMemo(() => new URLSearchParams(key.split('?')[1] ?? ''), [key]);
}

export function navigate(to: string, replace = false) {
  const url = BASE + to;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  notify();
}

export function useRouter() {
  const push = useCallback((to: string) => navigate(to), []);
  const replace = useCallback((to: string) => navigate(to, true), []);
  return useMemo(() => ({ push, replace }), [push, replace]);
}

/** Absolute href (with base path) for a router location. */
export const hrefFor = (to: string) => BASE + to;

/** Plain `<a>` that navigates without a page reload. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={hrefFor(href)} onClick={handle} {...rest} />;
}

/** Scroll to the top whenever the location changes. */
export function useScrollTopOnNavigate() {
  const key = useLocationKey();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
