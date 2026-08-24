-- Provider events are private and idempotent. Clients keep read-only access to
-- the resulting public.subscriptions row and can never grant themselves access.

create table private.monetization_provider_events (
  provider text not null,
  event_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id),
  check (provider in ('revenuecat')),
  check (length(event_id) between 8 and 200),
  check (length(event_type) between 3 and 80)
);

create table private.subscription_provider_state (
  provider text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  platform text not null,
  last_event_at timestamptz not null,
  last_event_id text not null,
  updated_at timestamptz not null default now(),
  primary key (provider, user_id, product_id, platform),
  check (provider in ('revenuecat')),
  check (product_id in ('wichu_ad_free', 'wichu_gold_monthly')),
  check (platform in ('ios', 'android'))
);

alter table private.monetization_provider_events enable row level security;
alter table private.subscription_provider_state enable row level security;

revoke all on private.monetization_provider_events from public, anon, authenticated;
revoke all on private.subscription_provider_state from public, anon, authenticated;

create function public.process_revenuecat_subscription_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_product_id text,
  p_platform text,
  p_status text,
  p_current_period_end timestamptz,
  p_provider_reference text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_event text;
  v_last_event_at timestamptz;
begin
  if p_event_id is null or length(p_event_id) not between 8 and 200
     or p_event_type is null or length(p_event_type) not between 3 and 80
     or p_user_id is null
     or p_product_id not in ('wichu_ad_free', 'wichu_gold_monthly')
     or p_platform not in ('ios', 'android')
     or p_status not in ('inactive', 'active', 'expired', 'cancelled')
     or p_occurred_at is null then
    raise exception 'Invalid subscription provider event' using errcode = '22023';
  end if;

  insert into private.monetization_provider_events (
    provider,
    event_id,
    user_id,
    event_type,
    occurred_at
  )
  values ('revenuecat', p_event_id, p_user_id, p_event_type, p_occurred_at)
  on conflict (provider, event_id) do nothing
  returning event_id into v_inserted_event;

  if v_inserted_event is null then
    return false;
  end if;

  select state.last_event_at into v_last_event_at
  from private.subscription_provider_state state
  where state.provider = 'revenuecat'
    and state.user_id = p_user_id
    and state.product_id = p_product_id
    and state.platform = p_platform
  for update;

  -- RevenueCat retries and webhook delivery can be out of order. Record stale
  -- events for idempotency but never let them overwrite newer entitlement state.
  if v_last_event_at is not null and p_occurred_at < v_last_event_at then
    return true;
  end if;

  insert into public.subscriptions (
    user_id,
    product_id,
    platform,
    status,
    current_period_end,
    provider_reference
  )
  values (
    p_user_id,
    p_product_id,
    p_platform,
    p_status::public.subscription_status,
    p_current_period_end,
    nullif(left(p_provider_reference, 200), '')
  )
  on conflict (user_id, product_id, platform) do update set
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    provider_reference = excluded.provider_reference,
    updated_at = now();

  insert into private.subscription_provider_state (
    provider,
    user_id,
    product_id,
    platform,
    last_event_at,
    last_event_id
  )
  values ('revenuecat', p_user_id, p_product_id, p_platform, p_occurred_at, p_event_id)
  on conflict (provider, user_id, product_id, platform) do update set
    last_event_at = excluded.last_event_at,
    last_event_id = excluded.last_event_id,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.process_revenuecat_subscription_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_subscription_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text,
  timestamptz
) to service_role;
