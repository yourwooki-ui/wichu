-- Profile bios use the same opt-in translation budget as chat messages. The
-- cache is private because it contains user-authored profile text. A caller
-- can only claim a translation for their own profile or a currently visible
-- approved profile.

create table private.profile_bio_translation_jobs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2,3}$'),
  source_bio text not null,
  translated_text text,
  status text not null default 'processing' check (status in ('processing', 'failed', 'completed')),
  locked_until timestamptz not null default now() + interval '2 minutes',
  updated_at timestamptz not null default now(),
  primary key (profile_id, target_language)
);

revoke all on private.profile_bio_translation_jobs from public, anon, authenticated;

create function public.claim_my_profile_bio_translation(
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
  on conflict (profile_id, target_language) do update
  set source_bio = excluded.source_bio,
      translated_text = null,
      status = 'processing',
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  where private.profile_bio_translation_jobs.source_bio is distinct from excluded.source_bio
     or private.profile_bio_translation_jobs.status = 'failed'
     or private.profile_bio_translation_jobs.locked_until < now()
  returning profile_id into v_claimed_profile_id;

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

create function public.complete_profile_bio_translation(
  p_profile_id uuid,
  p_target_language text,
  p_source_bio text,
  p_translated_text text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_language text := lower(split_part(trim(coalesce(p_target_language, '')), '-', 1));
  v_source_bio text := coalesce(p_source_bio, '');
  v_translated_text text := trim(coalesce(p_translated_text, ''));
begin
  if v_target_language !~ '^[a-z]{2,3}$'
     or length(trim(v_source_bio)) not between 1 and 500
     or length(v_translated_text) not between 1 and 2000 then
    raise exception 'Invalid translation result' using errcode = '22023';
  end if;

  update private.profile_bio_translation_jobs job
  set translated_text = v_translated_text,
      status = 'completed',
      locked_until = now(),
      updated_at = now()
  where job.profile_id = p_profile_id
    and job.target_language = v_target_language
    and job.source_bio = v_source_bio
    and exists (
      select 1 from public.profiles profile
      where profile.id = p_profile_id and profile.bio = v_source_bio
    );

  if not found then
    raise exception 'Profile bio changed during translation' using errcode = 'P0002';
  end if;
  return v_translated_text;
end;
$$;

create function public.fail_profile_bio_translation(
  p_profile_id uuid,
  p_target_language text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.profile_bio_translation_jobs job
  set status = 'failed', updated_at = now(), locked_until = now()
  where job.profile_id = p_profile_id
    and job.target_language = lower(split_part(trim(coalesce(p_target_language, '')), '-', 1));
$$;

revoke all on function public.claim_my_profile_bio_translation(uuid, text) from public, anon;
revoke all on function public.complete_profile_bio_translation(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_profile_bio_translation(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_my_profile_bio_translation(uuid, text) to authenticated;
grant execute on function public.complete_profile_bio_translation(uuid, text, text, text) to service_role;
grant execute on function public.fail_profile_bio_translation(uuid, text) to service_role;
