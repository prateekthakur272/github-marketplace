'use client';

import { CloudOff, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import {
  allTags,
  displayName,
  iconUrl,
  latest,
  platformsOf,
  releaseDownloads,
  releasePlatforms,
  screenshots,
  summary,
} from '@/lib/derived';
import { detectPlatform, formatCount, timeAgo } from '@/lib/format';
import { appUrl, homeUrl, platformFromQuery } from '@/lib/nav';
import { useRouter, useSearchParams } from '@/lib/router';
import { PLATFORM_LABEL, type AppEntry, type Platform } from '@/lib/types';
import { BarChartCard } from './charts';
import { ScreenshotGallery } from './ScreenshotGallery';
import { AppRow, AssetRow, Btn, FilterPill, Panel, Spinner, Tabs, showToast, useDownload } from './ui';

function Detail({ app, all }: { app: AppEntry; all: AppEntry[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const download = useDownload();
  const [mine, setMine] = useState<Platform | null>(null);
  useEffect(() => setMine(detectPlatform()), []);

  const rel = latest(app);
  const avail = releasePlatforms(rel);
  const wanted = platformFromQuery(sp.get('platform'));
  const sel = wanted && avail.includes(wanted) ? wanted : mine && avail.includes(mine) ? mine : avail[0];
  const assets = rel.assets.filter((a) => a.platform === sel);
  const primary = assets[0];
  const tab = sp.get('tab') ?? 'overview';
  const pre = sp.get('pre') === '1';
  const hist = app.releases.filter((r) => pre || !r.prerelease);
  const related = all.filter((x) => x !== app && platformsOf(x).some((p) => platformsOf(app).includes(p))).slice(0, 3);
  const previous = app.releases.filter((r) => r !== rel && !r.prerelease).slice(0, 3);

  const url = (over: { tab?: string; platform?: string; pre?: boolean }) => {
    const m: Record<string, string> = {};
    for (const [k, v] of sp.entries()) m[k] = v;
    if (over.tab !== undefined) m.tab = over.tab;
    if (over.platform !== undefined) m.platform = over.platform;
    if (over.pre !== undefined) m.pre = over.pre ? '1' : '';
    if (m.tab === 'overview') m.tab = '';
    return appUrl(app.name, m);
  };

  useEffect(() => {
    document.title = `${displayName(app)} — Marketplace`;
  }, [app]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link copied');
    } catch {
      /* clipboard blocked */
    }
  };

  const info = app.info;
  const rows: [string, string][] = [
    ['Version', `v${rel.version ?? rel.tag}`],
    ['Updated', timeAgo(rel.publishedAt)],
    ['Releases', `${app.releases.length}`],
    ...(info?.category ? ([['Category', info.category]] as [string, string][]) : []),
    ...(info?.developer ? ([['Developer', info.developer]] as [string, string][]) : []),
    ...(info?.license ? ([['License', info.license]] as [string, string][]) : []),
    ['Supported OS', (info && info.supportedOs.length ? info.supportedOs : avail).map((p) => PLATFORM_LABEL[p]).join(', ')],
    ...(sel && info?.minOs[sel] ? ([['Requires', `${PLATFORM_LABEL[sel]} ${info.minOs[sel]}+`]] as [string, string][]) : []),
  ];
  const links = [
    ['Website', info?.website],
    ['Support', info?.supportUrl],
    ['Privacy policy', info?.privacyPolicy],
  ].filter((l): l is [string, string] => !!l[1]);

  const chart = (
    <BarChartCard
      title="Downloads"
      subtitle={`by release · ${formatCount(app.releases.reduce((s, r) => s + releaseDownloads(r), 0))} total`}
      items={app.releases
        .slice(0, 5)
        .reverse()
        .map((r) => {
          const v = `v${r.version ?? r.tag}`;
          return { label: v.length > 7 ? v.slice(0, 7) : v, value: releaseDownloads(r), onClick: () => router.push(url({ tab: 'versions' })) };
        })}
    />
  );

  const side = (
    <div>
      <Panel>
        <div className="h3" style={{ marginBottom: 8 }}>Details</div>
        {rows.map(([k, v]) => (
          <div className="kv" key={k}><span>{k}</span><span>{v}</span></div>
        ))}
        {allTags(app).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {allTags(app).map((t) => (
              <button key={t} className="tag" onClick={() => router.push(homeUrl({ platform: 'all', q: t }))}>{t}</button>
            ))}
          </div>
        )}
      </Panel>
      {links.length > 0 && (
        <Panel style={{ marginTop: 16 }}>
          <div className="h3" style={{ marginBottom: 6 }}>Links</div>
          {links.map(([label, href]) => (
            <a key={label} className="kv link-line" href={href} target="_blank" rel="noopener noreferrer">
              <span>{label}</span>
              <ExternalLink size={15} color="var(--muted)" />
            </a>
          ))}
        </Panel>
      )}
      <div style={{ marginTop: 16 }}>{chart}</div>
    </div>
  );

  const picker = (
    <div className="pills" style={{ marginBottom: 10 }}>
      {avail.map((k) => (
        <FilterPill key={k} on={k === sel} onClick={() => router.push(url({ platform: k }))}>{PLATFORM_LABEL[k]}</FilterPill>
      ))}
    </div>
  );

  const content =
    tab === 'versions' ? (
      <>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 className="h2">Version history</h2>
          <FilterPill on={pre} onClick={() => router.push(url({ pre: !pre }))}>Pre-releases: {pre ? 'on' : 'off'}</FilterPill>
        </div>
        {hist.map((r, i) => (
          <details className="rel" key={r.tag} open={i === 0}>
            <summary>
              <div>
                <span style={{ fontWeight: 700 }}>v{r.version ?? r.tag}</span>
                {r === rel && <span className="badge" style={{ marginLeft: 8 }}>Latest</span>}
                {r.prerelease && <span className="badge" style={{ marginLeft: 8 }}>Pre-release</span>}
                <div className="muted" style={{ fontSize: 12 }}>{timeAgo(r.publishedAt)}</div>
              </div>
            </summary>
            <div className="body">{r.assets.map((a) => <AssetRow key={a.url} a={a} />)}</div>
          </details>
        ))}
      </>
    ) : (
      <>
        {screenshots(app).length > 0 && (
          <div style={{ marginBottom: 22 }}><ScreenshotGallery urls={screenshots(app)} /></div>
        )}
        {info?.description && (
          <>
            <h2 className="h2" style={{ marginBottom: 8 }}>About this app</h2>
            <p style={{ lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 26 }}>{info.description}</p>
          </>
        )}
        {picker}
        {assets.map((a) => <AssetRow key={a.url} a={a} />)}
        {rel.notes.trim() && (
          <>
            <h2 className="h2" style={{ margin: '26px 0 10px' }}>What&apos;s new in v{rel.version ?? rel.tag}</h2>
            <div className="notes">{rel.notes}</div>
          </>
        )}
        {previous.length > 0 && (
          <>
            <h2 className="h2" style={{ margin: '26px 0 10px' }}>Previous versions</h2>
            {previous.map((r) => (
              <details className="rel" key={r.tag}>
                <summary>
                  <div>
                    <span style={{ fontWeight: 700 }}>v{r.version ?? r.tag}</span>
                    <div className="muted" style={{ fontSize: 12 }}>{timeAgo(r.publishedAt)}</div>
                  </div>
                </summary>
                <div className="body">{r.assets.map((a) => <AssetRow key={a.url} a={a} />)}</div>
              </details>
            ))}
          </>
        )}
      </>
    );

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <button onClick={() => router.push('/')}>Home</button><i>›</i>
        <button onClick={() => router.push(homeUrl({ platform: 'all' }))}>Apps</button><i>›</i>
        {sel && (<><button onClick={() => router.push(homeUrl({ platform: sel }))}>{PLATFORM_LABEL[sel]}</button><i>›</i></>)}
        <b>{displayName(app)}</b>
      </nav>

      <div className="app-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl(app)} alt="" width={92} height={92} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        <div style={{ maxWidth: 560 }}>
          <div>
            <h1>{displayName(app)}</h1>
            <span className="ver">v{rel.version ?? rel.tag}</span>
          </div>
          <p className="muted" style={{ marginTop: 6, fontWeight: 500 }}>{summary(app) || 'No description provided.'}</p>
          <div className="actions">
            {primary && sel && (
              <Btn size="lg" icon={<Download size={18} />} onClick={() => download(primary)}>Download for {PLATFORM_LABEL[sel]}</Btn>
            )}
            <a className="btn light lg" href={app.repoUrl} target="_blank" rel="noopener noreferrer">View on GitHub</a>
            <Btn kind="light" size="lg" onClick={copy}>Copy link</Btn>
          </div>
        </div>
      </div>

      <div style={{ height: 28 }} />
      <Tabs
        tabs={[
          { label: 'Overview', on: tab === 'overview', onClick: () => router.push(url({ tab: 'overview' })) },
          { label: `Versions (${app.releases.length})`, on: tab === 'versions', onClick: () => router.push(url({ tab: 'versions' })) },
        ]}
      />
      <div className="side-grid">
        <div>{side}</div>
        <div style={{ minWidth: 0 }}>{content}</div>
      </div>

      {related.length > 0 && (
        <>
          <h2 className="h2" style={{ margin: '32px 0 8px' }}>More apps you might like</h2>
          {related.map((a) => <AppRow key={a.name} app={a} />)}
        </>
      )}
    </>
  );
}

export function AppDetail({ name }: { name: string }) {
  const { apps, error, reload } = useData();
  const router = useRouter();

  if (apps === null && !error) return <Spinner />;
  if (error) {
    // A failed load is not "app not found": say what went wrong.
    return (
      <div className="error-box" style={{ padding: 48 }}>
        <CloudOff size={48} />
        <div>{error}</div>
        <Btn onClick={reload} icon={<RefreshCw size={18} />}>Try again</Btn>
      </div>
    );
  }
  const app = (apps ?? []).find((a) => a.name === name);
  if (!app) {
    return (
      <div className="empty" style={{ padding: 48 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>App not found</h1>
        <Btn onClick={() => router.push('/')}>Back to all apps</Btn>
      </div>
    );
  }
  return <Detail app={app} all={apps ?? []} />;
}
