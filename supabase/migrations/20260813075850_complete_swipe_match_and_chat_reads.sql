-- Complete the production swipe -> match -> chat contract.
-- Client writes are routed through authenticated, idempotent RPCs so retries and
-- concurrent mutual likes cannot create duplicate state.

create table public.match_read_states (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index match_read_states_user_updated_idx
on public.match_read_states (user_id, updated_at desc);

alter table public.match_read_states enable row level security;

alter table public.messages
add column client_id uuid;

alter table public.messages
add constraint messages_sender_client_key unique (sender_id, client_id);

create index messages_match_sender_created_idx
on public.messages (match_id, sender_id, created_at desc);

create function public.record_my_swipe(
  p_target_id uuid,
  p_action public.swipe_action
)
returns table (swipe_id uuid, match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_swipe public.swipes;
  v_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'Invalid swipe target' using errcode = '22023';
  end if;

  -- Serialize both directions of the same pair before the mutual-like trigger runs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(v_user_id, p_target_id)::text || ':' || greatest(v_user_id, p_target_id)::text,
      0
    )
  );

  if not exists (
    select 1
    from public.profiles target
    where target.id = p_target_id
      and target.is_active
      and target.profile_completed
      and target.review_status = 'approved'
  ) or private.is_blocked_between(p_target_id) then
    raise exception 'Swipe target is unavailable' using errcode = 'P0001';
  end if;

  select s.* into v_swipe
  from public.swipes s
  where s.swiper_id = v_user_id and s.target_id = p_target_id;

  if v_swipe.id is not null and v_swipe.action <> p_action then
    raise exception 'Swipe already recorded with another action' using errcode = '23505';
  end if;

  if v_swipe.id is null then
    insert into public.swipes (swiper_id, target_id, action)
    values (v_user_id, p_target_id, p_action)
    returning * into v_swipe;
  end if;

  if p_action = 'like' then
    select m.id into v_match_id
    from public.matches m
    where m.user_a = least(v_user_id, p_target_id)
      and m.user_b = greatest(v_user_id, p_target_id)
      and m.status = 'active';
  end if;

  return query select v_swipe.id, v_match_id;
end;
$$;

create function public.undo_my_swipe(p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.matches m
    where m.user_a = least(v_user_id, p_target_id)
      and m.user_b = greatest(v_user_id, p_target_id)
      and m.status = 'active'
  ) then
    raise exception 'Matched swipes cannot be undone' using errcode = 'P0001';
  end if;

  delete from public.swipes s
  where s.swiper_id = v_user_id and s.target_id = p_target_id;
  return found;
end;
$$;

create function public.send_my_message(
  p_match_id uuid,
  p_client_id uuid,
  p_content text,
  p_original_language text default 'ko'
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.messages;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_client_id is null or length(trim(coalesce(p_content, ''))) not between 1 and 4000 then
    raise exception 'Invalid message' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status = 'active'
      and (v_user_id = m.user_a or v_user_id = m.user_b)
      and not private.is_blocked_between(
        case when v_user_id = m.user_a then m.user_b else m.user_a end
      )
  ) then
    raise exception 'Active match required' using errcode = '42501';
  end if;

  insert into public.messages (
    match_id, sender_id, client_id, content, original_language
  ) values (
    p_match_id,
    v_user_id,
    p_client_id,
    trim(p_content),
    left(nullif(trim(coalesce(p_original_language, '')), ''), 16)
  )
  on conflict (sender_id, client_id) do nothing
  returning * into v_message;

  if v_message.id is null then
    select msg.* into v_message
    from public.messages msg
    where msg.sender_id = v_user_id and msg.client_id = p_client_id;
    if v_message.match_id <> p_match_id or v_message.content <> trim(p_content) then
      raise exception 'Message idempotency key conflict' using errcode = '23505';
    end if;
  end if;

  return v_message;
end;
$$;

create function public.mark_match_read(p_match_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_read_at timestamptz := clock_timestamp();
begin
  if v_user_id is null or not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status = 'active'
      and (v_user_id = m.user_a or v_user_id = m.user_b)
      and not private.is_blocked_between(
        case when v_user_id = m.user_a then m.user_b else m.user_a end
      )
  ) then
    raise exception 'Active match required' using errcode = '42501';
  end if;

  insert into public.match_read_states (match_id, user_id, last_read_at, updated_at)
  values (p_match_id, v_user_id, v_read_at, v_read_at)
  on conflict (match_id, user_id) do update
  set last_read_at = excluded.last_read_at, updated_at = excluded.updated_at;
  return v_read_at;
end;
$$;

create function public.get_my_unread_counts()
returns table (match_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
    count(msg.id) filter (
      where msg.sender_id <> (select auth.uid())
        and msg.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
    )::bigint
  from public.matches m
  left join public.match_read_states read_state
    on read_state.match_id = m.id and read_state.user_id = (select auth.uid())
  left join public.messages msg on msg.match_id = m.id
  where (select auth.uid()) is not null
    and m.status = 'active'
    and ((select auth.uid()) = m.user_a or (select auth.uid()) = m.user_b)
    and not private.is_blocked_between(
      case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end
    )
  group by m.id, read_state.last_read_at;
$$;

revoke all on public.match_read_states from anon, authenticated;
revoke insert, update, delete on public.swipes from authenticated;
revoke insert, update, delete on public.messages from authenticated;

revoke all on function public.record_my_swipe(uuid, public.swipe_action) from public, anon;
revoke all on function public.undo_my_swipe(uuid) from public, anon;
revoke all on function public.send_my_message(uuid, uuid, text, text) from public, anon;
revoke all on function public.mark_match_read(uuid) from public, anon;
revoke all on function public.get_my_unread_counts() from public, anon;

grant execute on function public.record_my_swipe(uuid, public.swipe_action) to authenticated;
grant execute on function public.undo_my_swipe(uuid) to authenticated;
grant execute on function public.send_my_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.mark_match_read(uuid) to authenticated;
grant execute on function public.get_my_unread_counts() to authenticated;
