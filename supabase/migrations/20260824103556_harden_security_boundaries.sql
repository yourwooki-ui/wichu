-- Security boundary hardening:
-- - Data API access stays opt-in.
-- - Device push tokens are only reachable through narrowly scoped RPCs.
-- - Internal schema objects default to no client privileges.

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke usage, select on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
revoke all on all tables in schema public from anon;
revoke all on all tables in schema private from public, anon;

-- Push tokens are bearer-like delivery addresses. The app never needs to read
-- them back, so remove the table API and expose registration/removal only.
drop policy if exists "push_devices_select_own" on public.push_devices;
drop policy if exists "push_devices_insert_own" on public.push_devices;
drop policy if exists "push_devices_update_own" on public.push_devices;
drop policy if exists "push_devices_delete_own" on public.push_devices;
revoke all on table public.push_devices from authenticated;

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
  normalized_token text := trim(p_expo_push_token);
  existing_owner uuid;
  device_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Unsupported platform'; end if;
  if normalized_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{20,260}\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  select device.user_id
  into existing_owner
  from public.push_devices device
  where device.expo_push_token = normalized_token
  for update;

  if existing_owner is not null and existing_owner <> caller_id then
    raise exception 'Push token is already registered to another account';
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
    normalized_token,
    p_platform,
    nullif(left(regexp_replace(trim(p_device_name), '[[:cntrl:]]+', '', 'g'), 120), ''),
    true,
    now()
  )
  on conflict (expo_push_token) do update
  set platform = excluded.platform,
      device_name = excluded.device_name,
      enabled = true,
      last_registered_at = now()
  returning id into device_id;

  return device_id;
end;
$$;

create function public.unregister_my_push_devices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  removed_count integer;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;

  delete from public.push_devices device
  where device.user_id = caller_id;
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.register_my_push_device(text, text, text)
from public, anon, authenticated;
grant execute on function public.register_my_push_device(text, text, text)
to authenticated, service_role;

revoke all on function public.unregister_my_push_devices()
from public, anon, authenticated;
grant execute on function public.unregister_my_push_devices()
to authenticated, service_role;

comment on table public.push_devices is
  'Server-managed push delivery addresses. No direct client grants; use registration RPCs.';

-- Exact birth dates are required for adult enforcement and age filtering, but
-- must not be selectable from another member's profile row. Public read models
-- return only the current integer age; the exact date is available only through
-- an authenticated self-only function.
create function public.get_my_private_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select profile.*
  from public.profiles profile
  where profile.id = (select auth.uid());
$$;

create function public.get_visible_profiles(p_profile_ids uuid[])
returns table (
  id uuid,
  display_name varchar(50),
  age integer,
  gender text,
  country_code varchar(2),
  native_language varchar(8),
  languages text[],
  bio varchar(500),
  created_at timestamptz,
  last_active_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    date_part('year', age(current_date, profile.birth_date))::integer,
    profile.gender,
    profile.country_code,
    profile.native_language,
    profile.languages,
    profile.bio,
    profile.created_at,
    profile.last_active_at
  from public.profiles profile
  where (select auth.uid()) is not null
    and cardinality(p_profile_ids) between 1 and 50
    and profile.id = any(p_profile_ids)
    and (
      profile.id = (select auth.uid())
      or (
        profile.is_active
        and profile.profile_completed
        and profile.review_status = 'approved'::public.profile_review_status
        and not private.is_blocked_between(profile.id)
      )
    );
$$;

drop function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer, integer);
create function public.get_discovery_candidates(
  p_min_age integer default 18,
  p_max_age integer default 29,
  p_genders text[] default null,
  p_country_codes text[] default null,
  p_max_distance_km integer default 0,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name varchar(50),
  age integer,
  gender text,
  country_code varchar(2),
  languages text[],
  language_details jsonb,
  bio varchar(500),
  created_at timestamptz,
  last_active_at timestamptz,
  distance_km integer,
  is_gold_pass boolean,
  photo_paths text[],
  interests text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id,
    candidate.display_name,
    date_part('year', age(current_date, candidate.birth_date))::integer,
    candidate.gender,
    candidate.country_code,
    candidate.languages,
    (
      case
        when candidate.native_language is null then '[]'::jsonb
        else pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'code', candidate.native_language,
            'level', 'native',
            'is_native', true
          )
        )
      end
      || coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'code', spoken.language_code,
              'level', spoken.proficiency,
              'is_native', false
            )
            order by spoken.language_code
          )
          from public.profile_languages spoken
          where spoken.profile_id = candidate.id
            and spoken.language_code is distinct from candidate.native_language
        ),
        '[]'::jsonb
      )
    ),
    candidate.bio,
    candidate.created_at,
    candidate.last_active_at,
    distance.value,
    private.has_active_gold(candidate.id),
    array(
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = candidate.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 6
    ),
    array(
      select interest.label::text
      from public.profile_interests selection
      join public.interests interest on interest.id = selection.interest_id
      where selection.profile_id = candidate.id
      order by interest.label
    )
  from public.profiles candidate
  join public.profiles viewer on viewer.id = (select auth.uid())
  left join public.user_settings viewer_settings on viewer_settings.user_id = viewer.id
  cross join lateral (
    select private.profile_distance_km(candidate.id) as value
  ) distance
  where candidate.id <> (select auth.uid())
    and candidate.is_active
    and candidate.profile_completed
    and candidate.review_status = 'approved'::public.profile_review_status
    and candidate.last_active_at >= now() - interval '7 days'
    and viewer.is_active
    and viewer.profile_completed
    and candidate.birth_date <= current_date - make_interval(years => least(greatest(p_min_age, 18), 90))
    and candidate.birth_date > current_date - make_interval(years => least(greatest(p_max_age, 18), 90) + 1)
    and candidate.gender = any(viewer.interested_in)
    and (p_genders is null or candidate.gender = any(p_genders))
    and (p_country_codes is null or candidate.country_code = any(p_country_codes))
    and (
      not coalesce(viewer_settings.exclude_same_country, false)
      or candidate.country_code <> viewer.country_code
    )
    and viewer.gender = any(candidate.interested_in)
    and not private.is_blocked_between(candidate.id)
    and (
      p_max_distance_km = 0
      or (
        distance.value is not null
        and distance.value <= least(greatest(p_max_distance_km, 1), 16000)
      )
    )
    and not exists (
      select 1
      from public.swipes swipe
      where swipe.swiper_id = (select auth.uid())
        and swipe.target_id = candidate.id
    )
  order by
    private.has_active_gold(candidate.id) desc,
    candidate.last_active_at desc,
    (candidate.created_at >= now() - interval '7 days') desc,
    candidate.profile_completeness desc,
    candidate.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

drop function public.get_my_profile_visitors(integer);
create function public.get_my_profile_visitors(p_limit integer default 50)
returns table (
  visitor_id uuid,
  display_name varchar(50),
  age integer,
  country_code varchar(2),
  last_active_at timestamptz,
  distance_km integer,
  is_gold_pass boolean,
  last_visited_at timestamptz,
  visit_count integer,
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    visitor.id,
    visitor.display_name,
    date_part('year', age(current_date, visitor.birth_date))::integer,
    visitor.country_code,
    visitor.last_active_at,
    private.profile_distance_km(visitor.id),
    private.has_active_gold(visitor.id),
    visit.last_visited_at,
    visit.visit_count,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = visitor.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 1
    )
  from public.profile_visits visit
  join public.profiles visitor on visitor.id = visit.visitor_id
  join public.profiles owner_profile on owner_profile.id = (select auth.uid())
  where visit.profile_id = (select auth.uid())
    and private.has_active_gold(owner_profile.id)
    and visitor.is_active
    and visitor.profile_completed
    and visitor.review_status = 'approved'::public.profile_review_status
    and not private.is_blocked_between(visitor.id)
  order by visit.last_visited_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

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
  photo_path text
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
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = liker.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 1
    )
  from public.swipes incoming
  join public.profiles liker on liker.id = incoming.swiper_id
  where incoming.target_id = (select auth.uid())
    and incoming.action = 'like'::public.swipe_action
    and liker.is_active
    and liker.profile_completed
    and liker.review_status = 'approved'::public.profile_review_status
    and not private.is_blocked_between(liker.id)
    and not exists (
      select 1
      from public.swipes mine
      where mine.swiper_id = (select auth.uid())
        and mine.target_id = liker.id
    )
  order by private.has_active_gold(liker.id) desc, incoming.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

drop function public.get_my_match_connections(integer);
create function public.get_my_match_connections(p_limit integer default 100)
returns table (
  match_id uuid,
  matched_at timestamptz,
  profile_id uuid,
  display_name varchar(50),
  age integer,
  country_code varchar(2),
  last_active_at timestamptz,
  photo_path text,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as id
  ),
  unread as (
    select counts.match_id, counts.unread_count
    from public.get_my_unread_counts() counts
  )
  select
    connection.id,
    connection.matched_at,
    partner.id,
    partner.display_name,
    date_part('year', age(current_date, partner.birth_date))::integer,
    partner.country_code,
    partner.last_active_at,
    primary_photo.storage_path,
    latest_message.content,
    latest_message.created_at,
    latest_message.sender_id,
    coalesce(unread.unread_count, 0)::bigint
  from public.matches connection
  cross join caller
  join public.profiles partner
    on partner.id = case
      when connection.user_a = caller.id then connection.user_b
      else connection.user_a
    end
  left join lateral (
    select photo.storage_path
    from public.profile_photos photo
    where photo.profile_id = partner.id
      and photo.review_status = 'approved'::public.profile_review_status
    order by photo.position
    limit 1
  ) primary_photo on true
  left join lateral (
    select message.content, message.created_at, message.sender_id
    from public.messages message
    where message.match_id = connection.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest_message on true
  left join unread on unread.match_id = connection.id
  where caller.id is not null
    and connection.status = 'active'::public.match_status
    and caller.id in (connection.user_a, connection.user_b)
    and not private.is_blocked_between(partner.id)
  order by coalesce(latest_message.created_at, connection.matched_at) desc, connection.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke select on table public.profiles from authenticated;
grant select (
  id,
  display_name,
  gender,
  interested_in,
  country_code,
  native_language,
  languages,
  bio,
  profile_completeness,
  profile_completed,
  review_status,
  is_active,
  last_active_at,
  created_at,
  updated_at
) on table public.profiles to authenticated;

revoke all on function public.get_my_private_profile() from public, anon, authenticated;
grant execute on function public.get_my_private_profile() to authenticated, service_role;
revoke all on function public.get_visible_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.get_visible_profiles(uuid[]) to authenticated, service_role;

revoke all on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer, integer)
to authenticated, service_role;

revoke all on function public.get_my_profile_visitors(integer) from public, anon, authenticated;
grant execute on function public.get_my_profile_visitors(integer) to authenticated, service_role;
revoke all on function public.get_my_incoming_likes(integer) from public, anon, authenticated;
grant execute on function public.get_my_incoming_likes(integer) to authenticated, service_role;
revoke all on function public.get_my_match_connections(integer) from public, anon, authenticated;
grant execute on function public.get_my_match_connections(integer) to authenticated, service_role;

-- Abuse containment for high-frequency write paths. Retries using the same
-- client message ID stay idempotent and do not consume an additional slot.
create or replace function public.send_my_message(
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

  select message.* into v_message
  from public.messages message
  where message.sender_id = v_user_id
    and message.client_id = p_client_id;
  if v_message.id is not null then
    if v_message.match_id <> p_match_id or v_message.content <> trim(p_content) then
      raise exception 'Message idempotency key conflict' using errcode = '23505';
    end if;
    return v_message;
  end if;

  if (
    select count(*)
    from public.messages recent
    where recent.sender_id = v_user_id
      and recent.created_at >= now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Message rate limit exceeded' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.matches match
    where match.id = p_match_id
      and match.status = 'active'::public.match_status
      and (v_user_id = match.user_a or v_user_id = match.user_b)
      and not private.is_blocked_between(
        case when v_user_id = match.user_a then match.user_b else match.user_a end
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
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.record_profile_visit(p_profile_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_profile_id = (select auth.uid()) then return; end if;

  if not exists (
    select 1
    from public.profiles visited_profile
    where visited_profile.id = p_profile_id
      and visited_profile.is_active
      and visited_profile.profile_completed
      and visited_profile.review_status = 'approved'::public.profile_review_status
      and not private.is_blocked_between(visited_profile.id)
  ) then
    raise exception 'Profile is not available';
  end if;

  insert into public.profile_visits (profile_id, visitor_id)
  values (p_profile_id, (select auth.uid()))
  on conflict (profile_id, visitor_id) do update
  set last_visited_at = now(),
      visit_count = public.profile_visits.visit_count + 1
  where public.profile_visits.last_visited_at < now() - interval '10 minutes';
end;
$$;

create or replace function public.update_my_location(
  p_latitude double precision,
  p_longitude double precision
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_updated_at timestamptz;
  next_updated_at timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  select location.updated_at into current_updated_at
  from private.profile_locations location
  where location.profile_id = (select auth.uid());
  if current_updated_at > now() - interval '1 minute' then return current_updated_at; end if;

  insert into private.profile_locations (profile_id, location, updated_at)
  values (
    (select auth.uid()),
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    next_updated_at
  )
  on conflict (profile_id) do update
  set location = excluded.location,
      updated_at = excluded.updated_at;

  return next_updated_at;
end;
$$;

revoke all on function public.send_my_message(uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.send_my_message(uuid, uuid, text, text)
to authenticated, service_role;
revoke all on function public.record_profile_visit(uuid) from public, anon, authenticated;
grant execute on function public.record_profile_visit(uuid) to authenticated, service_role;
revoke all on function public.update_my_location(double precision, double precision)
from public, anon, authenticated;
grant execute on function public.update_my_location(double precision, double precision)
to authenticated, service_role;
