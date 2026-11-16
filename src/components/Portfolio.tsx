'use client';

import { Building2, CalendarDays, MapPin } from 'lucide-react';
import { blogUrl } from '@/lib/github';
import { profileName, totalDownloads } from '@/lib/derived';
import { formatCount } from '@/lib/format';
import type { AppEntry, OwnerProfile } from '@/lib/types';
import { AppRow, Panel } from './ui';

/** Mini portfolio: who I am, headline numbers and my top apps. */
export function Portfolio({ profile, apps }: { profile: OwnerProfile | null; apps: AppEntry[] }) {
  if (!profile) return null;
  const u = profile;
  const top = [...apps].sort((a, b) => totalDownloads(b) - totalDownloads(a)).slice(0, 3);
  const downloads = apps.reduce((s, a) => s + totalDownloads(a), 0);
  const since = u.createdAt?.getFullYear();
  const site = blogUrl(u);
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>About the developer</h2>
      <Panel>
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
          <div><b>{apps.length}</b><span>Apps</span></div>
          <div><b>{formatCount(downloads)}</b><span>Downloads</span></div>
          <div><b>{formatCount(u.followers)}</b><span>Followers</span></div>
          <div><b>{formatCount(u.publicRepos)}</b><span>Repos</span></div>
        </div>
        {top.length > 0 && (
          <>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Featured apps</div>
            {top.map((a) => (
              <AppRow key={a.name} app={a} />
            ))}
          </>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <a className="btn sm" href={u.htmlUrl} target="_blank" rel="noopener noreferrer">GitHub profile</a>
          {site && <a className="btn light sm" href={site} target="_blank" rel="noopener noreferrer">Website</a>}
          {u.twitter && (
            <a className="btn light sm" href={`https://x.com/${u.twitter}`} target="_blank" rel="noopener noreferrer">
              X / Twitter
            </a>
          )}
        </div>
      </Panel>
    </section>
  );
}
