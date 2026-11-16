# Marketplace

A Next.js store for your GitHub release builds (Android, macOS, Windows, Linux). It is a **static export**, so it can be
hosted on GitHub Pages; all data is fetched live in the browser.
Apps describe themselves with a `.marketplace/` folder (see `sample/`).

## Run

```sh
cp .env.example .env.local   # then edit
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (classifier, versions, parsing, GraphQL)
npm run build                # static site in ./out
```

## Data sources (first match wins)

1. **Supabase** when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
   (reads the `apps` / `owner_profile` tables kept by `supabase/functions/sync-github`).
2. **GitHub GraphQL** when `NEXT_PUBLIC_GITHUB_TOKEN` is set: one request for everything.
3. **GitHub REST** otherwise (60 requests/hour per visitor).

Everything in `NEXT_PUBLIC_*` ships inside the site, so use a fine-grained token
with read access to public repositories only.

## Routes

| URL | Page |
| --- | --- |
| `/` | Landing: stats, charts, top apps, latest releases, developer portfolio |
| `/?platform=macos&sort=downloads&q=…&category=…&page=2` | Catalog |
| `/?view=releases` and `/?view=platforms` | Release list / platform overview |
| `/app/<repo>?tab=versions&platform=linux&pre=1` | App detail |

App URLs are clean (`/app/OpenRest`). The app list is live
data, so unknown paths cannot be pre-generated: GitHub Pages serves `404.html`
(the app shell) for them and a small client-side router (`src/lib/router.tsx`)
renders the right screen. In-app navigation uses the History API, no reloads.

## Layout

Phone (<600px): header + floating bottom bar + drawer. Tablet (600-859px): slim
rail + header. Desktop (>=860px): sidebar; at >=1180px the profile/activity rail
is docked on the right.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` runs when you push a tag like `v1.2.0` (or from the
Actions tab): it installs, tests, builds with `NEXT_PUBLIC_BASE_PATH=/<repo>` and
publishes `out/`. In the repo settings:

1. **Pages → Source:** GitHub Actions.
2. **Environments → github-pages:** allow the `v*` tag pattern.
3. **Secrets → Actions** (all optional): `MARKETPLACE_TOKEN` (read-only token for
   public repos), `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

The version in the sidebar footer is the tag (`NEXT_PUBLIC_APP_VERSION`).

## Supabase

`supabase/` holds the migrations and the `sync-github` edge function that keep
the `apps` / `owner_profile` tables up to date.
