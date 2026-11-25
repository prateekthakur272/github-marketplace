// Syncs the owner's GitHub profile and releases into Supabase.
//
//   cron -> trigger_github_sync() -> this function -> GitHub GraphQL -> owner_profile + apps
//
// Secrets: GITHUB_TOKEN, GITHUB_OWNER (optional). Cron calls are authenticated against the
// Vault `sync_secret` via the check_sync_secret() RPC. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Safety rules: a failing repo never aborts the run, a failed profile-details fetch keeps the
// previously synced details, and stale apps are only removed after a full, non-empty fetch.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parse as parseYaml } from "npm:yaml@2";

const OWNER = Deno.env.get("GITHUB_OWNER") ?? "prateekthakur272";
const EXCLUDE = new Set<string>([]);
const OS_NAMES = ["android", "macos", "windows", "linux"];
const REPO_PAGE_SIZE = 20;
const MAX_REPO_PAGES = 10;
const MAX_PROFILE_PAGES = 5;
const UPSERT_CHUNK = 50;

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

// ------------------------------------------------------------------ GitHub client

const REPOS_QUERY = `
query($login: String!, $after: String, $first: Int!) {
  user(login: $login) {
    login name avatarUrl url bio company location websiteUrl twitterUsername createdAt
    socialAccounts(first: 10) { nodes { provider url } }
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC, isFork: false, first: $first, after: $after,
                 orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name description url isArchived isPrivate pushedAt
        owner { avatarUrl }
        defaultBranchRef { name }
        repositoryTopics(first: 20) { nodes { topic { name } } }
        primaryLanguage { name }
        releases(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) {
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

// Extra profile details, kept apart so the repo query stays small.
const PROFILE_QUERY = `
query($login: String!, $after: String, $first: Int!) {
  user(login: $login) {
    pronouns isHireable updatedAt
    status { emoji message }
    socialAccounts(first: 10) { nodes { provider displayName url } }
    organizations(first: 20) { nodes { login name avatarUrl url } }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { name description url stargazerCount primaryLanguage { name color } } }
    }
    starredRepositories { totalCount }
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions totalPullRequestContributions
      totalIssueContributions totalPullRequestReviewContributions
    }
    repositories(privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        stargazerCount forkCount
        languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One GraphQL call with retries for 5xx, rate limiting (429/403 + retry-after) and network errors. */
async function gql(token: string, query: string, variables: Json): Promise<Json> {
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "marketplace-sync",
        },
        body: JSON.stringify({ query, variables: { login: OWNER, ...variables } }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.errors && !body.data?.user) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
        return body.data.user;
      }
      lastErr = `GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`;
      const retryAfter = Number(res.headers.get("retry-after"));
      const retryable = res.status >= 500 || res.status === 429 || (res.status === 403 && retryAfter > 0);
      if (!retryable) break;
      await sleep(Math.min(10_000, retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt));
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("GraphQL:")) throw e; // not transient
      lastErr = e instanceof Error ? e.message : String(e);
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(lastErr || "GitHub request failed");
}

/** Walks `user.repositories` page by page. Returns the first page's user plus every repo node. */
async function fetchAllRepos(token: string, query: string, pageSize: number, maxPages: number) {
  let first: Json | null = null;
  const nodes: Json[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const user = await gql(token, query, { after, first: pageSize });
    first ??= user;
    nodes.push(...user.repositories.nodes);
    if (!user.repositories.pageInfo.hasNextPage) break;
    after = user.repositories.pageInfo.endCursor;
  }
  return { user: first as Json, nodes };
}

// ------------------------------------------------------------------ transforms

/** Parses app-info.yaml into a plain object (null when missing/invalid). Mirrors src/lib/info.ts. */
function parseInfo(text: string | null): Json | null {
  if (!text) return null;
  try {
    const doc = parseYaml(text);
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    const info: Json = { ...doc };
    if (Object.keys(info).length === 0) return null;
    const list = (v: unknown) =>
      (v === null || v === undefined ? [] : Array.isArray(v) ? v : String(v).split(","))
        .map((e) => String(e).trim())
        .filter(Boolean);
    info.supported_os = list(info.supported_os).map((o) => o.toLowerCase()).filter((o) => OS_NAMES.includes(o));
    info.tags = list(info.tags);
    return info;
  } catch (e) {
    console.error("app-info parse failed", e);
    return null;
  }
}

/** True when the repo has at least one published (non-draft) release. */
const hasPublishedRelease = (r: Json) =>
  r.releases.nodes.some((rel: Json) => !rel.isDraft && rel.publishedAt);

/** One `apps` table row. Shape: see the column comments in the migrations. */
function toAppRow(r: Json) {
  const branch = r.defaultBranchRef?.name ?? "main";
  const raw = (f: string) =>
    `https://raw.githubusercontent.com/${OWNER}/${r.name}/${branch}/.marketplace/${f}`;
  const releases = r.releases.nodes.map((rel: Json) => ({
    tag_name: rel.tagName,
    name: rel.name,
    body: rel.description,
    draft: rel.isDraft,
    prerelease: rel.isPrerelease,
    published_at: rel.publishedAt,
    assets: rel.releaseAssets.nodes.map((a: Json) => ({
      name: a.name,
      browser_download_url: a.downloadUrl,
      size: a.size,
      download_count: a.downloadCount,
    })),
  }));
  const info = parseInfo(r.mpInfo?.text ?? r.mpInfoYml?.text ?? null);
  const screenshots = (r.mpShots?.entries ?? [])
    .filter((e: Json) => e.type === "blob")
    .map((e: Json) => ({ name: e.name, download_url: raw(`screenshots/${e.name}`) }));
  const icon_url = r.mpIcon ? raw("app-icon.png") : null;
  return {
    name: r.name as string,
    repo: {
      name: r.name,
      description: r.description,
      html_url: r.url,
      topics: r.repositoryTopics.nodes.map((t: Json) => t.topic.name),
      language: r.primaryLanguage?.name ?? null,
      owner: { avatar_url: r.owner.avatarUrl },
      default_branch: branch,
    },
    releases,
    marketplace: info || icon_url || screenshots.length ? { info, icon_url, screenshots } : null,
    pushed_at: r.pushedAt,
    updated_at: new Date().toISOString(),
  };
}

/** Aggregated profile details: pinned repos, stats, organisations and top languages by code size. */
async function fetchProfileDetails(token: string): Promise<Json> {
  const { user, nodes } = await fetchAllRepos(token, PROFILE_QUERY, 100, MAX_PROFILE_PAGES);
  let stars = 0;
  let forks = 0;
  const langs = new Map<string, { size: number; color: string | null }>();
  for (const r of nodes) {
    stars += r.stargazerCount;
    forks += r.forkCount;
    for (const e of r.languages.edges) {
      const cur = langs.get(e.node.name) ?? { size: 0, color: e.node.color };
      cur.size += e.size;
      langs.set(e.node.name, cur);
    }
  }
  const totalBytes = [...langs.values()].reduce((a, b) => a + b.size, 0) || 1;
  const cc = user.contributionsCollection;
  return {
    pronouns: user.pronouns,
    is_hireable: user.isHireable,
    status: user.status,
    social_accounts: user.socialAccounts.nodes,
    organizations: user.organizations.nodes,
    pinned: user.pinnedItems.nodes.map((p: Json) => ({
      name: p.name,
      description: p.description,
      html_url: p.url,
      stars: p.stargazerCount,
      language: p.primaryLanguage,
    })),
    stats: {
      total_stars: stars,
      total_forks: forks,
      starred: user.starredRepositories.totalCount,
      contributions_last_year: cc.contributionCalendar.totalContributions,
      commits_last_year: cc.totalCommitContributions,
      pull_requests_last_year: cc.totalPullRequestContributions,
      issues_last_year: cc.totalIssueContributions,
      reviews_last_year: cc.totalPullRequestReviewContributions,
    },
    top_languages: [...langs.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 8)
      .map(([name, v]) => ({ name, color: v.color, percent: Math.round((v.size / totalBytes) * 1000) / 10 })),
    github_updated_at: user.updatedAt,
  };
}

/**
 * The `owner_profile.data` blob. Layers, lowest to highest priority:
 * previously stored data (kept if details failed this run) < fresh details < basic profile fields.
 * `social_accounts` prefers the detailed list (it has displayName).
 */
function toProfileData(user: Json, details: Json | null, previous: Json | null): Json {
  return {
    ...(previous ?? {}),
    ...(details ?? {}),
    login: user.login,
    name: user.name,
    avatar_url: user.avatarUrl,
    html_url: user.url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.websiteUrl,
    twitter_username: user.twitterUsername,
    social_accounts: details?.social_accounts ?? user.socialAccounts?.nodes ?? previous?.social_accounts ?? [],
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    public_repos: user.repositories.totalCount,
    created_at: user.createdAt,
  };
}

// ------------------------------------------------------------------ handler

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: authorised } = await db.rpc("check_sync_secret", {
    candidate: req.headers.get("x-sync-secret") ?? "",
  });
  if (authorised !== true) return new Response("unauthorized", { status: 401 });

  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return new Response("GITHUB_TOKEN not set", { status: 500 });

  const { data: run } = await db.from("sync_runs").insert({}).select("id").single();
  const finishRun = async (fields: Json) => {
    if (!run) return;
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", run.id);
  };

  try {
    // Repos and profile details are independent: fetch them together. Details are best-effort.
    const [repos, details] = await Promise.all([
      fetchAllRepos(token, REPOS_QUERY, REPO_PAGE_SIZE, MAX_REPO_PAGES),
      fetchProfileDetails(token).catch((e) => {
        console.error("profile details failed, keeping previous", e);
        return null;
      }),
    ]);

    // One broken repo must not take the whole sync down.
    const rows: ReturnType<typeof toAppRow>[] = [];
    const failed: string[] = [];
    for (const r of repos.nodes) {
      if (r.isArchived || r.isPrivate || EXCLUDE.has(r.name) || !hasPublishedRelease(r)) continue;
      try {
        rows.push(toAppRow(r));
      } catch (e) {
        failed.push(r.name);
        console.error(`repo ${r.name} skipped`, e);
      }
    }

    // Profile (merged over what is already stored).
    const { data: prev } = await db.from("owner_profile").select("data").eq("login", repos.user.login).maybeSingle();
    const { error: pe } = await db.from("owner_profile").upsert({
      login: repos.user.login,
      data: toProfileData(repos.user, details, prev?.data ?? null),
      updated_at: new Date().toISOString(),
    });
    if (pe) throw pe;

    // Apps, in chunks.
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await db.from("apps").upsert(rows.slice(i, i + UPSERT_CHUNK));
      if (error) throw error;
    }

    // Remove apps that are gone/archived/private. Never prune from an empty or partly failed result.
    let removed = 0;
    if (rows.length > 0 && failed.length === 0) {
      const keep = new Set(rows.map((r) => r.name));
      const { data: existing, error: ee } = await db.from("apps").select("name");
      if (ee) throw ee;
      const stale = (existing ?? []).map((a: Json) => a.name as string).filter((n) => !keep.has(n));
      if (stale.length) {
        const { error: de } = await db.from("apps").delete().in("name", stale);
        if (de) throw de;
        removed = stale.length;
      }
    }

    await finishRun({ ok: true, apps_synced: rows.length });
    return Response.json({
      ok: true,
      synced: rows.length,
      removed,
      failed,
      profile_details: details !== null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    await finishRun({ ok: false, error: msg });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
});
