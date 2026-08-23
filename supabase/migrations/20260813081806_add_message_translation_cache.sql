-- Translation stays opt-in: the original message is preserved and a participant
-- requests one target language at a time. Daily usage is counted only on a cache miss.

create table private.translation_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table private.message_translation_jobs (
  message_id uuid not null references public.messages(id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2,3}$'),
  status text not null default 'processing' check (status in ('processing', 'failed', 'completed')),
  locked_until timestamptz not null default now() + interval '2 minutes',
  updated_at timestamptz not null default now(),
  primary key (message_id, target_language)
);

revoke all on private.translation_daily_usage from public, anon, authenticated;
revoke all on private.message_translation_jobs from public, anon, authenticated;

create function public.claim_my_message_translation(
  p_message_id uuid,
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
  v_message public.messages;
  v_request_count integer;
  v_cached_translation text;
  v_claimed_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_target_language !~ '^[a-z]{2,3}$' then
    raise exception 'Unsupported target language' using errcode = '22023';
  end if;

  select msg.* into v_message
  from public.messages msg
  join public.matches m on m.id = msg.match_id
  where msg.id = p_message_id
    and m.status = 'active'
    and (v_user_id = m.user_a or v_user_id = m.user_b)
    and not private.is_blocked_between(
      case when v_user_id = m.user_a then m.user_b else m.user_a end
    );

  if v_message.id is null then
    raise exception 'Message is unavailable' using errcode = '42501';
  end if;

  v_cached_translation := v_message.translated_content ->> v_target_language;
  if lower(split_part(coalesce(v_message.original_language, ''), '-', 1)) = v_target_language then
    v_cached_translation := v_message.content;
  end if;
  if v_cached_translation is null then
    insert into private.message_translation_jobs (
      message_id, target_language, status, locked_until, updated_at
    ) values (
      p_message_id, v_target_language, 'processing', now() + interval '2 minutes', now()
    )
    on conflict (message_id, target_language) do update
    set status = 'processing',
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    where private.message_translation_jobs.status = 'failed'
       or private.message_translation_jobs.locked_until < now()
    returning message_id into v_claimed_message_id;

    if v_claimed_message_id is null then
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
      raise exception 'Translation daily limit reached' using errcode = 'P0001';
    end if;
  end if;

  return query select
    v_message.content,
    lower(split_part(coalesce(v_message.original_language, ''), '-', 1)),
    v_target_language,
    v_cached_translation;
end;
$$;

create function public.complete_message_translation(
  p_message_id uuid,
  p_target_language text,
  p_translated_text text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_language text := lower(split_part(trim(coalesce(p_target_language, '')), '-', 1));
  v_translated_text text := trim(coalesce(p_translated_text, ''));
begin
  if v_target_language !~ '^[a-z]{2,3}$'
     or length(v_translated_text) not between 1 and 8000 then
    raise exception 'Invalid translation result' using errcode = '22023';
  end if;

  update public.messages msg
  set translated_content = jsonb_set(
    msg.translated_content,
    array[v_target_language],
    to_jsonb(v_translated_text),
    true
  )
  where msg.id = p_message_id
  returning msg.translated_content ->> v_target_language into v_translated_text;

  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;

  update private.message_translation_jobs job
  set status = 'completed', updated_at = now(), locked_until = now()
  where job.message_id = p_message_id and job.target_language = v_target_language;
  return v_translated_text;
end;
$$;

create function public.fail_message_translation(
  p_message_id uuid,
  p_target_language text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.message_translation_jobs job
  set status = 'failed', updated_at = now(), locked_until = now()
  where job.message_id = p_message_id
    and job.target_language = lower(split_part(trim(coalesce(p_target_language, '')), '-', 1));
$$;

revoke all on function public.claim_my_message_translation(uuid, text) from public, anon;
revoke all on function public.complete_message_translation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_message_translation(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_my_message_translation(uuid, text) to authenticated;
grant execute on function public.complete_message_translation(uuid, text, text) to service_role;
grant execute on function public.fail_message_translation(uuid, text) to service_role;
