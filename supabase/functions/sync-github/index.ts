// Queries GitHub (GraphQL) and upserts the results into Supabase tables.
// Secrets: GITHUB_TOKEN, GITHUB_OWNER (optional). Cron calls are authenticated
// against the Vault `sync_secret` via the check_sync_secret() RPC.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER = Deno.env.get("GITHUB_OWNER") ?? "prateekthakur272";
const EXCLUDE = new Set<string>([]);

const QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    login name avatarUrl url bio company location websiteUrl twitterUsername createdAt
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC, isFork: false, first: 20, after: $after,
                 orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name description url isArchived isPrivate pushedAt
        owner { avatarUrl }
        defaultBranchRef { name }
        repositoryTopics(first: 20) { nodes { topic { name } } }
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

// Extra profile details (kept separate so the repo query stays small).
const PROFILE_QUERY = `
query($login: String!, $after: String) {
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
    repositories(privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER, first: 100, after: $after) {
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

// deno-lint-ignore no-explicit-any
async function fetchProfileDetails(token: string): Promise<Record<string, any>> {
  // deno-lint-ignore no-explicit-any
  let first: any = null;
  let stars = 0, forks = 0;
  const langBytes = new Map<string, { size: number; color: string | null }>();
  let after: string | null = null;
  for (let page = 0; page < 5; page++) {
    const user = await gql(token, after, PROFILE_QUERY);
    first ??= user;
    for (const r of user.repositories.nodes) {
      stars += r.stargazerCount;
      forks += r.forkCount;
      for (const e of r.languages.edges) {
        const cur = langBytes.get(e.node.name) ?? { size: 0, color: e.node.color };
        cur.size += e.size;
        langBytes.set(e.node.name, cur);
      }
    }
    if (!user.repositories.pageInfo.hasNextPage) break;
    after = user.repositories.pageInfo.endCursor;
  }
  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b.size, 0) || 1;
  const topLanguages = [...langBytes.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 8)
    .map(([name, v]) => ({
      name,
      color: v.color,
      percent: Math.round((v.size / totalBytes) * 1000) / 10,
    }));
  const cc = first.contributionsCollection;
  return {
    pronouns: first.pronouns,
    is_hireable: first.isHireable,
    status: first.status,
    social_accounts: first.socialAccounts.nodes,
    organizations: first.organizations.nodes,
    // deno-lint-ignore no-explicit-any
    pinned: first.pinnedItems.nodes.map((p: any) => ({
      name: p.name,
      description: p.description,
      html_url: p.url,
      stars: p.stargazerCount,
      language: p.primaryLanguage,
    })),
    stats: {
      total_stars: stars,
      total_forks: forks,
      starred: first.starredRepositories.totalCount,
      contributions_last_year: cc.contributionCalendar.totalContributions,
      commits_last_year: cc.totalCommitContributions,
      pull_requests_last_year: cc.totalPullRequestContributions,
      issues_last_year: cc.totalIssueContributions,
      reviews_last_year: cc.totalPullRequestReviewContributions,
    },
    top_languages: topLanguages,
    github_updated_at: first.updatedAt,
  };
}

async function gql(token: string, after: string | null, query = QUERY) {
  let lastErr = "";
  for (let i = 0; i < 3; i++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "marketplace-sync",
      },
      body: JSON.stringify({ query, variables: { login: OWNER, after } }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.errors && !body.data?.user) {
        throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
      }
      return body.data.user;
    }
    lastErr = `GitHub ${res.status}: ${await res.text()}`;
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error(lastErr);
}

// deno-lint-ignore no-explicit-any
function toRows(r: any) {
  const branch = r.defaultBranchRef?.name ?? "main";
  const raw = (f: string) =>
    `https://raw.githubusercontent.com/${OWNER}/${r.name}/${branch}/.marketplace/${f}`;
  // deno-lint-ignore no-explicit-any
  const releases = r.releases.nodes.map((rel: any) => ({
    tag_name: rel.tagName,
    name: rel.name,
    body: rel.description,
    draft: rel.isDraft,
    prerelease: rel.isPrerelease,
    published_at: rel.publishedAt,
    // deno-lint-ignore no-explicit-any
    assets: rel.releaseAssets.nodes.map((a: any) => ({
      name: a.name,
      browser_download_url: a.downloadUrl,
      size: a.size,
      download_count: a.downloadCount,
    })),
  }));
  const infoText = r.mpInfo?.text ?? r.mpInfoYml?.text ?? null;
  const shots = (r.mpShots?.entries ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((e: any) => e.type === "blob")
    // deno-lint-ignore no-explicit-any
    .map((e: any) => ({ name: e.name, download_url: raw(`screenshots/${e.name}`) }));
  const icon = r.mpIcon ? raw("app-icon.png") : null;
  const marketplace = infoText || icon || shots.length
    ? { info_text: infoText, icon_url: icon, screenshots: shots }
    : null;
  return {
    name: r.name,
    repo: {
      name: r.name,
      description: r.description,
      html_url: r.url,
      // deno-lint-ignore no-explicit-any
      topics: r.repositoryTopics.nodes.map((t: any) => t.topic.name),
      owner: { avatar_url: r.owner.avatarUrl },
      default_branch: branch,
    },
    releases,
    marketplace,
    pushed_at: r.pushedAt,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: ok } = await db.rpc("check_sync_secret", {
    candidate: req.headers.get("x-sync-secret") ?? "",
  });
  if (ok !== true) return new Response("unauthorized", { status: 401 });

  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return new Response("GITHUB_TOKEN not set", { status: 500 });
  const { data: run } = await db.from("sync_runs").insert({}).select("id").single();

  try {
    // deno-lint-ignore no-explicit-any
    const rows: any[] = [];
    // deno-lint-ignore no-explicit-any
    let profile: any = null;
    let after: string | null = null;
    for (let page = 0; page < 10; page++) {
      const user = await gql(token, after);
      profile ??= user;
      for (const r of user.repositories.nodes) {
        if (r.isArchived || r.isPrivate || EXCLUDE.has(r.name)) continue;
        // Only repos with at least one published (non-draft) release.
        // deno-lint-ignore no-explicit-any
        if (!r.releases.nodes.some((rel: any) => !rel.isDraft && rel.publishedAt)) continue;
        rows.push(toRows(r));
      }
      if (!user.repositories.pageInfo.hasNextPage) break;
      after = user.repositories.pageInfo.endCursor;
    }

    // Detailed profile is best-effort: a failure here must not block the app sync.
    // deno-lint-ignore no-explicit-any
    let details: Record<string, any> = {};
    try {
      details = await fetchProfileDetails(token);
    } catch (e) {
      console.error("profile details failed", e);
    }

    const { error: pe } = await db.from("owner_profile").upsert({
      login: profile.login,
      data: {
        ...details,
        login: profile.login,
        name: profile.name,
        avatar_url: profile.avatarUrl,
        html_url: profile.url,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        blog: profile.websiteUrl,
        twitter_username: profile.twitterUsername,
        followers: profile.followers.totalCount,
        following: profile.following.totalCount,
        public_repos: profile.repositories.totalCount,
        created_at: profile.createdAt,
      },
      updated_at: new Date().toISOString(),
    });
    if (pe) throw pe;

    if (rows.length) {
      const { error } = await db.from("apps").upsert(rows);
      if (error) throw error;
    }
    // Remove repos that are gone/archived/private now.
    const keep = rows.map((r) => r.name);
    const del = db.from("apps").delete();
    const { error: de } = keep.length
      ? await del.not("name", "in", `(${keep.map((n) => `"${n}"`).join(",")})`)
      : await del.neq("name", "");
    if (de) throw de;

    await db.from("sync_runs").update({
      finished_at: new Date().toISOString(), ok: true, apps_synced: rows.length,
    }).eq("id", run!.id);
    return Response.json({ ok: true, synced: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    await db.from("sync_runs").update({
      finished_at: new Date().toISOString(), ok: false, error: msg,
    }).eq("id", run!.id);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
});
