create or replace function public.claim_my_message_translation(
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
    on conflict on constraint message_translation_jobs_pkey do update
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

revoke all on function public.claim_my_message_translation(uuid, text) from public, anon;
grant execute on function public.claim_my_message_translation(uuid, text) to authenticated;
