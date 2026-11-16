-- Data synced from GitHub by the sync-github edge function.
create table if not exists public.owner_profile (
  login      text primary key,
  data       jsonb not null,          -- GitHub REST-shaped user object
  updated_at timestamptz not null default now()
);

create table if not exists public.apps (
  name        text primary key,
  repo        jsonb not null,         -- {name, description, html_url, topics, owner:{avatar_url}}
  releases    jsonb not null,         -- GitHub REST-shaped releases (with assets)
  marketplace jsonb,                  -- {info_text, icon_url, screenshots:[{name,download_url}]}
  pushed_at   timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  apps_synced int,
  error       text
);

alter table public.owner_profile enable row level security;
alter table public.apps          enable row level security;
alter table public.sync_runs     enable row level security;

-- Public read-only for the web app (anon key). Writes only via service role.
create policy "public read profile" on public.owner_profile for select using (true);
create policy "public read apps"    on public.apps          for select using (true);
