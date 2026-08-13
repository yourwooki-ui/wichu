create index subscriptions_gold_active_idx
on public.subscriptions (user_id, current_period_end desc)
where product_id = 'wichu_gold_monthly' and status = 'active';

create function private.has_active_gold(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions subscription
    where subscription.user_id = profile_id
      and subscription.product_id = 'wichu_gold_monthly'
      and subscription.status = 'active'
      and subscription.current_period_end > now()
  );
$$;

revoke execute on function private.has_active_gold(uuid) from public, anon;
grant execute on function private.has_active_gold(uuid) to authenticated;

create table public.profile_visits (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visit_count integer not null default 1 check (visit_count > 0),
  primary key (profile_id, visitor_id),
  check (profile_id <> visitor_id)
);

create index profile_visits_owner_recent_idx
on public.profile_visits (profile_id, last_visited_at desc);

create index profile_visits_visitor_idx
on public.profile_visits (visitor_id, last_visited_at desc);

alter table public.profile_visits enable row level security;

create policy "profile_visits_select_participant"
on public.profile_visits for select to authenticated
using (
  visitor_id = (select auth.uid())
  or (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id = (select auth.uid())
        and private.has_active_gold(owner_profile.id)
    )
  )
);

revoke all on public.profile_visits from public, anon, authenticated;
grant select on public.profile_visits to authenticated;

create function public.record_profile_visit(p_profile_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_profile_id = (select auth.uid()) then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles visited_profile
    where visited_profile.id = p_profile_id
      and visited_profile.is_active
      and visited_profile.profile_completed
      and visited_profile.review_status = 'approved'
      and not private.is_blocked_between(visited_profile.id)
  ) then
    raise exception 'Profile is not available';
  end if;

  insert into public.profile_visits (profile_id, visitor_id)
  values (p_profile_id, (select auth.uid()))
  on conflict (profile_id, visitor_id) do update set
    last_visited_at = now(),
    visit_count = public.profile_visits.visit_count + 1;
end;
$$;

revoke execute on function public.record_profile_visit(uuid) from public, anon;
grant execute on function public.record_profile_visit(uuid) to authenticated;

create function public.get_my_profile_visitors(p_limit integer default 50)
returns table (
  visitor_id uuid,
  display_name varchar(50),
  birth_date date,
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
security invoker
set search_path = ''
as $$
  select
    visitor.id,
    visitor.display_name,
    visitor.birth_date,
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
    and visitor.review_status = 'approved'
    and not private.is_blocked_between(visitor.id)
  order by visit.last_visited_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.get_my_profile_visitors(integer) from public, anon;
grant execute on function public.get_my_profile_visitors(integer) to authenticated;

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
    private.profile_distance_km(candidate.id) as distance_km,
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
    private.has_active_gold(candidate.id) desc,
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
