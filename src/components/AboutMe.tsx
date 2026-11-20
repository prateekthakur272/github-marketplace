'use client';

import { Building2, CalendarDays, MapPin } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { profileName, totalDownloads } from '@/lib/derived';
import { formatCount } from '@/lib/format';
import { homeUrl } from '@/lib/nav';
import { useRouter } from '@/lib/router';
import type { AppEntry, OwnerProfile } from '@/lib/types';
import { Socials } from './Socials';
import { Panel } from './ui';

/** Counts up from 0 to `target` once (skipped for reduced motion). */
function useCountUp(target: number | null, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (target === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : v;
}

function Stat({ value, label, onClick, href }: { value: number | null; label: string; onClick?: () => void; href?: string }) {
  const n = useCountUp(value);
  const inner = (
    <>
      <b>{n === null ? '–' : formatCount(n)}</b>
      <span>{label}</span>
    </>
  );
  return href ? (
    <a className="about-stat" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    <button className="about-stat" onClick={onClick}>{inner}</button>
  );
}

/** Full-width About me card: identity on top, stat row, then links. */
export function AboutMe({ profile: u, apps }: { profile: OwnerProfile; apps: AppEntry[] | null }) {
  const router = useRouter();
  const downloads = apps ? apps.reduce((s, a) => s + totalDownloads(a), 0) : null;
  const since = u.createdAt?.getFullYear();
  return (
    <Panel>
      <h2 className="about-title" style={{ marginBottom: 16 }}>About me</h2>
      <div className="portfolio-head">
        {u.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={u.avatarUrl} width={76} height={76} alt="" />
        )}
        <div style={{ flex: 1, minWidth: 220, maxWidth: 560 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{profileName(u)}</div>
          <div className="muted" style={{ fontSize: 13 }}>@{u.login}</div>
          {u.bio && <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.5 }}>{u.bio}</p>}
          <div className="chips">
            {u.location && <span><MapPin size={15} />{u.location}</span>}
            {u.company && <span><Building2 size={15} />{u.company}</span>}
            {since && <span><CalendarDays size={15} />On GitHub since {since}</span>}
          </div>
        </div>
      </div>
      <div className="portfolio-stats">
        <Stat value={apps ? apps.length : null} label="Apps" onClick={() => router.push(homeUrl({ platform: 'all' }))} />
        <Stat value={downloads} label="Downloads" onClick={() => router.push(homeUrl({ platform: 'all', sort: 'downloads' }))} />
        <Stat value={u.followers} label="Followers" href={`${u.htmlUrl}?tab=followers`} />
        <Stat value={u.publicRepos} label="Repos" href={`${u.htmlUrl}?tab=repositories`} />
      </div>
      <Socials profile={u} align="start" withGithub />
    </Panel>
  );
}
