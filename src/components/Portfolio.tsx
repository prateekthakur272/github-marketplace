'use client';

import { totalDownloads } from '@/lib/derived';
import type { AppEntry } from '@/lib/types';
import { useRouter } from '@/lib/router';
import { homeUrl } from '@/lib/nav';
import { AppRow } from './ui';

/** The most downloaded apps, as their own section. */
export function MostDownloaded({ apps, count = 3 }: { apps: AppEntry[]; count?: number }) {
  const router = useRouter();
  const top = [...apps].sort((a, b) => totalDownloads(b) - totalDownloads(a)).slice(0, count);
  if (top.length === 0) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <div className="section-head">
        <h2 className="h2" style={{ fontSize: 20 }}>Most downloaded apps</h2>
        <button className="link" onClick={() => router.push(homeUrl({ platform: 'all', sort: 'downloads' }))}>View all</button>
      </div>
      {top.map((a) => (
        <AppRow key={a.name} app={a} />
      ))}
    </section>
  );
}
