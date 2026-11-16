import { PLATFORMS, PLATFORM_LABEL, type Platform } from './types';

/** Builds `/?a=1&b=2`, dropping empty values. */
export function homeUrl(params: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/?${s}` : '/';
}

/** `/app/<name>` with optional query (tab, platform, pre). */
export function appUrl(name: string, params: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return `/app/${encodeURIComponent(name)}${s ? `?${s}` : ''}`;
}

/** Which sidebar item is active for the current location. */
export function activeKey(path: string, q: URLSearchParams): string {
  if (!path.startsWith('/app/') && [...q.keys()].length === 0) return 'home';
  const p = q.get('platform');
  if (path === '/' && p && p !== 'all' && PLATFORMS.includes(p as Platform)) return p;
  if (path === '/' && q.get('sort') === 'downloads') return 'popular';
  return 'apps';
}

export const platformFromQuery = (v: string | null): Platform | null =>
  PLATFORMS.find((p) => p === v) ?? null;

export { PLATFORMS, PLATFORM_LABEL };
