'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { invalidate, loadApps, loadProfile } from './github';
import type { AppEntry, OwnerProfile } from './types';

// ---------------------------------------------------------------- theme
type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

// ----------------------------------------------------------------- data
interface DataState {
  apps: AppEntry[] | null;
  error: string | null;
  profile: OwnerProfile | null;
  profileLoaded: boolean;
  reload: () => void;
}
const DataCtx = createContext<DataState>({
  apps: null,
  error: null,
  profile: null,
  profileLoaded: false,
  reload: () => {},
});
export const useData = () => useContext(DataCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [apps, setApps] = useState<AppEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Theme: saved choice, else the OS preference. (A tiny inline script in
  // layout.tsx sets data-theme before paint to avoid a flash.)
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === 'dark' ? 'dark' : 'light');
  }, []);
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    setApps(null);
    setError(null);
    setProfileLoaded(false);
    loadApps().then(
      (a) => alive && setApps(a),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    loadProfile().then((p) => {
      if (!alive) return;
      setProfile(p);
      setProfileLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    invalidate();
    setNonce((n) => n + 1);
  }, []);

  const data = useMemo(
    () => ({ apps, error, profile, profileLoaded, reload }),
    [apps, error, profile, profileLoaded, reload],
  );
  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <DataCtx.Provider value={data}>{children}</DataCtx.Provider>
    </ThemeCtx.Provider>
  );
}
