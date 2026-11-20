'use client';

import { Download, LayoutGrid, MonitorSmartphone, SearchX, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { about, allTags, category, displayName, profileName, downloadsFor, latest, platformsOf, publishedMs, releaseDownloads, totalDownloads } from '@/lib/derived';
import { detectPlatform, formatCount, timeAgo } from '@/lib/format';
import { homeUrl, platformFromQuery } from '@/lib/nav';
import { appUrl } from '@/lib/nav';
import { useRouter, useSearchParams } from '@/lib/router';
import { PLATFORMS, PLATFORM_LABEL, type AppEntry, type OwnerProfile } from '@/lib/types';
import { BarChartCard, BarRow, MonthChart } from './charts';
import { MostDownloaded } from './Portfolio';
import { AboutMe } from './AboutMe';
import { AppRow, Btn, ErrorBox, FilterPill, LinkBtn, Pager, Panel, PLATFORM_ICON, SkeletonList, Tabs } from './ui';

const PAGE_SIZE = 6;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Hero({ profile, apps }: { profile: OwnerProfile | null; apps: AppEntry[] | null }) {
  // Platform detection needs the browser: do it after mount (no SSR mismatch).
  const [mine, setMine] = useState<ReturnType<typeof detectPlatform>>(null);
  useEffect(() => setMine(detectPlatform()), []);
  const browse = (
    <LinkBtn href={homeUrl({ platform: mine ?? 'all' })}>{mine ? `Browse ${PLATFORM_LABEL[mine]} apps` : 'Browse apps'}</LinkBtn>
  );
  const download = (
    <div className="hero">
      <h1>Download apps for every platform</h1>
      <p>Android, macOS, Windows and Linux builds, straight from GitHub Releases.</p>
      {browse}
    </div>
  );
  if (!profile) return download;
  return (
    <>
      {download}
      <section style={{ marginTop: 32 }}>
        <AboutMe profile={profile} apps={apps} />
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value, hint, href }: { icon: LucideIcon; label: string; value: string; hint: string; href: string }) {
  const router = useRouter();
  return (
    <button className="stat" onClick={() => router.push(href)}>
      <div className="stat-top">
        <div className="ico"><Icon size={18} /></div>
        <span className="lbl">{label}</span>
      </div>
      <div className="val">{value}</div>
      <div className="hint">{hint}</div>
    </button>
  );
}

function Heading({ title, link, href }: { title: string; link: string; href: string }) {
  const router = useRouter();
  return (
    <div className="section-head">
      <h2 className="h2">{title}</h2>
      <button className="link" onClick={() => router.push(href)}>{link}</button>
    </div>
  );
}

// -------------------------------------------------------------- landing
function Landing({ all }: { all: AppEntry[] }) {
  const router = useRouter();
  const [metric, setMetric] = useState<'downloads' | 'releases'>('downloads');

  const releases = all.reduce((s, a) => s + a.releases.length, 0);
  const downloads = all.reduce((s, a) => s + totalDownloads(a), 0);
  const recent = useMemo(() => [...all].sort((a, b) => publishedMs(b) - publishedMs(a)), [all]);
  const top = useMemo(() => [...all].sort((a, b) => totalDownloads(b) - totalDownloads(a)), [all]);

  // Last 6 months ending at the newest release, bucketed by publish month.
  const monthly = useMemo(() => {
    const dated = all.flatMap((a) => a.releases.filter((r) => r.publishedAt).map((r) => ({ d: r.publishedAt as Date, r })));
    if (dated.length === 0) return MONTHS.slice(0, 6).map((label) => ({ label, value: 0 }));
    const end = new Date(Math.max(...dated.map((x) => x.d.getTime())));
    return Array.from({ length: 6 }, (_, k) => {
      const m = new Date(end.getFullYear(), end.getMonth() - (5 - k), 1);
      const value = dated
        .filter(({ d }) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth())
        .reduce((s, { r }) => s + (metric === 'downloads' ? releaseDownloads(r) : 1), 0);
      return { label: `${MONTHS[m.getMonth()]}${m.getMonth() === 0 ? ` ${String(m.getFullYear() % 100)}` : ''}`, value };
    });
  }, [all, metric]);

  const platDl = Object.fromEntries(PLATFORMS.map((p) => [p, downloadsFor(all, p)])) as Record<(typeof PLATFORMS)[number], number>;
  const maxPlat = Math.max(1, ...Object.values(platDl));
  const maxTop = Math.max(1, top[0] ? totalDownloads(top[0]) : 1);
  const platCount = PLATFORMS.filter((p) => all.some((a) => platformsOf(a).includes(p))).length;

  return (
    <>
      <div className="grid-4">
        <Stat icon={LayoutGrid} label="Apps" value={`${all.length}`} hint="Browse all" href={homeUrl({ platform: 'all' })} />
        <Stat icon={Sparkles} label="Releases" value={`${releases}`} hint={recent.length === 0 ? '' : `Latest ${timeAgo(latest(recent[0]).publishedAt)}`} href={homeUrl({ view: 'releases' })} />
        <Stat icon={Download} label="Downloads" value={formatCount(downloads)} hint="Most downloaded" href={homeUrl({ platform: 'all', sort: 'downloads' })} />
        <Stat icon={MonitorSmartphone} label="Platforms" value={`${platCount}`} hint="View platforms" href={homeUrl({ view: 'platforms' })} />
      </div>

      <div className="two">
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 className="h3" style={{ flex: 1 }}>Release activity</h3>
            <FilterPill on={metric === 'downloads'} onClick={() => setMetric('downloads')}>Downloads</FilterPill>
            <FilterPill on={metric === 'releases'} onClick={() => setMetric('releases')}>Releases</FilterPill>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {metric === 'downloads' ? 'Downloads of releases published each month' : 'Releases published each month'}
          </div>
          <MonthChart data={monthly} unit={metric} />
        </Panel>
        <Panel>
          <h3 className="h3">Downloads by platform</h3>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Click a platform to see its apps</div>
          {PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICON[p];
            return (
              <BarRow
                key={p}
                leading={<Icon size={18} color="var(--muted)" />}
                label={PLATFORM_LABEL[p]}
                fraction={platDl[p] / maxPlat}
                trailing={`${downloads === 0 ? 0 : Math.round((platDl[p] * 100) / downloads)}%`}
                onClick={() => router.push(homeUrl({ platform: p }))}
              />
            );
          })}
        </Panel>
      </div>

      <Panel style={{ marginTop: 16 }}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <h3 className="h3">Top apps</h3>
          <button className="link" onClick={() => router.push(homeUrl({ platform: 'all', sort: 'downloads' }))}>View all</button>
        </div>
        {top.slice(0, 5).map((a, i) => (
          <BarRow
            key={a.name}
            leading={<span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 13 }}>{i + 1}</span>}
            label={displayName(a)}
            fraction={totalDownloads(a) / maxTop}
            trailing={formatCount(totalDownloads(a))}
            onClick={() => router.push(appUrl(a.name))}
          />
        ))}
      </Panel>

      <Heading title="Latest releases" link="View all" href={homeUrl({ view: 'releases' })} />
      {recent.slice(0, 4).map((a) => <AppRow key={a.name} app={a} />)}
    </>
  );
}

// -------------------------------------------------------------- catalog
function Catalog({ all, sp }: { all: AppEntry[]; sp: URLSearchParams }) {
  const router = useRouter();
  const platform = platformFromQuery(sp.get('platform'));
  const qRaw = sp.get('q') ?? '';
  const q = qRaw.toLowerCase();
  const sort = sp.get('sort') ?? 'recent';
  const view = sp.get('view') ?? 'apps';

  const url = (over: Record<string, string>) => homeUrl({ ...Object.fromEntries(sp.entries()), ...over });

  const categories = [...new Set(all.map(category).filter((c): c is string => !!c))].sort();
  const cat = categories.includes(sp.get('category') ?? '') ? sp.get('category') : null;

  const list = all
    .filter((a) => {
      const okC = !cat || category(a) === cat;
      const okP = !platform || platformsOf(a).includes(platform);
      const okQ =
        !q ||
        displayName(a).toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        about(a).toLowerCase().includes(q) ||
        (category(a) ?? '').toLowerCase().includes(q) ||
        allTags(a).some((t) => t.toLowerCase().includes(q));
      return okP && okQ && okC;
    })
    .sort((a, b) =>
      sort === 'name'
        ? displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase())
        : sort === 'downloads'
          ? totalDownloads(b) - totalDownloads(a)
          : publishedMs(b) - publishedMs(a),
    );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, parseInt(sp.get('page') ?? '', 10) || 1));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = all.reduce((s, a) => s + totalDownloads(a), 0);

  const chart = (
    <BarChartCard
      title="Downloads"
      subtitle={`${formatCount(total)} in total`}
      items={PLATFORMS.map((k) => ({
        label: PLATFORM_LABEL[k],
        value: downloadsFor(all, k),
        onClick: () => router.push(url({ platform: k, view: '', page: '' })),
      }))}
    />
  );

  let body: React.ReactNode;
  if (view === 'releases') {
    body = [...all].sort((a, b) => publishedMs(b) - publishedMs(a)).map((a) => <AppRow key={a.name} app={a} tab="versions" />);
  } else if (view === 'platforms') {
    body = (
      <div className="wrap">
        {PLATFORMS.map((k) => {
          const Icon = PLATFORM_ICON[k];
          return (
            <button key={k} className="plat-card" onClick={() => router.push(url({ platform: k, view: '' }))}>
              <Icon size={26} />
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{PLATFORM_LABEL[k]}</div>
              <div className="muted" style={{ fontSize: 13 }}>{all.filter((a) => platformsOf(a).includes(k)).length} apps</div>
            </button>
          );
        })}
      </div>
    );
  } else {
    body = (
      <>
        <div className="toolbar">
          <div className="pills">
            <FilterPill on={platform === null} onClick={() => router.push(url({ platform: 'all', page: '' }))}>All</FilterPill>
            {PLATFORMS.map((k) => (
              <FilterPill key={k} on={platform === k} onClick={() => router.push(url({ platform: k, page: '' }))}>{PLATFORM_LABEL[k]}</FilterPill>
            ))}
          </div>
          <select className="select" value={sort} aria-label="Sort" onChange={(e) => router.push(url({ sort: e.target.value === 'recent' ? '' : e.target.value, page: '' }))}>
            <option value="recent">Recently updated</option>
            <option value="name">Name</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </div>
        {categories.length > 0 && (
          <div className="pills" style={{ marginTop: 10, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12.5, marginRight: 2 }}>Category</span>
            <FilterPill on={cat === null} onClick={() => router.push(url({ category: '', page: '' }))}>Any</FilterPill>
            {categories.map((c) => (
              <FilterPill key={c} on={cat === c} onClick={() => router.push(url({ category: c, page: '' }))}>{c}</FilterPill>
            ))}
          </div>
        )}
        <div className="showing">
          <span>
            {list.length === 0 ? '' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + shown.length} of ${list.length}${q ? ` for “${qRaw}”` : ''}`}
          </span>
          {q && <button className="link" onClick={() => router.push(url({ q: '', page: '' }))}>Clear</button>}
        </div>
        {shown.length === 0 ? (
          <div className="empty" style={{ padding: '48px 0' }}>
            <SearchX size={48} color="var(--muted)" />
            <div style={{ color: 'var(--text)' }}>No apps match your filters</div>
            <Btn onClick={() => router.push(homeUrl({ platform: 'all' }))}>Clear filters</Btn>
          </div>
        ) : (
          shown.map((a) => <AppRow key={a.name} app={a} platform={platform} />)
        )}
        <Pager page={page} pages={pages} onPage={(n) => router.push(url({ page: String(n) }))} />
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>{platform === null ? 'All apps' : `${PLATFORM_LABEL[platform]} apps`}</h1>
      <Tabs
        tabs={[
          { label: 'Apps', on: view === 'apps', onClick: () => router.push(url({ view: '', page: '' })) },
          { label: 'Releases', on: view === 'releases', onClick: () => router.push(url({ view: 'releases', page: '' })) },
          { label: 'Platforms', on: view === 'platforms', onClick: () => router.push(url({ view: 'platforms', page: '' })) },
        ]}
      />
      <div className="side-grid">
        <div>{chart}</div>
        <div style={{ minWidth: 0 }}>{body}</div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- page
export function Home() {
  const { apps, error, reload, profile } = useData();
  const sp = useSearchParams();
  const landing = [...sp.keys()].length === 0;

  useEffect(() => {
    document.title = 'Marketplace — Android, macOS, Windows & Linux apps';
  }, []);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <>
      {landing && (
        <>
          <Hero profile={profile} apps={apps} />
          <div style={{ height: 32 }} />
        </>
      )}
      {apps === null ? (
        <SkeletonList />
      ) : landing ? (
        <>
          <Landing all={apps} />
          <MostDownloaded apps={apps} />
        </>
      ) : (
        <Catalog all={apps} sp={sp} />
      )}
    </>
  );
}
