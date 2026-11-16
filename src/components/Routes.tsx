'use client';

import { usePathname } from '@/lib/router';
import { AppDetail } from './AppDetail';
import { Home } from './Home';
import { Btn } from './ui';
import { useRouter } from '@/lib/router';

/** Picks the page from the URL (see lib/router.tsx). */
export function Routes() {
  const path = usePathname();
  const router = useRouter();
  if (path === '/') return <Home />;
  const m = /^\/app\/([^/]+)$/.exec(path);
  if (m) {
    let name = m[1];
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep raw */
    }
    return <AppDetail name={name} />;
  }
  return (
    <div className="empty">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Page not found</h1>
      <Btn onClick={() => router.push('/')}>Back to all apps</Btn>
    </div>
  );
}
