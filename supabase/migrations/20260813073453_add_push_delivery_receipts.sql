create table public.push_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox (id) on delete cascade,
  push_device_id uuid references public.push_devices (id) on delete set null,
  expo_ticket_id text,
  ticket_status text not null check (ticket_status in ('ok', 'error')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'delivered', 'failed', 'expired')),
  error_code text check (error_code is null or char_length(error_code) between 1 and 80),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (outbox_id, push_device_id),
  unique (expo_ticket_id),
  check (
    (ticket_status = 'ok' and expo_ticket_id is not null)
    or
    (ticket_status = 'error' and expo_ticket_id is null and delivery_status = 'failed')
  )
);

create index push_delivery_receipts_pending_idx
on public.push_delivery_receipts (created_at, expo_ticket_id)
where delivery_status = 'pending' and expo_ticket_id is not null;

alter table public.push_delivery_receipts enable row level security;
revoke all on public.push_delivery_receipts from public, anon, authenticated;
grant select, insert, update on public.push_delivery_receipts to service_role;

alter table public.notification_outbox
add column processing_started_at timestamptz;

create index notification_outbox_processing_retry_idx
on public.notification_outbox (processing_started_at)
where status = 'processing';

create or replace function public.register_my_push_device(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  device_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Unsupported platform'; end if;
  if char_length(trim(p_expo_push_token)) not between 20 and 300 then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.push_devices (
    user_id,
    expo_push_token,
    platform,
    device_name,
    enabled,
    last_registered_at
  )
  values (
    caller_id,
    trim(p_expo_push_token),
    p_platform,
    nullif(left(trim(p_device_name), 120), ''),
    true,
    now()
  )
  on conflict (expo_push_token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      device_name = excluded.device_name,
      enabled = true,
      last_registered_at = now()
  returning id into device_id;

  return device_id;
end;
$$;

revoke all on function public.register_my_push_device(text, text, text) from public, anon;
grant execute on function public.register_my_push_device(text, text, text) to authenticated;

create or replace function public.claim_notification_outbox(p_outbox_id uuid)
returns public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.notification_outbox;
begin
  update public.notification_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null,
      processing_started_at = now()
  where id = p_outbox_id
    and (
      status in ('pending', 'failed')
      or (status = 'processing' and processing_started_at < now() - interval '15 minutes')
    )
    and attempts < 5
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_notification_outbox(uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(uuid) to service_role;

create or replace function public.complete_push_receipts(p_results jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 1000 then
    raise exception 'Push receipt result must be an array of at most 1000 items';
  end if;

  with payload as (
    select
      trim(item->>'ticket_id') as ticket_id,
      case when item->>'status' = 'ok' then 'delivered' else 'failed' end as delivery_status,
      nullif(left(trim(item->>'error_code'), 80), '') as error_code
    from jsonb_array_elements(p_results) item
    where item->>'status' in ('ok', 'error')
  ),
  updated as (
    update public.push_delivery_receipts receipt
    set delivery_status = payload.delivery_status,
        error_code = payload.error_code,
        checked_at = now()
    from payload
    where receipt.expo_ticket_id = payload.ticket_id
      and receipt.delivery_status = 'pending'
    returning receipt.push_device_id, receipt.delivery_status, receipt.error_code
  ),
  disabled as (
    update public.push_devices device
    set enabled = false
    from updated
    where device.id = updated.push_device_id
      and updated.delivery_status = 'failed'
      and updated.error_code = 'DeviceNotRegistered'
    returning device.id
  )
  select jsonb_build_object(
    'updated', (select count(*) from updated),
    'disabled_devices', (select count(*) from disabled)
  ) into result;

  return coalesce(result, '{"updated":0,"disabled_devices":0}'::jsonb);
end;
$$;

revoke all on function public.complete_push_receipts(jsonb) from public, anon, authenticated;
grant execute on function public.complete_push_receipts(jsonb) to service_role;
