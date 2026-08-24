-- Interaction lifecycle policy:
-- - Discovery candidates: active within the latest 7 days
-- - Pick (like): visible and matchable for 1 day
-- - Pass: suppresses rediscovery for 3 days
-- - Matches and messages: no automatic expiration

alter table public.swipes
add column expires_at timestamptz;

update public.swipes
set expires_at = created_at + case action
  when 'like'::public.swipe_action then interval '1 day'
  else interval '3 days'
end;

alter table public.swipes
alter column expires_at set not null;

alter table public.swipes
add constraint swipes_expiration_after_creation
check (expires_at > created_at);

create index swipes_swiper_expiration_idx
on public.swipes (swiper_id, expires_at, target_id);

create index swipes_incoming_like_expiration_idx
on public.swipes (target_id, expires_at desc, created_at desc)
where action = 'like'::public.swipe_action;

create function private.set_swipe_expiration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.expires_at := new.created_at + case new.action
    when 'like'::public.swipe_action then interval '1 day'
    else interval '3 days'
  end;
  return new;
end;
$$;

revoke all on function private.set_swipe_expiration() from public, anon, authenticated;

create trigger swipes_set_expiration
before insert or update of action, created_at on public.swipes
for each row execute function private.set_swipe_expiration();

create or replace function private.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action = 'like'::public.swipe_action
     and new.expires_at > now()
     and exists (
       select 1 from public.swipes reciprocal
       where reciprocal.swiper_id = new.target_id
         and reciprocal.target_id = new.swiper_id
         and reciprocal.action = 'like'::public.swipe_action
         and reciprocal.expires_at > now()
     )
     and not exists (
       select 1 from public.blocks block
       where (block.blocker_id = new.swiper_id and block.blocked_id = new.target_id)
          or (block.blocker_id = new.target_id and block.blocked_id = new.swiper_id)
     ) then
    insert into public.matches (user_a, user_b)
    values (
      least(new.swiper_id, new.target_id),
      greatest(new.swiper_id, new.target_id)
    )
    on conflict (user_a, user_b) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.record_my_swipe(
  p_target_id uuid,
  p_action public.swipe_action
)
returns table (swipe_id uuid, match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_swipe public.swipes;
  v_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'Invalid swipe target' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(v_user_id, p_target_id)::text || ':' || greatest(v_user_id, p_target_id)::text,
      0
    )
  );

  if not exists (
    select 1
    from public.profiles target
    where target.id = p_target_id
      and target.is_active
      and target.profile_completed
      and target.review_status = 'approved'::public.profile_review_status
  ) or private.is_blocked_between(p_target_id) then
    raise exception 'Swipe target is unavailable' using errcode = 'P0001';
  end if;

  delete from public.swipes swipe
  where swipe.swiper_id = v_user_id
    and swipe.target_id = p_target_id
    and swipe.expires_at <= now();

  select swipe.* into v_swipe
  from public.swipes swipe
  where swipe.swiper_id = v_user_id
    and swipe.target_id = p_target_id
    and swipe.expires_at > now();

  if v_swipe.id is not null and v_swipe.action <> p_action then
    raise exception 'Swipe already recorded with another action' using errcode = '23505';
  end if;

  if v_swipe.id is null then
    insert into public.swipes (swiper_id, target_id, action)
    values (v_user_id, p_target_id, p_action)
    returning * into v_swipe;
  end if;

  if p_action = 'like'::public.swipe_action then
    select match.id into v_match_id
    from public.matches match
    where match.user_a = least(v_user_id, p_target_id)
      and match.user_b = greatest(v_user_id, p_target_id)
      and match.status = 'active'::public.match_status;
  end if;

  return query select v_swipe.id, v_match_id;
end;
$$;

create or replace function public.get_discovery_candidates(
  p_min_age integer default 18,
  p_max_age integer default 29,
  p_genders text[] default null,
  p_country_codes text[] default null,
  p_max_distance_km integer default 0,
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
security definer
set search_path = ''
as $$
  select
    candidate.id,
    candidate.display_name,
    date_part('year', age(current_date, candidate.birth_date))::integer,
    candidate.gender,
    candidate.country_code,
    candidate.languages,
    (
      case
        when candidate.native_language is null then '[]'::jsonb
        else pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'code', candidate.native_language,
            'level', 'native',
            'is_native', true
          )
        )
      end
      || coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
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
    ),
    candidate.bio,
    candidate.created_at,
    candidate.last_active_at,
    distance.value,
    private.has_active_gold(candidate.id),
    array(
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = candidate.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 6
    ),
    array(
      select interest.label::text
      from public.profile_interests selection
      join public.interests interest on interest.id = selection.interest_id
      where selection.profile_id = candidate.id
      order by interest.label
    )
  from public.profiles candidate
  join public.profiles viewer on viewer.id = (select auth.uid())
  left join public.user_settings viewer_settings on viewer_settings.user_id = viewer.id
  cross join lateral (
    select private.profile_distance_km(candidate.id) as value
  ) distance
  where candidate.id <> (select auth.uid())
    and candidate.is_active
    and candidate.profile_completed
    and candidate.review_status = 'approved'::public.profile_review_status
    and candidate.last_active_at >= now() - interval '7 days'
    and viewer.is_active
    and viewer.profile_completed
    and candidate.birth_date <= current_date - make_interval(years => least(greatest(p_min_age, 18), 90))
    and candidate.birth_date > current_date - make_interval(years => least(greatest(p_max_age, 18), 90) + 1)
    and candidate.gender = any(viewer.interested_in)
    and (p_genders is null or candidate.gender = any(p_genders))
    and (p_country_codes is null or candidate.country_code = any(p_country_codes))
    and (
      not coalesce(viewer_settings.exclude_same_country, false)
      or candidate.country_code <> viewer.country_code
    )
    and viewer.gender = any(candidate.interested_in)
    and not private.is_blocked_between(candidate.id)
    and (
      p_max_distance_km = 0
      or (
        distance.value is not null
        and distance.value <= least(greatest(p_max_distance_km, 1), 16000)
      )
    )
    and not exists (
      select 1
      from public.swipes swipe
      where swipe.swiper_id = (select auth.uid())
        and swipe.target_id = candidate.id
        and swipe.expires_at > now()
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

drop function public.get_my_incoming_likes(integer);
create function public.get_my_incoming_likes(p_limit integer default 50)
returns table (
  profile_id uuid,
  display_name varchar(50),
  age integer,
  country_code varchar(2),
  last_active_at timestamptz,
  distance_km integer,
  is_gold_pass boolean,
  liked_at timestamptz,
  expires_at timestamptz,
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    liker.id,
    liker.display_name,
    date_part('year', age(current_date, liker.birth_date))::integer,
    liker.country_code,
    liker.last_active_at,
    private.profile_distance_km(liker.id),
    private.has_active_gold(liker.id),
    incoming.created_at,
    incoming.expires_at,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = liker.id
        and photo.review_status = 'approved'::public.profile_review_status
      order by photo.position
      limit 1
    )
  from public.swipes incoming
  join public.profiles liker on liker.id = incoming.swiper_id
  where incoming.target_id = (select auth.uid())
    and incoming.action = 'like'::public.swipe_action
    and incoming.expires_at > now()
    and liker.is_active
    and liker.profile_completed
    and liker.review_status = 'approved'::public.profile_review_status
    and not private.is_blocked_between(liker.id)
    and not exists (
      select 1
      from public.swipes mine
      where mine.swiper_id = (select auth.uid())
        and mine.target_id = liker.id
        and mine.expires_at > now()
    )
  order by private.has_active_gold(liker.id) desc, incoming.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

drop function public.undo_my_swipe(uuid);
create function public.undo_my_swipe(p_target_id uuid)
returns table (undone boolean, unlimited boolean, credits_remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_latest_swipe public.swipes;
  v_unlimited boolean;
  v_credits_remaining integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('undo:' || v_user_id::text, 0)
  );

  select swipe.* into v_latest_swipe
  from public.swipes swipe
  where swipe.swiper_id = v_user_id
    and swipe.expires_at > now()
  order by swipe.created_at desc, swipe.id desc
  limit 1;

  if v_latest_swipe.id is null or v_latest_swipe.target_id <> p_target_id then
    raise exception 'Only the most recent swipe can be undone' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.matches match
    where match.user_a = least(v_user_id, p_target_id)
      and match.user_b = greatest(v_user_id, p_target_id)
      and match.status = 'active'::public.match_status
  ) then
    raise exception 'Matched swipes cannot be undone' using errcode = 'P0001';
  end if;

  v_unlimited := private.has_active_gold(v_user_id);

  if not v_unlimited then
    insert into private.undo_credit_accounts (user_id, credits)
    values (v_user_id, 0)
    on conflict (user_id) do nothing;

    update private.undo_credit_accounts account
    set credits = account.credits - 1,
        updated_at = now()
    where account.user_id = v_user_id
      and account.credits > 0
    returning account.credits into v_credits_remaining;

    if not found then
      raise exception 'Rewarded undo credit required' using errcode = 'P0001';
    end if;
  end if;

  delete from public.swipes swipe
  where swipe.id = v_latest_swipe.id;

  if not found then
    raise exception 'The swipe is no longer available to undo' using errcode = 'P0001';
  end if;

  return query select true, v_unlimited, v_credits_remaining;
end;
$$;

drop policy if exists "swipes_select_related" on public.swipes;
create policy "swipes_select_related"
on public.swipes for select to authenticated
using (
  expires_at > now()
  and (
    swiper_id = (select auth.uid())
    or (
      target_id = (select auth.uid())
      and action = 'like'::public.swipe_action
    )
  )
);

revoke all on function public.get_my_incoming_likes(integer) from public, anon, authenticated;
grant execute on function public.get_my_incoming_likes(integer) to authenticated, service_role;
revoke all on function public.undo_my_swipe(uuid) from public, anon, authenticated;
grant execute on function public.undo_my_swipe(uuid) to authenticated;

comment on column public.swipes.expires_at is
  'Server-enforced deadline: likes 24 hours, passes 3 days. Matches and chats never auto-expire.';
