create extension if not exists postgis with schema extensions;

create table if not exists private.profile_locations (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  updated_at timestamptz not null default now()
);

create index if not exists profile_locations_geo_idx
on private.profile_locations using gist (location);

alter table private.profile_locations enable row level security;
revoke all on private.profile_locations from public, anon, authenticated;

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
  next_updated_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into private.profile_locations (profile_id, location, updated_at)
  values (
    (select auth.uid()),
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    next_updated_at
  )
  on conflict (profile_id) do update set
    location = excluded.location,
    updated_at = excluded.updated_at;

  return next_updated_at;
end;
$$;

revoke execute on function public.update_my_location(double precision, double precision)
from public, anon;
grant execute on function public.update_my_location(double precision, double precision)
to authenticated;

create or replace function private.profile_distance_km(other_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    1,
    round(
      extensions.st_distance(viewer.location, candidate.location) / 1000
    )::integer
  )
  from private.profile_locations viewer
  join private.profile_locations candidate on candidate.profile_id = other_profile_id
  where viewer.profile_id = (select auth.uid())
    and other_profile_id <> (select auth.uid())
    and not private.is_blocked_between(other_profile_id);
$$;

revoke execute on function private.profile_distance_km(uuid) from public, anon;
grant execute on function private.profile_distance_km(uuid) to authenticated;

drop policy if exists "profile_languages_select_own" on public.profile_languages;
create policy "profile_languages_select_visible"
on public.profile_languages for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
      and profile.review_status = 'approved'
      and not private.is_blocked_between(profile.id)
  )
);

drop function if exists public.get_discovery_candidates(
  integer,
  integer,
  text[],
  text[],
  integer,
  integer
);

create function public.get_discovery_candidates(
  p_min_age integer default 18,
  p_max_age integer default 29,
  p_genders text[] default null,
  p_country_codes text[] default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name varchar(50),
  birth_date date,
  gender text,
  country_code varchar(2),
  languages text[],
  language_details jsonb,
  bio varchar(500),
  created_at timestamptz,
  last_active_at timestamptz,
  distance_km integer,
  photo_paths text[],
  interests text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    candidate.id,
    candidate.display_name,
    candidate.birth_date,
    candidate.gender,
    candidate.country_code,
    candidate.languages,
    (
      case
        when candidate.native_language is null then '[]'::jsonb
        else jsonb_build_array(
          jsonb_build_object(
            'code', candidate.native_language,
            'level', 'native',
            'is_native', true
          )
        )
      end
      || coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
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
    ) as language_details,
    candidate.bio,
    candidate.created_at,
    candidate.last_active_at,
    private.profile_distance_km(candidate.id) as distance_km,
    array(
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = candidate.id
      order by photo.position
      limit 6
    ) as photo_paths,
    array(
      select interest.label::text
      from public.profile_interests selection
      join public.interests interest on interest.id = selection.interest_id
      where selection.profile_id = candidate.id
      order by interest.label
    ) as interests
  from public.profiles candidate
  join public.profiles viewer on viewer.id = (select auth.uid())
  where candidate.id <> (select auth.uid())
    and candidate.is_active
    and candidate.profile_completed
    and candidate.review_status = 'approved'
    and candidate.last_active_at >= now() - interval '7 days'
    and viewer.is_active
    and viewer.profile_completed
    and candidate.birth_date <= current_date - make_interval(years => least(greatest(p_min_age, 18), 90))
    and candidate.birth_date > current_date - make_interval(years => least(greatest(p_max_age, 18), 90) + 1)
    and candidate.gender = any(viewer.interested_in)
    and (p_genders is null or candidate.gender = any(p_genders))
    and (p_country_codes is null or candidate.country_code = any(p_country_codes))
    and viewer.gender = any(candidate.interested_in)
    and not private.is_blocked_between(candidate.id)
    and not exists (
      select 1
      from public.swipes swipe
      where swipe.swiper_id = (select auth.uid())
        and swipe.target_id = candidate.id
    )
  order by
    candidate.last_active_at desc,
    (candidate.created_at >= now() - interval '7 days') desc,
    candidate.profile_completeness desc,
    candidate.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer)
from public, anon;
grant execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer)
to authenticated;
