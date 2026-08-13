create type public.profile_review_status as enum ('draft', 'pending', 'approved', 'rejected');

alter table public.profiles
add column review_status public.profile_review_status not null default 'draft',
add column submitted_at timestamptz,
add column reviewed_at timestamptz,
add column reviewed_by uuid references auth.users (id) on delete set null,
add column review_note varchar(500);

create or replace function private.enforce_adult_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.birth_date > current_date - interval '18 years' then
    raise exception 'WICHU is only available to users aged 18 or older';
  end if;

  new.profile_completeness := (
    case when length(trim(new.display_name)) >= 2 then 15 else 0 end
    + case when new.birth_date is not null then 15 else 0 end
    + case when new.gender is not null then 15 else 0 end
    + case when cardinality(new.interested_in) > 0 then 15 else 0 end
    + case when new.country_code is not null then 15 else 0 end
    + case when cardinality(new.languages) > 0 then 15 else 0 end
    + case when length(trim(new.bio)) >= 20 then 10 else 0 end
  );
  new.profile_completed := (
    length(trim(new.display_name)) >= 2
    and new.birth_date is not null
    and new.gender is not null
    and cardinality(new.interested_in) > 0
    and new.country_code is not null
    and cardinality(new.languages) > 0
  );

  return new;
end;
$$;

update public.profiles
set display_name = display_name;

update public.profiles profile
set
  review_status = 'pending',
  submitted_at = now()
where profile.profile_completed
  and exists (
    select 1
    from public.profile_photos photo
    where photo.profile_id = profile.id
      and photo.position = 1
  );

create index profiles_review_queue_idx
on public.profiles (review_status, submitted_at)
where review_status = 'pending';

drop index if exists public.profiles_discovery_idx;
drop index if exists public.profiles_discovery_filter_idx;
drop index if exists public.profiles_discovery_order_idx;

create index profiles_discovery_filter_idx
on public.profiles (gender, country_code, birth_date)
where is_active and profile_completed and review_status = 'approved';

create index profiles_discovery_order_idx
on public.profiles (last_active_at desc nulls last, created_at desc, profile_completeness desc)
where is_active and profile_completed and review_status = 'approved';

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and review_status = 'draft'
  and submitted_at is null
  and reviewed_at is null
  and reviewed_by is null
  and review_note is null
);

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (
    is_active
    and profile_completed
    and review_status = 'approved'
    and not private.is_blocked_between(id)
  )
);

drop policy if exists "photos_select_visible_profile" on public.profile_photos;
create policy "photos_select_visible_profile"
on public.profile_photos for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
      and profile.review_status = 'approved'
  )
);

drop policy if exists "profile_interests_select_visible" on public.profile_interests;
create policy "profile_interests_select_visible"
on public.profile_interests for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
      and profile.review_status = 'approved'
  )
);

drop policy if exists "profile_tags_select_visible" on public.profile_tags;
create policy "profile_tags_select_visible"
on public.profile_tags for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
      and profile.review_status = 'approved'
  )
);

revoke update on public.profiles from authenticated;
grant update (
  display_name,
  birth_date,
  gender,
  interested_in,
  country_code,
  native_language,
  languages,
  bio,
  is_active,
  terms_accepted_at,
  privacy_accepted_at,
  last_active_at
) on public.profiles to authenticated;

create function public.submit_profile_for_review()
returns public.profile_review_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.profile_review_status;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.profile_completed
  ) then
    raise exception 'Complete all required profile fields before review';
  end if;

  if not exists (
    select 1
    from public.profile_photos photo
    where photo.profile_id = (select auth.uid())
      and photo.position = 1
  ) then
    raise exception 'A main profile photo is required';
  end if;

  update public.profiles
  set
    review_status = 'pending',
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by = null,
    review_note = null
  where id = (select auth.uid())
    and review_status in ('draft', 'rejected')
  returning review_status into next_status;

  if next_status is null then
    select review_status into next_status
    from public.profiles
    where id = (select auth.uid());
  end if;

  return next_status;
end;
$$;

revoke execute on function public.submit_profile_for_review() from public, anon;
grant execute on function public.submit_profile_for_review() to authenticated;

create function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users admin_user
    where admin_user.user_id = (select auth.uid())
      and admin_user.active
  );
$$;

revoke execute on function private.is_active_admin() from public, anon;
grant execute on function private.is_active_admin() to authenticated;

create function public.review_profile_submission(
  profile_id uuid,
  decision public.profile_review_status,
  note text default null
)
returns public.profile_review_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.profile_review_status;
begin
  if not private.is_active_admin() then
    raise exception 'Administrator access required';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  if note is not null and length(note) > 500 then
    raise exception 'Review note must be 500 characters or fewer';
  end if;

  update public.profiles
  set
    review_status = decision,
    reviewed_at = now(),
    reviewed_by = (select auth.uid()),
    review_note = nullif(trim(note), '')
  where id = profile_id
    and review_status = 'pending'
  returning review_status into next_status;

  if next_status is null then
    raise exception 'Pending profile submission not found';
  end if;

  return next_status;
end;
$$;

revoke execute on function public.review_profile_submission(uuid, public.profile_review_status, text)
from public, anon;
grant execute on function public.review_profile_submission(uuid, public.profile_review_status, text)
to authenticated;

create function public.get_pending_profile_reviews(
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
  bio varchar(500),
  submitted_at timestamptz,
  photo_paths text[],
  interests text[],
  profile_tags jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    date_part('year', age(current_date, profile.birth_date))::integer,
    profile.gender,
    profile.country_code,
    profile.languages,
    profile.bio,
    profile.submitted_at,
    array(
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = profile.id
      order by photo.position
      limit 6
    ),
    array(
      select interest.label::text
      from public.profile_interests selection
      join public.interests interest on interest.id = selection.interest_id
      where selection.profile_id = profile.id
      order by interest.label
    ),
    coalesce(
      (
        select jsonb_object_agg(tag.category, tag.values)
        from (
          select profile_tag.category, jsonb_agg(profile_tag.value order by profile_tag.value) as values
          from public.profile_tags profile_tag
          where profile_tag.profile_id = profile.id
          group by profile_tag.category
        ) tag
      ),
      '{}'::jsonb
    )
  from public.profiles profile
  where profile.review_status = 'pending'
  order by profile.submitted_at asc nulls last
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.get_pending_profile_reviews(integer, integer) from public, anon;
grant execute on function public.get_pending_profile_reviews(integer, integer) to authenticated;

drop policy if exists "profile_photo_objects_select_visible" on storage.objects;
create policy "profile_photo_objects_select_visible"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or private.is_active_admin()
    or exists (
      select 1
      from public.profiles profile
      where profile.id::text = split_part(name, '/', 1)
        and profile.is_active
        and profile.profile_completed
        and profile.review_status = 'approved'
        and not private.is_blocked_between(profile.id)
    )
  )
);

create or replace function private.validate_swipe_candidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer public.profiles%rowtype;
  candidate public.profiles%rowtype;
begin
  if (select auth.uid()) is null or new.swiper_id <> (select auth.uid()) then
    raise exception 'Invalid swipe owner';
  end if;

  select * into viewer
  from public.profiles
  where id = new.swiper_id
    and is_active
    and profile_completed
    and review_status = 'approved';

  if not found then
    raise exception 'Your profile must be approved before swiping';
  end if;

  select * into candidate
  from public.profiles
  where id = new.target_id
    and is_active
    and profile_completed
    and review_status = 'approved';

  if not found
     or candidate.id = viewer.id
     or not (viewer.gender = any(candidate.interested_in))
     or not (candidate.gender = any(viewer.interested_in))
     or exists (
       select 1
       from public.blocks block
       where (block.blocker_id = viewer.id and block.blocked_id = candidate.id)
          or (block.blocker_id = candidate.id and block.blocked_id = viewer.id)
     ) then
    raise exception 'Candidate is not available';
  end if;

  return new;
end;
$$;

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
    and viewer.is_active
    and viewer.profile_completed
    and viewer.review_status = 'approved'
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
    (candidate.last_active_at >= now() - interval '14 days') desc,
    (candidate.created_at >= now() - interval '7 days') desc,
    candidate.profile_completeness desc,
    candidate.last_active_at desc nulls last,
    candidate.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer)
from public, anon;
grant execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer)
to authenticated;
