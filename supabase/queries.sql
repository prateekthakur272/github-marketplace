-- Handy queries for the GitHub sync. Run each statement on its own in the
-- Supabase SQL editor.

-- 1. Trigger a sync now (returns a request id; the run takes ~20-40s).
select public.trigger_github_sync();

-- 2. Recent sync runs. ok is null while a run is still in progress.
select id, started_at, finished_at - started_at as took, ok, apps_synced, error
from public.sync_runs
order by id desc
limit 10;

-- 3. What the edge function returned to the last cron/manual calls.
select id, status_code, content, error_msg, created
from net._http_response
order by id desc
limit 5;

-- 4. Cron jobs and the status of their last run.
select j.jobname, j.schedule, j.active, d.status, d.start_time, d.return_message
from cron.job j
left join lateral (
  select * from cron.job_run_details
  where jobid = j.jobid order by start_time desc limit 1
) d on true;

-- 5. Apps currently synced (only repos with a published release).
select name, jsonb_array_length(releases) as releases, pushed_at, updated_at
from public.apps
order by name;

-- 6. Detailed owner profile (without the long bio/avatar fields).
select login, data - 'bio' - 'avatar_url' as profile, updated_at
from public.owner_profile;

-- 7. Edge function logs (errors that never reach sync_runs, e.g. profile
--    details failures). Works in Dashboard -> Logs Explorer / the MCP
--    query_logs tool, not the plain SQL editor.
-- select timestamp, event_message from logs
-- where source = 'function_logs'
-- order by timestamp desc limit 10;

-- 8. Change the schedule (default: every 15 minutes).
-- select cron.alter_job(
--   (select jobid from cron.job where jobname = 'sync-github'),
--   schedule := '*/30 * * * *');

-- 9. Pause / resume the sync cron.
-- select cron.alter_job((select jobid from cron.job where jobname = 'sync-github'), active := false);
-- select cron.alter_job((select jobid from cron.job where jobname = 'sync-github'), active := true);
