-- Existing profile approval remains valid when text, preferences, or metadata changes.
-- Only newly uploaded/replaced photo objects enter the moderation queue.

alter table public.profile_photos
add column review_status public.profile_review_status,
add column submitted_at timestamptz,
add column reviewed_at timestamptz,
add column reviewed_by uuid references auth.users (id) on delete set null,
add column review_note varchar(500);

update public.profile_photos photo
set
  review_status = profile.review_status,
  submitted_at = profile.submitted_at,
  reviewed_at = profile.reviewed_at,
  reviewed_by = profile.reviewed_by,
  review_note = profile.review_note
from public.profiles profile
where profile.id = photo.profile_id;

alter table public.profile_photos
alter column review_status set default 'pending',
alter column review_status set not null;

create index profile_photos_pending_review_idx
on public.profile_photos (submitted_at, profile_id)
where review_status = 'pending';

create index profile_photos_reviewed_by_idx
on public.profile_photos (reviewed_by)
where reviewed_by is not null;

-- Owners may manage paths and ordering, but moderation fields are server-owned.
revoke insert, update on public.profile_photos from authenticated;
grant insert (profile_id, storage_path, position) on public.profile_photos to authenticated;

drop policy if exists "photos_select_visible_profile" on public.profile_photos;
create policy "photos_select_visible_profile"
on public.profile_photos for select to authenticated
using (
  profile_id = (select auth.uid())
  or private.is_active_admin()
  or (
    review_status = 'approved'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = profile_id
        and profile.is_active
        and profile.profile_completed
        and profile.review_status = 'approved'
        and not private.is_blocked_between(profile.id)
    )
  )
);

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
      from public.profile_photos photo
      join public.profiles profile on profile.id = photo.profile_id
      where photo.storage_path = name
        and photo.review_status = 'approved'
        and profile.is_active
        and profile.profile_completed
        and profile.review_status = 'approved'
        and not private.is_blocked_between(profile.id)
    )
  )
);

create or replace function public.save_my_profile_for_review(
  p_display_name text,
  p_birth_date date,
  p_gender text,
  p_interested_in text[],
  p_country_code text,
  p_native_language text,
  p_languages text[],
  p_bio text,
  p_min_age integer,
  p_max_age integer,
  p_locale text,
  p_interest_ids uuid[],
  p_spoken_languages jsonb,
  p_tags jsonb,
  p_photo_paths text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  previous_photo_paths text[];
  previous_photo_state jsonb := '{}'::jsonb;
  previous_profile_status public.profile_review_status;
  has_pending_photos boolean := false;
  now_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(cardinality(p_photo_paths), 0) not between 1 and 6 then
    raise exception 'A main profile photo is required';
  end if;
  if cardinality(p_photo_paths) <> cardinality(array(select distinct unnest(p_photo_paths))) then
    raise exception 'Duplicate profile photo';
  end if;
  if exists (
    select 1 from unnest(p_photo_paths) path
    where split_part(path, '/', 1) <> current_user_id::text
  ) then
    raise exception 'Invalid profile photo owner';
  end if;

  select profile.review_status
  into previous_profile_status
  from public.profiles profile
  where profile.id = current_user_id
  for update;

  select
    coalesce(array_agg(photo.storage_path order by photo.position), '{}'::text[]),
    coalesce(
      jsonb_object_agg(
        photo.storage_path,
        jsonb_build_object(
          'review_status', photo.review_status,
          'submitted_at', photo.submitted_at,
          'reviewed_at', photo.reviewed_at,
          'reviewed_by', photo.reviewed_by,
          'review_note', photo.review_note
        )
      ),
      '{}'::jsonb
    )
  into previous_photo_paths, previous_photo_state
  from public.profile_photos photo
  where photo.profile_id = current_user_id;

  insert into public.profiles (
    id, display_name, birth_date, gender, interested_in, country_code,
    native_language, languages, bio, terms_accepted_at, privacy_accepted_at,
    last_active_at
  ) values (
    current_user_id, trim(p_display_name), p_birth_date, p_gender, p_interested_in,
    upper(p_country_code), p_native_language, p_languages, trim(p_bio), now_at, now_at, now_at
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    birth_date = excluded.birth_date,
    gender = excluded.gender,
    interested_in = excluded.interested_in,
    country_code = excluded.country_code,
    native_language = excluded.native_language,
    languages = excluded.languages,
    bio = excluded.bio,
    last_active_at = excluded.last_active_at;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = current_user_id and profile.profile_completed
  ) then
    raise exception 'Complete all required profile fields before review';
  end if;

  insert into public.user_settings (user_id, min_age, max_age, locale)
  values (current_user_id, p_min_age, p_max_age, p_locale)
  on conflict (user_id) do update set
    min_age = excluded.min_age,
    max_age = excluded.max_age,
    locale = excluded.locale;

  delete from public.profile_interests where profile_id = current_user_id;
  insert into public.profile_interests (profile_id, interest_id)
  select current_user_id, interest_id
  from unnest(coalesce(p_interest_ids, '{}'::uuid[])) interest_id;

  delete from public.profile_languages where profile_id = current_user_id;
  insert into public.profile_languages (profile_id, language_code, proficiency)
  select
    current_user_id,
    language->>'code',
    (language->>'level')::public.language_proficiency
  from jsonb_array_elements(coalesce(p_spoken_languages, '[]'::jsonb)) language;

  delete from public.profile_tags where profile_id = current_user_id;
  insert into public.profile_tags (profile_id, category, value)
  select current_user_id, tag->>'category', tag->>'value'
  from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) tag;

  -- Rebuild ordering while preserving moderation metadata for unchanged storage paths.
  delete from public.profile_photos where profile_id = current_user_id;
  insert into public.profile_photos (
    profile_id,
    storage_path,
    position,
    review_status,
    submitted_at,
    reviewed_at,
    reviewed_by,
    review_note
  )
  select
    current_user_id,
    ordered.path,
    ordered.position::smallint,
    coalesce(
      (previous_photo_state->ordered.path->>'review_status')::public.profile_review_status,
      'pending'::public.profile_review_status
    ),
    coalesce((previous_photo_state->ordered.path->>'submitted_at')::timestamptz, now_at),
    (previous_photo_state->ordered.path->>'reviewed_at')::timestamptz,
    (previous_photo_state->ordered.path->>'reviewed_by')::uuid,
    previous_photo_state->ordered.path->>'review_note'
  from unnest(p_photo_paths) with ordinality as ordered(path, position);

  select exists (
    select 1
    from public.profile_photos photo
    where photo.profile_id = current_user_id
      and photo.review_status = 'pending'
  ) into has_pending_photos;

  if previous_profile_status is null or previous_profile_status in ('draft', 'pending') then
    update public.profiles
    set
      review_status = 'pending',
      submitted_at = now_at,
      reviewed_at = null,
      reviewed_by = null,
      review_note = null
    where id = current_user_id;
  elsif previous_profile_status = 'rejected' and has_pending_photos then
    update public.profiles
    set
      review_status = 'pending',
      submitted_at = now_at,
      reviewed_at = null,
      reviewed_by = null,
      review_note = null
    where id = current_user_id;
  elsif previous_profile_status = 'approved' and has_pending_photos then
    -- Keep the approved profile live. Only the changed photos are withheld.
    update public.profiles
    set submitted_at = now_at
    where id = current_user_id;
  end if;

  return array(
    select path from unnest(coalesce(previous_photo_paths, '{}'::text[])) path
    where not (path = any(p_photo_paths))
  );
end;
$$;

create or replace function public.review_profile_submission(
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
  current_profile_status public.profile_review_status;
  moderated_photo_count integer := 0;
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

  select profile.review_status
  into current_profile_status
  from public.profiles profile
  where profile.id = review_profile_submission.profile_id;

  if current_profile_status is null then
    raise exception 'Profile not found';
  end if;

  update public.profile_photos photo
  set
    review_status = decision,
    reviewed_at = now(),
    reviewed_by = (select auth.uid()),
    review_note = nullif(trim(note), '')
  where photo.profile_id = review_profile_submission.profile_id
    and photo.review_status = 'pending';
  get diagnostics moderated_photo_count = row_count;

  if current_profile_status = 'pending' then
    if decision = 'approved' and not exists (
      select 1
      from public.profile_photos photo
      where photo.profile_id = review_profile_submission.profile_id
        and photo.position = 1
        and photo.review_status = 'approved'
    ) then
      raise exception 'An approved main profile photo is required';
    end if;

    update public.profiles
    set
      review_status = decision,
      reviewed_at = now(),
      reviewed_by = (select auth.uid()),
      review_note = nullif(trim(note), '')
    where id = review_profile_submission.profile_id;
  elsif moderated_photo_count = 0 then
    raise exception 'Pending photo submission not found';
  end if;

  return decision;
end;
$$;

create or replace function public.get_pending_profile_reviews(
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
    coalesce(
      (
        select min(photo.submitted_at)
        from public.profile_photos photo
        where photo.profile_id = profile.id
          and photo.review_status = 'pending'
      ),
      profile.submitted_at
    ),
    array(
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = profile.id
        and photo.review_status = 'pending'
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
          select profile_tag.category, jsonb_agg(profile_tag.value order by profile_tag.value) values
          from public.profile_tags profile_tag
          where profile_tag.profile_id = profile.id
          group by profile_tag.category
        ) tag
      ),
      '{}'::jsonb
    )
  from public.profiles profile
  where profile.review_status = 'pending'
    or exists (
      select 1
      from public.profile_photos photo
      where photo.profile_id = profile.id
        and photo.review_status = 'pending'
    )
  order by 8 asc nulls last
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
end;
$$;
