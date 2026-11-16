create extension if not exists pg_cron  with schema pg_catalog;
create extension if not exists pg_net   with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Secrets live only in Vault. The shared sync secret is generated in-database,
-- so it never has to be copied anywhere by hand.
select vault.create_secret('https://qbioildsooaleskxlkgd.supabase.co', 'project_url')
where not exists (select 1 from vault.secrets where name = 'project_url');

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sync_secret')
where not exists (select 1 from vault.secrets where name = 'sync_secret');

-- Used by the edge function (service role only) to authenticate cron calls.
create or replace function public.check_sync_secret(candidate text) returns boolean
language sql security definer set search_path = '' as $$
  select coalesce(candidate = (select decrypted_secret from vault.decrypted_secrets
                               where name = 'sync_secret'), false);
$$;
revoke all on function public.check_sync_secret(text) from public, anon, authenticated;
grant execute on function public.check_sync_secret(text) to service_role;

create or replace function public.trigger_github_sync() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/sync-github',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.trigger_github_sync() from public, anon, authenticated;

select cron.unschedule('sync-github') where exists (select 1 from cron.job where jobname = 'sync-github');
select cron.schedule('sync-github', '*/15 * * * *', $$ select public.trigger_github_sync(); $$);

-- Keep the run log small.
select cron.unschedule('prune-sync-runs') where exists (select 1 from cron.job where jobname = 'prune-sync-runs');
select cron.schedule('prune-sync-runs', '0 3 * * *',
  $$ delete from public.sync_runs where started_at < now() - interval '14 days' $$);
