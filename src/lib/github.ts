import { classifyAsset } from './classify';
import { config } from './config';
import { parseAppInfo, pickScreenshots, toMarketplaceInfo, type RawInfo } from './info';
import { compareReleases, parseVersion, versionString } from './version';
import { publishedMs } from './derived';
import type { AppEntry, AssetInfo, OwnerProfile, ReleaseInfo } from './types';

export class RateLimitError extends Error {
  constructor() {
    super(
      config.hasToken
        ? 'GitHub rate limit reached even with the token. Try again later.'
        : "No GitHub token was set for this build, so GitHub's anonymous limit (60/hour) applies. Set NEXT_PUBLIC_GITHUB_TOKEN and rebuild.",
    );
    this.name = 'RateLimitError';
  }
}

// ---------------------------------------------------------------- shapes
// GitHub REST-like shapes shared by the GraphQL, REST and Supabase paths.
interface RawAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  download_count?: number;
}
interface RawRelease {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
  assets: RawAsset[];
}
interface RawRepo {
  name: string;
  description?: string | null;
  html_url: string;
  topics?: string[];
  owner: { avatar_url: string };
  default_branch?: string;
}
interface RawMarketplace {
  info: RawInfo | null;
  icon: string | null;
  screenshots: string[];
}

// Overridable for tests / GitHub Enterprise.
const API = process.env.NEXT_PUBLIC_GITHUB_API || 'https://api.github.com';
const OWNER = config.githubOwner;

// -------------------------------------------------------------- building
export function buildApp(
  repo: RawRepo,
  list: RawRelease[],
  marketplace?: RawMarketplace | null,
): AppEntry | null {
  const releases: ReleaseInfo[] = [];
  for (const r of list) {
    if (r.draft) continue;
    const assets: AssetInfo[] = [];
    for (const a of r.assets) {
      const c = classifyAsset(a.name);
      if (!c) continue;
      assets.push({
        name: a.name,
        url: a.browser_download_url,
        size: a.size ?? 0,
        downloadCount: a.download_count ?? 0,
        platform: c.platform,
        packageType: c.packageType,
      });
    }
    if (assets.length === 0) continue;
    const v = parseVersion(r.tag_name);
    const date = r.published_at ? new Date(r.published_at) : null;
    releases.push({
      tag: r.tag_name,
      version: v ? versionString(v) : null,
      name: r.name ? r.name : r.tag_name,
      notes: r.body ?? '',
      publishedAt: date && !isNaN(date.getTime()) ? date : null,
      prerelease: r.prerelease === true,
      assets,
    });
  }
  if (releases.length === 0) return null;
  releases.sort((a, b) =>
    compareReleases(
      { v: a.version ? parseVersion(a.version) : null, date: a.publishedAt },
      { v: b.version ? parseVersion(b.version) : null, date: b.publishedAt },
    ),
  );
  return {
    name: repo.name,
    description: repo.description ?? '',
    avatarUrl: repo.owner.avatar_url,
    repoUrl: repo.html_url,
    topics: repo.topics ?? [],
    info: marketplace ? toMarketplaceInfo(marketplace) : null,
    releases,
  };
}

const sortApps = (apps: AppEntry[]) => apps.sort((a, b) => publishedMs(b) - publishedMs(a));

// --------------------------------------------------------------- profile
interface RawProfile {
  login: string;
  html_url?: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  /** REST-shaped: [{provider, url}] (GraphQL's socialAccounts is mapped to this). */
  social_accounts?: { provider?: string | null; url?: string | null }[] | null;
  followers?: number;
  following?: number;
  public_repos?: number;
  created_at?: string | null;
}

const clean = (v: unknown): string | undefined => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t === '' ? undefined : t;
};

export function toProfile(j: RawProfile): OwnerProfile {
  const created = j.created_at ? new Date(j.created_at) : null;
  return {
    login: j.login,
    htmlUrl: j.html_url ?? `https://github.com/${j.login}`,
    name: clean(j.name),
    avatarUrl: clean(j.avatar_url),
    bio: clean(j.bio),
    company: clean(j.company),
    location: clean(j.location),
    blog: clean(j.blog),
    twitter: clean(j.twitter_username),
    socials: (j.social_accounts ?? []).flatMap((s) => {
      const url = clean(s?.url);
      return url ? [{ provider: (clean(s?.provider) ?? 'generic').toLowerCase(), url }] : [];
    }),
    followers: j.followers ?? 0,
    following: j.following ?? 0,
    publicRepos: j.public_repos ?? 0,
    createdAt: created && !isNaN(created.getTime()) ? created : null,
  };
}

/** Blog URL with a scheme, or undefined. */
export function blogUrl(u: OwnerProfile): string | undefined {
  const b = u.blog?.trim();
  if (!b) return undefined;
  return b.startsWith('http') ? b : `https://${b}`;
}

// --------------------------------------------------------------- GraphQL
const LIVE_QUERY = `
query($login: String!) {
  user(login: $login) {
    login name avatarUrl url bio company location websiteUrl twitterUsername createdAt
    socialAccounts(first: 10) { nodes { provider url } }
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC, isFork: false, first: 40, orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      nodes {
        name description url isArchived isPrivate
        owner { avatarUrl }
        defaultBranchRef { name }
        repositoryTopics(first: 20) { nodes { topic { name } } }
        releases(first: 8, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            tagName name description isDraft isPrerelease publishedAt
            releaseAssets(first: 30) { nodes { name size downloadCount downloadUrl } }
          }
        }
        mpInfo: object(expression: "HEAD:.marketplace/app-info.yaml") { ... on Blob { text } }
        mpInfoYml: object(expression: "HEAD:.marketplace/app-info.yml") { ... on Blob { text } }
        mpIcon: object(expression: "HEAD:.marketplace/app-icon.png") { __typename }
        mpShots: object(expression: "HEAD:.marketplace/screenshots") {
          ... on Tree { entries { name type } }
        }
      }
    }
  }
}`;

interface Live {
  apps: AppEntry[];
  profile: OwnerProfile;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseGraphql(body: any): Live {
  const errors = body.errors as { type?: string }[] | undefined;
  if (errors?.some((e) => e.type === 'RATE_LIMITED')) throw new RateLimitError();
  const user = body.data?.user;
  if (!user) {
    throw new Error(`GitHub GraphQL: ${JSON.stringify(errors ?? 'user not found')}`);
  }
  const profile = toProfile({
    login: user.login,
    name: user.name,
    avatar_url: user.avatarUrl,
    html_url: user.url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.websiteUrl,
    twitter_username: user.twitterUsername,
    social_accounts: user.socialAccounts?.nodes,
    followers: user.followers?.totalCount,
    following: user.following?.totalCount,
    public_repos: user.repositories?.totalCount,
    created_at: user.createdAt,
  });

  const apps: AppEntry[] = [];
  for (const r of user.repositories.nodes as any[]) {
    if (r.isArchived || r.isPrivate || config.excludeRepos.has(r.name)) continue;
    const branch = r.defaultBranchRef?.name ?? 'main';
    const raw = (file: string) =>
      `https://raw.githubusercontent.com/${OWNER}/${r.name}/${branch}/.marketplace/${file}`;

    const releases: RawRelease[] = r.releases.nodes.map((rel: any) => ({
      tag_name: rel.tagName,
      name: rel.name,
      body: rel.description,
      draft: rel.isDraft,
      prerelease: rel.isPrerelease,
      published_at: rel.publishedAt,
      assets: rel.releaseAssets.nodes.map((a: any) => ({
        name: a.name,
        browser_download_url: a.downloadUrl,
        size: a.size,
        download_count: a.downloadCount,
      })),
    }));

    const infoText = r.mpInfo?.text ?? r.mpInfoYml?.text;
    const info = typeof infoText === 'string' ? parseAppInfo(infoText) : null;
    const entries = r.mpShots?.entries as { name: string; type: string }[] | undefined;
    const shots = entries
      ? pickScreenshots(
          entries
            .filter((e) => e.type === 'blob')
            .map((e) => ({
              type: 'file',
              name: e.name,
              download_url: raw(`screenshots/${e.name}`),
            })),
        )
      : [];
    const icon = r.mpIcon ? raw('app-icon.png') : null;
    const marketplace =
      !info && !icon && shots.length === 0 ? null : { info, icon, screenshots: shots };

    const app = buildApp(
      {
        name: r.name,
        description: r.description,
        html_url: r.url,
        topics: r.repositoryTopics.nodes.map((t: any) => t.topic.name),
        owner: { avatar_url: r.owner.avatarUrl },
      },
      releases,
      marketplace,
    );
    if (app) apps.push(app);
  }
  return { apps: sortApps(apps), profile };
}

async function postGraphql(): Promise<Response> {
  return fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: LIVE_QUERY, variables: { login: OWNER } }),
  });
}

async function fetchLive(): Promise<Live> {
  let res = await postGraphql();
  for (let i = 0; i < 2 && res.status >= 500; i++) {
    await new Promise((r) => setTimeout(r, 1000 * (1 + i)));
    res = await postGraphql();
  }
  if (res.status === 401) throw new Error('GitHub token was rejected (401)');
  if (res.status === 403 || res.status === 429) throw new RateLimitError();
  if (!res.ok) throw new Error(`GitHub GraphQL error ${res.status}`);
  return parseGraphql(await res.json());
}

// ------------------------------------------------------------------ REST
function cacheGet(key: string): { value: unknown; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`);
    const ts = Number(localStorage.getItem(`cache_ts:${key}`) ?? 0);
    if (!raw) return null;
    return { value: JSON.parse(raw), fresh: Date.now() - ts < config.cacheTtlMs };
  } catch {
    return null;
  }
}
function cacheSet(key: string, text: string) {
  try {
    localStorage.setItem(`cache:${key}`, text);
    localStorage.setItem(`cache_ts:${key}`, String(Date.now()));
  } catch {
    /* storage full / blocked: caching is best-effort */
  }
}

async function getJson<T = any>(path: string): Promise<T> {
  const cached = cacheGet(path);
  if (cached?.fresh) return cached.value as T;
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(config.hasToken ? { Authorization: `Bearer ${config.githubToken}` } : {}),
      },
    });
    if (res.status === 403 || res.status === 429) {
      if (cached) return cached.value as T;
      throw new RateLimitError();
    }
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const text = await res.text();
    cacheSet(path, text);
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    if (cached) return cached.value as T; // stale fallback
    throw e;
  }
}

async function restMarketplace(repo: any): Promise<RawMarketplace | null> {
  const name = repo.name as string;
  const branch = repo.default_branch ?? 'main';
  const raw = (file: string) =>
    `https://raw.githubusercontent.com/${OWNER}/${name}/${branch}/.marketplace/${file}`;

  let info: RawInfo | null = null;
  for (const f of ['app-info.yaml', 'app-info.yml']) {
    try {
      const r = await fetch(raw(f));
      if (r.ok) {
        info = parseAppInfo(await r.text());
        if (info) break;
      }
    } catch {
      /* try the next file name */
    }
  }
  let icon: string | null = null;
  try {
    const h = await fetch(raw('app-icon.png'), { method: 'HEAD' });
    if (h.ok) icon = raw('app-icon.png');
  } catch {
    /* no icon */
  }
  let shots: string[] = [];
  if (info || icon) {
    try {
      const list = await getJson(`/repos/${OWNER}/${name}/contents/.marketplace/screenshots`);
      if (Array.isArray(list)) shots = pickScreenshots(list);
    } catch {
      /* no screenshots folder */
    }
  }
  if (!info && !icon && shots.length === 0) return null;
  return { info, icon, screenshots: shots };
}

async function loadRest(): Promise<AppEntry[]> {
  const repos = await getJson<any[]>(`/users/${OWNER}/repos?per_page=100&sort=pushed`);
  const candidates = repos.filter(
    (r) =>
      r.private !== true &&
      r.archived !== true &&
      r.fork !== true && // forks rarely ship your own releases
      !config.excludeRepos.has(r.name),
  );
  const results = await Promise.all(
    candidates.map(async (repo) => {
      try {
        const list = await getJson<RawRelease[]>(
          `/repos/${OWNER}/${repo.name}/releases?per_page=30`,
        );
        const app = buildApp(repo, list);
        if (!app) return null; // no installable release: not an app
        const mp = await restMarketplace(repo);
        return mp ? buildApp(repo, list, mp) : app;
      } catch (e) {
        if (e instanceof RateLimitError) throw e;
        return null;
      }
    }),
  );
  return sortApps(results.filter((a): a is AppEntry => a !== null));
}

// -------------------------------------------------------------- Supabase
async function sb(query: string): Promise<any[]> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${query}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function loadSupabase(): Promise<AppEntry[]> {
  const rows = await sb('apps?select=repo,releases,marketplace');
  const apps: AppEntry[] = [];
  for (const r of rows) {
    const mp = r.marketplace;
    let marketplace: RawMarketplace | null = null;
    if (mp) {
      const shots = pickScreenshots(
        ((mp.screenshots as any[]) ?? []).map((s) => ({
          type: 'file',
          name: s.name,
          download_url: s.download_url,
        })),
      );
      marketplace = {
        info: typeof mp.info_text === 'string' ? parseAppInfo(mp.info_text) : null,
        icon: mp.icon_url ?? null,
        screenshots: shots,
      };
    }
    const app = buildApp(r.repo, r.releases, marketplace);
    if (app) apps.push(app);
  }
  return sortApps(apps);
}

// ---------------------------------------------------------------- public
let liveCache: Promise<Live> | null = null;

/** Forget cached snapshots so the next load hits the network again. */
export function invalidate() {
  liveCache = null;
}

/** All installable apps, newest release first. */
export async function loadApps(): Promise<AppEntry[]> {
  if (config.hasSupabase) return loadSupabase();
  if (config.hasToken) {
    try {
      return (await (liveCache ??= fetchLive())).apps;
    } catch (e) {
      liveCache = null;
      if (e instanceof RateLimitError) throw e;
      // GraphQL timed out / 5xx: fall back to REST (still authenticated).
    }
  }
  return loadRest();
}

/** The owner's profile, or null if it can't be loaded (UI degrades). */
export async function loadProfile(): Promise<OwnerProfile | null> {
  if (config.hasSupabase) {
    try {
      const rows = await sb('owner_profile?select=data&limit=1');
      return rows.length ? toProfile(rows[0].data) : null;
    } catch {
      return null;
    }
  }
  if (config.hasToken) {
    try {
      return (await (liveCache ??= fetchLive())).profile;
    } catch {
      liveCache = null; // fall back to REST below
    }
  }
  try {
    const [user, socials] = await Promise.all([
      getJson(`/users/${OWNER}`),
      getJson(`/users/${OWNER}/social_accounts`).catch(() => []),
    ]);
    return toProfile({ ...user, social_accounts: socials });
  } catch {
    return null;
  }
}
