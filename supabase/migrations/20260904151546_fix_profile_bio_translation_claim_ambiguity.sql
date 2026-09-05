-- PostgreSQL exposes RETURNS TABLE column names as PL/pgSQL variables. The
-- `target_language` output name therefore collided with the cache table's
-- primary-key column in the previous ON CONFLICT target.
create or replace function public.claim_my_profile_bio_translation(
  p_profile_id uuid,
  p_target_language text
)
returns table (
  content text,
  source_language text,
  target_language text,
  cached_translation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_target_language text := lower(split_part(trim(coalesce(p_target_language, '')), '-', 1));
  v_profile public.profiles;
  v_job private.profile_bio_translation_jobs;
  v_request_count integer;
  v_claimed_profile_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_target_language !~ '^[a-z]{2,3}$' then
    raise exception 'Unsupported target language' using errcode = '22023';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  where profile.id = p_profile_id
    and length(trim(profile.bio)) between 1 and 500
    and (
      profile.id = v_user_id
      or (
        profile.is_active
        and profile.profile_completed
        and profile.review_status = 'approved'::public.profile_review_status
        and not private.is_blocked_between(profile.id)
      )
    );

  if v_profile.id is null then
    raise exception 'Profile is unavailable' using errcode = '42501';
  end if;

  select job.* into v_job
  from private.profile_bio_translation_jobs job
  where job.profile_id = p_profile_id
    and job.target_language = v_target_language;

  if v_job.status = 'completed'
     and v_job.source_bio = v_profile.bio
     and length(trim(coalesce(v_job.translated_text, ''))) > 0 then
    return query select
      v_profile.bio::text,
      lower(split_part(coalesce(v_profile.native_language, ''), '-', 1)),
      v_target_language,
      v_job.translated_text;
    return;
  end if;

  insert into private.profile_bio_translation_jobs (
    profile_id, target_language, source_bio, translated_text, status, locked_until, updated_at
  ) values (
    p_profile_id, v_target_language, v_profile.bio, null, 'processing', now() + interval '2 minutes', now()
  )
  on conflict on constraint profile_bio_translation_jobs_pkey do update
  set source_bio = excluded.source_bio,
      translated_text = null,
      status = 'processing',
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  where private.profile_bio_translation_jobs.source_bio is distinct from excluded.source_bio
     or private.profile_bio_translation_jobs.status = 'failed'
     or private.profile_bio_translation_jobs.locked_until < now()
  returning private.profile_bio_translation_jobs.profile_id into v_claimed_profile_id;

  if v_claimed_profile_id is null then
    raise exception 'Translation is already processing' using errcode = 'P0001';
  end if;

  insert into private.translation_daily_usage (user_id, usage_date, request_count, updated_at)
  values (v_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
  set request_count = private.translation_daily_usage.request_count + 1,
      updated_at = excluded.updated_at
  where private.translation_daily_usage.request_count < 100
  returning request_count into v_request_count;

  if v_request_count is null then
    update private.profile_bio_translation_jobs job
    set status = 'failed', locked_until = now(), updated_at = now()
    where job.profile_id = p_profile_id and job.target_language = v_target_language;
    raise exception 'Translation daily limit reached' using errcode = 'P0001';
  end if;

  return query select
    v_profile.bio::text,
    lower(split_part(coalesce(v_profile.native_language, ''), '-', 1)),
    v_target_language,
    null::text;
end;
$$;

revoke all on function public.claim_my_profile_bio_translation(uuid, text)
from public, anon;
grant execute on function public.claim_my_profile_bio_translation(uuid, text)
to authenticated;
