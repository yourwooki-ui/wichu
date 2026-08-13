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

  select coalesce(array_agg(photo.storage_path order by photo.position), '{}'::text[])
  into previous_photo_paths
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

  delete from public.profile_photos where profile_id = current_user_id;
  insert into public.profile_photos (profile_id, storage_path, position)
  select current_user_id, path, position::smallint
  from unnest(p_photo_paths) with ordinality as ordered(path, position);

  update public.profiles
  set
    review_status = 'pending',
    submitted_at = now_at,
    reviewed_at = null,
    reviewed_by = null,
    review_note = null
  where id = current_user_id;

  return array(
    select path from unnest(coalesce(previous_photo_paths, '{}'::text[])) path
    where not (path = any(p_photo_paths))
  );
end;
$$;

revoke execute on function public.save_my_profile_for_review(
  text, date, text, text[], text, text, text[], text, integer, integer, text,
  uuid[], jsonb, jsonb, text[]
) from public, anon;
grant execute on function public.save_my_profile_for_review(
  text, date, text, text[], text, text, text[], text, integer, integer, text,
  uuid[], jsonb, jsonb, text[]
) to authenticated;
