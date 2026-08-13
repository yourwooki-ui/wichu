create or replace function public.touch_presence()
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.profiles
  set last_active_at = now()
  where id = (select auth.uid())
  returning last_active_at;
$$;

revoke execute on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

create or replace function public.get_discovery_candidates(
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
  bio varchar(500),
  created_at timestamptz,
  last_active_at timestamptz,
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
    candidate.bio,
    candidate.created_at,
    candidate.last_active_at,
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
