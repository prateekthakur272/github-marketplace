'use client';

import { Apple, ChevronRight, CloudOff, Monitor, RefreshCw, Smartphone, Terminal, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useRouter } from '@/lib/router';
import { category as appCategory, displayName, iconUrl, latest, platformsOf, totalDownloads } from '@/lib/derived';
import { detectPlatform, formatCount, formatSize, timeAgo } from '@/lib/format';
import { appUrl } from '@/lib/nav';
import { PLATFORMS, PLATFORM_LABEL, type AppEntry, type AssetInfo, type Platform } from '@/lib/types';

export const PLATFORM_ICON: Record<Platform, LucideIcon> = {
  android: Smartphone,
  macos: Apple,
  windows: Monitor,
  linux: Terminal,
};

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`panel ${className}`} style={style}>
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'light' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
};
export function Btn({ kind = 'primary', size = 'md', block, icon, children, className = '', ...rest }: BtnProps) {
  const cls = ['btn', kind === 'primary' ? '' : kind, size === 'md' ? '' : size, block ? 'block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** A real link that looks like a button. */
export function LinkBtn({
  href,
  kind = 'primary',
  size = 'md',
  children,
  icon,
  external,
}: {
  href: string;
  kind?: 'primary' | 'light' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  icon?: ReactNode;
  external?: boolean;
}) {
  const cls = ['btn', kind === 'primary' ? '' : kind, size === 'md' ? '' : size].filter(Boolean).join(' ');
  return external ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
      {icon}
      {children}
    </a>
  ) : (
    <Link className={cls} href={href}>
      {icon}
      {children}
    </Link>
  );
}

export function FilterPill({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`pill ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={!!on}>
      {children}
    </button>
  );
}

/** Underline tabs: Apps / Releases / Platforms, Overview / Versions. */
export function Tabs({ tabs }: { tabs: { label: string; on: boolean; onClick: () => void }[] }) {
  return (
    <div className="utabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.label} role="tab" aria-selected={t.on} className={`utab ${t.on ? 'on' : ''}`} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toast
let toastSet: ((m: string | null) => void) | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(message: string) {
  toastSet?.(message);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastSet?.(null), 3000);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

/** Opens a download and tells the user, like the Flutter snackbar. */
export function useDownload() {
  return useCallback((a: AssetInfo) => {
    window.open(a.url, '_blank', 'noopener');
    showToast(`Downloading ${a.name}`);
  }, []);
}

// ---------------------------------------------------------------- rows
export function quickAsset(app: AppEntry, platform?: Platform | null) {
  const target = platform ?? detectPlatform();
  return latest(app).assets.find((a) => a.platform === target);
}

export function AppRow({ app, platform, tab }: { app: AppEntry; platform?: Platform | null; tab?: string }) {
  const router = useRouter();
  const download = useDownload();
  const [target, setTarget] = useState<Platform | null>(platform ?? null);
  useEffect(() => setTarget(platform ?? detectPlatform()), [platform]);
  const quick = target ? latest(app).assets.find((a) => a.platform === target) : undefined;
  const open = () => router.push(appUrl(app.name, { tab }));
  const plats = PLATFORMS.filter((p) => platformsOf(app).includes(p)).map((p) => PLATFORM_LABEL[p]).join(', ');
  const cat = appCategory(app);
  return (
    <div className="hover-row app-row" role="link" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <AppIcon app={app} />
      <div className="meta">
        <div className="name">{displayName(app)}</div>
        <div className="sub">
          {cat ? `${cat} · ` : ''}v{latest(app).version ?? latest(app).tag} · {timeAgo(latest(app).publishedAt)} · {plats}
        </div>
      </div>
      <div className="dl-col wide420">
        <b>{formatCount(totalDownloads(app))}</b>
        <span>downloads</span>
      </div>
      {quick ? (
        <button
          className="btn sm"
          onClick={(e) => {
            e.stopPropagation();
            download(quick);
          }}
        >
          Get
        </button>
      ) : (
        <ChevronRight size={22} color="var(--muted)" />
      )}
    </div>
  );
}

export function AssetRow({ a }: { a: AssetInfo }) {
  const download = useDownload();
  return (
    <div className="hover-row asset-row">
      <div className="type-tile">{a.packageType.length > 4 ? a.packageType.slice(0, 4) : a.packageType}</div>
      <div className="meta">
        <div className="name" title={a.name}>{a.name}</div>
        <div className="sub">{a.packageType} · {formatSize(a.size)} · {PLATFORM_LABEL[a.platform]}</div>
      </div>
      <div className="dl-col wide460">
        <b>{formatCount(a.downloadCount)}</b>
        <span>downloads</span>
      </div>
      <button className="btn sm" onClick={() => download(a)}>Download</button>
    </div>
  );
}

export function AppIcon({ app, size = 48 }: { app: AppEntry; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="app-icon"
      src={iconUrl(app)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  const btn = (t: string, target: number | null, current = false) => (
    <button
      key={t}
      className={`pg ${current ? 'on' : ''}`}
      disabled={target === null}
      onClick={() => target !== null && onPage(target)}
      aria-current={current ? 'page' : undefined}
    >
      {t}
    </button>
  );
  return (
    <nav className="pager" aria-label="Pagination">
      {btn('‹', page > 1 ? page - 1 : null)}
      {Array.from({ length: pages }, (_, i) => btn(`${i + 1}`, i + 1, i + 1 === page))}
      {btn('›', page < pages ? page + 1 : null)}
    </nav>
  );
}

// ---------------------------------------------------------- load states
export function Spinner() {
  return (
    <div style={{ padding: 60, display: 'grid', placeItems: 'center' }}>
      <div className="spinner" role="progressbar" aria-label="Loading" />
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="skel" key={i} style={{ animationDelay: `${i * 90}ms` }}>
          <div className="sb" style={{ width: 46, height: 46, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sb" style={{ width: 140, height: 12 }} />
            <div className="sb" style={{ width: 90, height: 10 }} />
          </div>
          <div className="sb" style={{ width: 52, height: 24, marginLeft: 'auto', borderRadius: 12 }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-box">
      <CloudOff size={56} color="var(--muted)" />
      <div>{message}</div>
      <Btn onClick={onRetry} icon={<RefreshCw size={18} />}>Try again</Btn>
    </div>
  );
}
