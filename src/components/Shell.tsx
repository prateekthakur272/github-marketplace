'use client';

import {
  BarChart3,
  Building2,
  LayoutGrid,
  Link2,
  MapPin,
  Menu,
  Moon,
  Search,
  Store,
  Sun,
  Tag,
  User,
  X,
  Code,
  Home,
  AtSign,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from '@/lib/router';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from '@/lib/config';
import { Socials } from './Socials';
import { blogUrl } from '@/lib/github';
import { useData, useTheme } from '@/lib/data';
import { displayName, latest, profileName, publishedMs, totalDownloads } from '@/lib/derived';
import { detectPlatform, formatCount, timeAgo } from '@/lib/format';
import { activeKey, appUrl, homeUrl } from '@/lib/nav';
import { PLATFORMS, PLATFORM_LABEL, type AppEntry, type Platform } from '@/lib/types';
import { AppIcon, Panel, PLATFORM_ICON, ToastHost, useDownload } from './ui';

interface Dest {
  key: string;
  icon: LucideIcon;
  label: string;
  target: string;
}
const MAIN: Dest[] = [
  { key: 'home', icon: Home, label: 'Home', target: '/' },
  { key: 'apps', icon: LayoutGrid, label: 'All Apps', target: '/?platform=all' },
];
const POPULAR: Dest = {
  key: 'popular',
  icon: BarChart3,
  label: 'Popular',
  target: '/?platform=all&sort=downloads',
};
const PLATS: Dest[] = PLATFORMS.map((p) => ({
  key: p,
  icon: PLATFORM_ICON[p],
  label: PLATFORM_LABEL[p],
  target: `/?platform=${p}`,
}));

const GITHUB = `https://github.com/${config.githubOwner}`;

// ------------------------------------------------------------- search
function SearchBox({ autoFocus, inputRef }: { autoFocus?: boolean; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get('q') ?? '');
  const focused = useRef(false);
  const q = sp.get('q') ?? '';
  // Keep the text in sync with the URL, unless the user is typing.
  useEffect(() => {
    if (!focused.current) setValue(q);
  }, [q]);
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const t = value.trim();
        router.push(homeUrl({ platform: 'all', q: t || undefined }));
      }}
    >
      <Search size={18} />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        placeholder="Search for apps, topics, releases…  (press /)"
        aria-label="Search apps"
      />
    </form>
  );
}

// -------------------------------------------------------------- nav UI
function NavItems({ active, go }: { active: string; go: (t: string) => void }) {
  const { theme, toggle } = useTheme();
  const items = [...MAIN, ...PLATS, POPULAR];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((d) => (
        <button key={d.key} className={`nav-item ${active === d.key ? 'on' : ''}`} onClick={() => go(d.target)}>
          <d.icon size={20} />
          {d.label}
        </button>
      ))}
      <button className="nav-item" onClick={toggle}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    </nav>
  );
}

function SidebarBody({ active, go }: { active: string; go: (t: string) => void }) {
  return (
    <>
      <div className="brand" onClick={() => go('/')}>
        <div className="logo">
          <Store size={22} />
        </div>
        Marketplace
      </div>
      <NavItems active={active} go={go} />
      <div style={{ flex: 1, minHeight: 20 }} />
      <div className="follow">
        Follow the project on GitHub to get notified about new releases.
        <a className="btn" href={GITHUB} target="_blank" rel="noopener noreferrer">
          Open GitHub
        </a>
      </div>
      <div className="version">
        <Tag size={13} />
        {config.appVersion}
      </div>
    </>
  );
}

function SlimRail({ active, go }: { active: string; go: (t: string) => void }) {
  const { theme, toggle } = useTheme();
  const tile = (d: Dest, label = d.label) => (
    <button key={d.key} className={`slim-tile ${active === d.key ? 'on' : ''}`} onClick={() => go(d.target)} title={d.label}>
      <d.icon size={21} />
      {label}
    </button>
  );
  return (
    <aside className="slim tablet-only" aria-label="Main">
      <div className="logo">
        <Store size={22} />
      </div>
      <div className="slim-list">
        {tile(MAIN[0])}
        {tile(MAIN[1], 'Apps')}
        {tile(POPULAR)}
        <div className="slim-sep" />
        {PLATS.map((d) => tile(d))}
      </div>
      <a className="icon-btn" href={GITHUB} target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
        <Code size={20} />
      </a>
      <button className="icon-btn" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </aside>
  );
}

function BottomBar({ active, go, onMore }: { active: string; go: (t: string) => void; onMore: () => void }) {
  const items = [MAIN[0], { ...MAIN[1], label: 'Apps' }, POPULAR];
  return (
    <nav className="bottombar" aria-label="Main">
      {items.map((d) => (
        <button key={d.key} className={`bb-item ${active === d.key ? 'on' : ''}`} onClick={() => go(d.target)} aria-label={d.label}>
          <d.icon size={21} />
          <span>{d.label}</span>
        </button>
      ))}
      <button className="bb-item" onClick={onMore} aria-label="More">
        <Menu size={21} />
        <span>More</span>
      </button>
    </nav>
  );
}

function Header() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <header className="header">
      {open ? (
        <>
          <div style={{ flex: 1 }}>
            <SearchBox autoFocus inputRef={ref} />
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close search">
            <X size={20} />
          </button>
        </>
      ) : (
        <>
          <div className="logo phone-only" style={{ width: 34, height: 34 }}>
            <Store size={19} />
          </div>
          <div className="title">Marketplace</div>
          <div className="grow tablet-only">
            <SearchBox />
          </div>
          <button className="icon-btn phone-only" onClick={() => setOpen(true)} aria-label="Search">
            <Search size={20} />
          </button>
          <button className="icon-btn phone-only" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </>
      )}
    </header>
  );
}

// --------------------------------------------------------- right rail
export function ProfileCard() {
  const { profile, profileLoaded } = useData();
  if (!profileLoaded) return <div style={{ height: 180, borderRadius: 12, background: 'var(--field)' }} />;
  if (!profile) {
    return (
      <Panel>
        <div className="row-between">
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
            <User size={18} /> @{config.githubOwner}
          </span>
          <a className="btn light sm" href={GITHUB} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </Panel>
    );
  }
  const u = profile;
  const info = (icon: ReactNode, text: string, url?: string) => (
    <div className="info-line" key={text}>
      {icon}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
  return (
    <Panel className="profile-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {u.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={u.avatarUrl} width={52} height={52} alt="" />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{profileName(u)}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            @{u.login}
          </div>
        </div>
      </div>
      {u.bio && <p style={{ fontSize: 13, lineHeight: 1.45 }}>{u.bio}</p>}
      <div>
        {u.company && info(<Building2 size={15} />, u.company)}
        {u.location && info(<MapPin size={15} />, u.location)}
        {blogUrl(u) && info(<Link2 size={15} />, u.blog!, blogUrl(u))}
        {u.twitter && info(<AtSign size={15} />, u.twitter, `https://x.com/${u.twitter}`)}
      </div>
      <div className="pstats">
        <div><b>{formatCount(u.followers)}</b><span>Followers</span></div>
        <div><b>{formatCount(u.following)}</b><span>Following</span></div>
        <div><b>{formatCount(u.publicRepos)}</b><span>Repos</span></div>
      </div>
      <Socials profile={u} />
      <a className="btn light sm" href={u.htmlUrl} target="_blank" rel="noopener noreferrer">
        View GitHub profile
      </a>
    </Panel>
  );
}

function ActivityTile({ app, go }: { app: AppEntry; go: (t: string) => void }) {
  const download = useDownload();
  const [mine, setMine] = useState<Platform | null>(null);
  useEffect(() => setMine(detectPlatform()), []);
  const quick = mine ? latest(app).assets.find((a) => a.platform === mine) : undefined;
  return (
    <div className="hover-row" role="link" tabIndex={0} onClick={() => go(appUrl(app.name))} onKeyDown={(e) => e.key === 'Enter' && go(appUrl(app.name))}>
      <AppIcon app={app} size={40} />
      <div className="meta" style={{ flex: 1, minWidth: 0 }}>
        <div className="name" style={{ fontSize: 13.5 }}>{displayName(app)}</div>
        <div className="sub" style={{ fontSize: 12 }}>v{latest(app).version ?? latest(app).tag} · {timeAgo(latest(app).publishedAt)}</div>
      </div>
      {quick && (
        <button className="btn soft sm" onClick={(e) => (e.stopPropagation(), download(quick))}>Get</button>
      )}
    </div>
  );
}

function RailBody() {
  const { apps } = useData();
  const router = useRouter();
  const list = apps ?? [];
  const recent = [...list].sort((a, b) => publishedMs(b) - publishedMs(a)).slice(0, 6);
  const total = list.reduce((s, a) => s + totalDownloads(a), 0);
  return (
    <div>
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 13 }}>Total downloads</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{formatCount(total)}</div>
          </div>
          <a className="btn light sm" href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </Panel>
      <div style={{ height: 16 }} />
      <ProfileCard />
      <div style={{ height: 26 }} />
      <div className="row-between">
        <h3 className="h3">New Activities</h3>
        <button className="link muted-link" onClick={() => router.push(homeUrl({ view: 'releases' }))}>View All</button>
      </div>
      <div style={{ height: 8 }} />
      {apps === null &&
        [0, 1, 2, 3].map((i) => <div key={i} style={{ height: 56, margin: '4px 0', borderRadius: 12, background: 'var(--field)' }} />)}
      {recent.map((a) => <ActivityTile key={a.name} app={a} go={router.push} />)}
    </div>
  );
}

// --------------------------------------------------------------- footer
function Footer() {
  return (
    <footer className="footer">
      <span>
        © {new Date().getFullYear()} {config.githubOwner} · Downloads are served by GitHub Releases.
      </span>
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
    </footer>
  );
}

// ---------------------------------------------------------------- shell
function ShellInner({ children }: { children: ReactNode }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const active = activeKey(path.replace(/\/$/, '') || '/', sp);

  const go = (target: string) => {
    setDrawer(false);
    router.push(target);
  };

  // Scroll to top on navigation; "/" focuses search; Esc blurs it.
  // On app detail pages, tab/filter changes only touch the query string, so keep
  // the scroll position and scroll to top only when the path itself changes.
  const isDetail = path.startsWith('/app/');
  const scrollKey = isDetail ? path : `${path}?${sp.toString()}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [scrollKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing) {
        const input = document.querySelector<HTMLInputElement>('.search input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      } else if (e.key === 'Escape' && typing) el?.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <aside className="side" aria-label="Sidebar">
        <SidebarBody active={active} go={go} />
      </aside>
      <SlimRail active={active} go={go} />
      <div className="main">
        <Header />
        <main className="content">
          <div className="desktop-search">
            <SearchBox />
          </div>
          {children}
          <div className="inline-rail">
            <RailBody />
          </div>
          <Footer />
        </main>
        <div className="bottom-pad" />
      </div>
      <aside className="right" aria-label="Profile and activity">
        <RailBody />
      </aside>
      <BottomBar active={active} go={go} onMore={() => setDrawer(true)} />
      <ToastHost />
      {drawer && (
        <>
          <div className="scrim" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
            <SidebarBody active={active} go={go} />
          </div>
        </>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}

