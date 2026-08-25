-- Keep first-party product analytics bounded to the documented 90-day window.
-- pg_cron executes inside Postgres; no cleanup capability is exposed to clients.
select cron.schedule(
  'wichu-product-event-retention-daily',
  '17 4 * * *',
  $job$
    select private.purge_expired_product_events();
  $job$
);
