-- Keep the sync run log small: every night, delete runs older than 3 days.
-- Replaces the "older than 14 days" prune from the cron migration.
create or replace function public.prune_sync_runs(keep interval default interval '3 days') returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  removed bigint;
begin
  delete from public.sync_runs where started_at < now() - keep;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.prune_sync_runs(interval) from public, anon, authenticated;

select cron.unschedule('prune-sync-runs') where exists (select 1 from cron.job where jobname = 'prune-sync-runs');
select cron.schedule('prune-sync-runs', '0 3 * * *', $$ select public.prune_sync_runs(interval '3 days'); $$);
