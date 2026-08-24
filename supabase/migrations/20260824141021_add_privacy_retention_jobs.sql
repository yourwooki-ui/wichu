-- Make the public privacy policy's retention promises enforceable in the
-- database. pg_cron jobs run as postgres and never expose cleanup functions to
-- the Data API.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'wichu-privacy-retention-daily',
  '23 3 * * *',
  $job$
    delete from private.profile_locations
    where updated_at < now() - interval '30 days';

    delete from private.account_deletion_audit
    where completed_at < now() - interval '1 year';

    delete from public.notification_outbox
    where status in ('sent', 'failed', 'skipped')
      and coalesce(sent_at, created_at) < now() - interval '30 days';
  $job$
);

select cron.schedule(
  'wichu-cron-log-retention-weekly',
  '41 4 * * 0',
  $job$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days';
  $job$
);

comment on table private.profile_locations is
  'Exact coarse coordinates; overwritten on refresh, removed after 30 days stale or profile deletion.';

comment on table private.account_deletion_audit is
  'Pseudonymous deletion proof retained for one year, then removed by pg_cron.';
