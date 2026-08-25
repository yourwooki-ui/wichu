-- Product quality improvements that stay intentionally small and auditable:
-- - optional context on a Pick, delivered only if the Pick becomes mutual
-- - privacy-minimized first-party funnel events for launch operations

alter table public.swipes
add column intro_message varchar(300);

alter table public.user_settings
add column connection_goals text[] not null default '{}'::text[];

alter table public.user_settings
add constraint user_settings_connection_goals_allowed
check (
  connection_goals <@ array['dating', 'friends', 'language_exchange', 'travel_buddy']::text[]
);

alter table public.swipes
add constraint swipes_intro_message_only_for_likes
check (
  intro_message is null
  or (
    action = 'like'::public.swipe_action
    and char_length(btrim(intro_message)) between 1 and 300
  )
);

drop function public.record_my_swipe(uuid, public.swipe_action);

create function public.record_my_swipe(
  p_target_id uuid,
  p_action public.swipe_action,
  p_intro_message text default null
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
  v_intro_message varchar(300) := nullif(btrim(p_intro_message), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'Invalid swipe target' using errcode = '22023';
  end if;
  if p_action = 'pass'::public.swipe_action then
    v_intro_message := null;
  elsif v_intro_message is not null and char_length(v_intro_message) > 300 then
    raise exception 'Pick message must be 300 characters or fewer' using errcode = '22001';
  end if;

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
      and target.review_status = 'approved'::public.profile_review_status
  ) or private.is_blocked_between(p_target_id) then
    raise exception 'Swipe target is unavailable' using errcode = 'P0001';
  end if;

  delete from public.swipes swipe
  where swipe.swiper_id = v_user_id
    and swipe.target_id = p_target_id
    and swipe.expires_at <= now();

  select swipe.* into v_swipe
  from public.swipes swipe
  where swipe.swiper_id = v_user_id
    and swipe.target_id = p_target_id
    and swipe.expires_at > now();

  if v_swipe.id is not null and v_swipe.action <> p_action then
    raise exception 'Swipe already recorded with another action' using errcode = '23505';
  end if;

  if v_swipe.id is null then
    insert into public.swipes (swiper_id, target_id, action, intro_message)
    values (v_user_id, p_target_id, p_action, v_intro_message)
    returning * into v_swipe;
  elsif v_intro_message is not null and v_swipe.intro_message is null then
    update public.swipes swipe
    set intro_message = v_intro_message
    where swipe.id = v_swipe.id
    returning * into v_swipe;
  end if;

  if p_action = 'like'::public.swipe_action then
    select match.id into v_match_id
    from public.matches match
    where match.user_a = least(v_user_id, p_target_id)
      and match.user_b = greatest(v_user_id, p_target_id)
      and match.status = 'active'::public.match_status;
  end if;

  return query select v_swipe.id, v_match_id;
end;
$$;

revoke all on function public.record_my_swipe(uuid, public.swipe_action, text)
from public, anon, authenticated;
grant execute on function public.record_my_swipe(uuid, public.swipe_action, text)
to authenticated;

create function private.deliver_pick_messages_on_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.messages (match_id, sender_id, content, original_language)
  select
    new.id,
    swipe.swiper_id,
    swipe.intro_message,
    profile.native_language
  from public.swipes swipe
  join public.profiles profile on profile.id = swipe.swiper_id
  where swipe.action = 'like'::public.swipe_action
    and swipe.expires_at > now()
    and swipe.intro_message is not null
    and (
      (swipe.swiper_id = new.user_a and swipe.target_id = new.user_b)
      or (swipe.swiper_id = new.user_b and swipe.target_id = new.user_a)
    )
  order by swipe.created_at, swipe.id;

  return new;
end;
$$;

revoke all on function private.deliver_pick_messages_on_match()
from public, anon, authenticated;

create trigger matches_deliver_pick_messages
after insert on public.matches
for each row execute function private.deliver_pick_messages_on_match();

drop function public.get_my_incoming_likes(integer);

create function public.get_my_incoming_likes(p_limit integer default 50)
returns table (
  profile_id uuid,
  display_name varchar(50),
  age integer,
  country_code varchar(2),
  last_active_at timestamptz,
  distance_km integer,
  is_gold_pass boolean,
  liked_at timestamptz,
  expires_at timestamptz,
  photo_path text,
  intro_message varchar(300)
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    liker.id,
    liker.display_name,
    date_part('year', age(current_date, liker.birth_date))::integer,
    liker.country_code,
    liker.last_active_at,
    private.profile_distance_km(liker.id),
    private.has_active_gold(liker.id),
    incoming.created_at,
    incoming.expires_at,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = liker.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 1
    ),
    incoming.intro_message
  from public.swipes incoming
  join public.profiles liker on liker.id = incoming.swiper_id
  where incoming.target_id = (select auth.uid())
    and incoming.action = 'like'::public.swipe_action
    and incoming.expires_at > now()
    and liker.is_active
    and liker.profile_completed
    and liker.review_status = 'approved'::public.profile_review_status
    and not private.is_blocked_between(liker.id)
    and not exists (
      select 1
      from public.swipes mine
      where mine.swiper_id = (select auth.uid())
        and mine.target_id = liker.id
        and mine.expires_at > now()
    )
  order by private.has_active_gold(liker.id) desc, incoming.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.get_my_incoming_likes(integer)
from public, anon, authenticated;
grant execute on function public.get_my_incoming_likes(integer)
to authenticated, service_role;

create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  event_name text not null,
  route text,
  session_id uuid,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_events_known_event check (
    event_name in (
      'app_opened',
      'app_error',
      'profile_completed',
      'discover_viewed',
      'discover_empty',
      'discovery_filters_saved',
      'swipe_recorded',
      'match_created',
      'chat_opened',
      'message_sent',
      'message_safety_warning',
      'profile_reported',
      'profile_blocked',
      'date_plan_shared',
      'purchase_viewed'
    )
  ),
  constraint product_events_route_length check (route is null or char_length(route) <= 120),
  constraint product_events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint product_events_properties_size check (pg_column_size(properties) <= 2048)
);

create index product_events_user_created_idx
on public.product_events (user_id, created_at desc);

create index product_events_name_created_idx
on public.product_events (event_name, created_at desc);

alter table public.product_events enable row level security;

create policy "product_events_insert_own"
on public.product_events for insert to authenticated
with check (user_id = (select auth.uid()));

revoke all on table public.product_events from public, anon, authenticated;
grant insert on table public.product_events to authenticated;
grant select, delete on table public.product_events to service_role;
grant usage, select on sequence public.product_events_id_seq to authenticated, service_role;

create function private.purge_expired_product_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.product_events event
  where event.created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_product_events()
from public, anon, authenticated;
grant execute on function private.purge_expired_product_events() to service_role;

comment on column public.swipes.intro_message is
  'Optional Pick context. It is copied into chat only after a mutual active match exists.';
comment on table public.product_events is
  'Privacy-minimized first-party product funnel events. Do not store message, profile, email, location, or token content.';
