alter table public.user_settings
add column if not exists max_distance_km integer not null default 16000;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_max_distance_km_check'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
    add constraint user_settings_max_distance_km_check
    check (max_distance_km between 1 and 16000);
  end if;
end;
$$;

drop function if exists public.get_discovery_candidates(
  integer,
  integer,
  text[],
  text[],
  integer,
  integer
);

create or replace function public.get_discovery_candidates(
  p_min_age integer default 18,
  p_max_age integer default 29,
  p_genders text[] default null,
  p_country_codes text[] default null,
  p_max_distance_km integer default 16000,
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
  is_gold_pass boolean,
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
    distance.value as distance_km,
    private.has_active_gold(candidate.id) as is_gold_pass,
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
  cross join lateral (
    select private.profile_distance_km(candidate.id) as value
  ) distance
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
    and (
      distance.value <= least(greatest(p_max_distance_km, 1), 16000)
      or (distance.value is null and p_max_distance_km >= 16000)
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

revoke execute on function public.get_discovery_candidates(
  integer,
  integer,
  text[],
  text[],
  integer,
  integer,
  integer
) from public, anon;

grant execute on function public.get_discovery_candidates(
  integer,
  integer,
  text[],
  text[],
  integer,
  integer,
  integer
) to authenticated;
