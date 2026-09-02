create or replace function public.save_my_profile_bundle_for_review(
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
  p_photo_paths text[],
  p_profile_details jsonb
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  obsolete_photo_paths text[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- The existing function owns validation, profile completion, moderation state,
  -- interests, languages, tags and photo ordering. Calling it here keeps all of
  -- those writes and profile_details in one database transaction.
  obsolete_photo_paths := public.save_my_profile_for_review(
    p_display_name,
    p_birth_date,
    p_gender,
    p_interested_in,
    p_country_code,
    p_native_language,
    p_languages,
    p_bio,
    p_min_age,
    p_max_age,
    p_locale,
    p_interest_ids,
    p_spoken_languages,
    p_tags,
    p_photo_paths
  );

  if p_profile_details is not null then
    insert into public.profile_details (
      profile_id,
      occupation,
      education_level,
      height_cm,
      personality_type,
      drinking,
      smoking,
      exercise,
      pets
    ) values (
      current_user_id,
      nullif(trim(p_profile_details->>'occupation'), ''),
      nullif(p_profile_details->>'educationLevel', ''),
      nullif(p_profile_details->>'heightCm', '')::smallint,
      nullif(upper(p_profile_details->>'personalityType'), ''),
      nullif(p_profile_details->>'drinking', ''),
      nullif(p_profile_details->>'smoking', ''),
      nullif(p_profile_details->>'exercise', ''),
      nullif(p_profile_details->>'pets', '')
    )
    on conflict (profile_id) do update set
      occupation = excluded.occupation,
      education_level = excluded.education_level,
      height_cm = excluded.height_cm,
      personality_type = excluded.personality_type,
      drinking = excluded.drinking,
      smoking = excluded.smoking,
      exercise = excluded.exercise,
      pets = excluded.pets;
  end if;

  return obsolete_photo_paths;
end;
$$;

revoke all on function public.save_my_profile_bundle_for_review(
  text, date, text, text[], text, text, text[], text, integer, integer,
  text, uuid[], jsonb, jsonb, text[], jsonb
) from public;

grant execute on function public.save_my_profile_bundle_for_review(
  text, date, text, text[], text, text, text[], text, integer, integer,
  text, uuid[], jsonb, jsonb, text[], jsonb
) to authenticated;
