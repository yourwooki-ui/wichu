-- Gold members can undo consecutive unmatched swipes without a credit limit.
-- Other members spend one server-issued rewarded-ad credit per undo.

create table private.undo_credit_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

create table private.rewarded_undo_events (
  provider_event_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  credited_at timestamptz not null default now(),
  check (length(provider_event_id) between 8 and 200)
);

create index rewarded_undo_events_user_recent_idx
on private.rewarded_undo_events (user_id, credited_at desc);

alter table private.undo_credit_accounts enable row level security;
alter table private.rewarded_undo_events enable row level security;

revoke all on private.undo_credit_accounts from public, anon, authenticated;
revoke all on private.rewarded_undo_events from public, anon, authenticated;

create function public.get_my_undo_entitlement()
returns table (unlimited boolean, credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_active_gold((select auth.uid())) as unlimited,
    case
      when private.has_active_gold((select auth.uid())) then 0
      else coalesce((
        select account.credits
        from private.undo_credit_accounts account
        where account.user_id = (select auth.uid())
      ), 0)
    end as credits
  where (select auth.uid()) is not null;
$$;

create function public.grant_rewarded_undo_credit(
  p_user_id uuid,
  p_provider_event_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_event text;
  v_credits integer;
begin
  if p_user_id is null
     or p_provider_event_id is null
     or length(p_provider_event_id) not between 8 and 200 then
    raise exception 'Invalid rewarded undo event' using errcode = '22023';
  end if;

  insert into private.rewarded_undo_events (provider_event_id, user_id)
  values (p_provider_event_id, p_user_id)
  on conflict (provider_event_id) do nothing
  returning provider_event_id into v_inserted_event;

  if v_inserted_event is not null then
    insert into private.undo_credit_accounts (user_id, credits)
    values (p_user_id, 1)
    on conflict (user_id) do update set
      credits = private.undo_credit_accounts.credits + 1,
      updated_at = now();
  end if;

  select account.credits into v_credits
  from private.undo_credit_accounts account
  where account.user_id = p_user_id;

  return coalesce(v_credits, 0);
end;
$$;

drop function public.undo_my_swipe(uuid);

create function public.undo_my_swipe(p_target_id uuid)
returns table (undone boolean, unlimited boolean, credits_remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_latest_swipe public.swipes;
  v_unlimited boolean;
  v_credits_remaining integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('undo:' || v_user_id::text, 0)
  );

  select s.* into v_latest_swipe
  from public.swipes s
  where s.swiper_id = v_user_id
  order by s.created_at desc, s.id desc
  limit 1;

  if v_latest_swipe.id is null or v_latest_swipe.target_id <> p_target_id then
    raise exception 'Only the most recent swipe can be undone' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.matches m
    where m.user_a = least(v_user_id, p_target_id)
      and m.user_b = greatest(v_user_id, p_target_id)
      and m.status = 'active'
  ) then
    raise exception 'Matched swipes cannot be undone' using errcode = 'P0001';
  end if;

  v_unlimited := private.has_active_gold(v_user_id);

  if not v_unlimited then
    insert into private.undo_credit_accounts (user_id, credits)
    values (v_user_id, 0)
    on conflict (user_id) do nothing;

    update private.undo_credit_accounts account
    set credits = account.credits - 1,
        updated_at = now()
    where account.user_id = v_user_id
      and account.credits > 0
    returning account.credits into v_credits_remaining;

    if not found then
      raise exception 'Rewarded undo credit required' using errcode = 'P0001';
    end if;
  end if;

  delete from public.swipes s
  where s.id = v_latest_swipe.id;

  if not found then
    raise exception 'The swipe is no longer available to undo' using errcode = 'P0001';
  end if;

  return query select true, v_unlimited, v_credits_remaining;
end;
$$;

revoke all on function public.get_my_undo_entitlement() from public, anon;
revoke all on function public.grant_rewarded_undo_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.undo_my_swipe(uuid) from public, anon;

grant execute on function public.get_my_undo_entitlement() to authenticated;
grant execute on function public.grant_rewarded_undo_credit(uuid, text) to service_role;
grant execute on function public.undo_my_swipe(uuid) to authenticated;
