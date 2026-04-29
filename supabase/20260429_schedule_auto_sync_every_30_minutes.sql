-- Schedule the auto-sync Edge Function to run every 30 minutes.
--
-- Before running:
-- 1. Deploy the Edge Function:
--    supabase functions deploy auto-sync
-- 2. Replace the placeholders below:
--    <PROJECT_REF> with your Supabase project ref
--    <SUPABASE_ANON_KEY> with your project's anon/public key
--    <AUTO_SYNC_SECRET> with the same secret if you set one for the Edge Function,
--    or leave x-sync-secret empty if you do not use AUTO_SYNC_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'autorank-auto-sync-every-30-minutes';

select cron.schedule(
  'autorank-auto-sync-every-30-minutes',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'x-sync-secret', '<AUTO_SYNC_SECRET>'
    ),
    body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
  );
  $$
);
