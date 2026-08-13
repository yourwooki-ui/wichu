create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.swipe_action as enum ('like', 'pass');
create type public.match_status as enum ('active', 'unmatched');
create type public.subscription_status as enum ('inactive', 'active', 'expired', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(50) not null,
  birth_date date not null check (birth_date between date '1900-01-01' and current_date),
  gender text not null check (gender in ('woman', 'man', 'nonbinary', 'other')),
  interested_in text[] not null check (
    cardinality(interested_in) > 0
    and interested_in <@ array['woman', 'man', 'nonbinary', 'other']::text[]
  ),
  country_code varchar(2) not null check (country_code ~ '^[A-Z]{2}$'),
  languages text[] not null default '{}' check (cardinality(languages) > 0),
  bio varchar(500) not null default '',
  profile_completeness smallint not null default 0 check (profile_completeness between 0 and 100),
  profile_completed boolean not null default false,
  is_active boolean not null default true,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (profile_id, position),
  unique (profile_id, storage_path)
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug varchar(60) not null unique,
  label varchar(80) not null,
  created_at timestamptz not null default now()
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action public.swipe_action not null,
  created_at timestamptz not null default now(),
  check (swiper_id <> target_id),
  unique (swiper_id, target_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  matched_at timestamptz not null default now(),
  status public.match_status not null default 'active',
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  original_language varchar(16),
  translated_content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason varchar(80) not null,
  details varchar(1000),
  status varchar(20) not null default 'pending' check (status in ('pending', 'reviewed', 'closed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id),
  unique (reporter_id, reported_id)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  min_age smallint not null default 18 check (min_age between 18 and 99),
  max_age smallint not null default 29 check (max_age between 18 and 99),
  country_codes text[] not null default '{}',
  discovery_enabled boolean not null default true,
  push_matches boolean not null default true,
  push_messages boolean not null default true,
  locale varchar(16) not null default 'en',
  updated_at timestamptz not null default now(),
  check (min_age <= max_age)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  platform varchar(10) not null check (platform in ('ios', 'android')),
  status public.subscription_status not null default 'inactive',
  current_period_end timestamptz,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, platform)
);

create index profile_photos_profile_idx on public.profile_photos (profile_id, position);
create index profile_interests_interest_idx on public.profile_interests (interest_id);
create index swipes_target_idx on public.swipes (target_id, action);
create index matches_user_a_idx on public.matches (user_a, matched_at desc);
create index matches_user_b_idx on public.matches (user_b, matched_at desc);
create index messages_match_created_idx on public.messages (match_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);
create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);
create index reports_reported_idx on public.reports (reported_id, created_at desc);
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create index profiles_discovery_idx
  on public.profiles (is_active, profile_completed, last_active_at desc, created_at desc);

create function private.enforce_adult_profile()
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
    case when length(trim(new.display_name)) >= 2 then 20 else 0 end
    + case when new.birth_date is not null then 15 else 0 end
    + case when new.gender is not null then 15 else 0 end
    + case when cardinality(new.interested_in) > 0 then 15 else 0 end
    + case when new.country_code is not null then 10 else 0 end
    + case when cardinality(new.languages) > 0 then 10 else 0 end
    + case when length(trim(new.bio)) >= 20 then 15 else 0 end
  );
  new.profile_completed := new.profile_completeness >= 85;

  return new;
end;
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_enforce_adult
before insert or update on public.profiles
for each row execute function private.enforce_adult_profile();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

revoke execute on function private.enforce_adult_profile() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create function private.is_blocked_between(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then true
    else exists (
      select 1
      from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user)
         or (b.blocker_id = other_user and b.blocked_id = (select auth.uid()))
    )
  end;
$$;

revoke execute on function private.is_blocked_between(uuid) from public, anon;
grant execute on function private.is_blocked_between(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.user_settings enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles_select_visible"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (
    is_active
    and profile_completed
    and not private.is_blocked_between(id)
  )
);

create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "profiles_delete_own"
on public.profiles for delete to authenticated
using (id = (select auth.uid()));

create policy "photos_select_visible_profile"
on public.profile_photos for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.is_active and p.profile_completed
  )
);

create policy "photos_insert_own"
on public.profile_photos for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "photos_update_own"
on public.profile_photos for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "photos_delete_own"
on public.profile_photos for delete to authenticated
using (profile_id = (select auth.uid()));

create policy "interests_select_authenticated"
on public.interests for select to authenticated
using (true);

create policy "profile_interests_select_visible"
on public.profile_interests for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = profile_id)
);

create policy "profile_interests_insert_own"
on public.profile_interests for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "profile_interests_delete_own"
on public.profile_interests for delete to authenticated
using (profile_id = (select auth.uid()));

create policy "swipes_select_own"
on public.swipes for select to authenticated
using (swiper_id = (select auth.uid()));

create policy "swipes_insert_own"
on public.swipes for insert to authenticated
with check (swiper_id = (select auth.uid()) and not private.is_blocked_between(target_id));

create policy "matches_select_participant"
on public.matches for select to authenticated
using (
  ((select auth.uid()) = user_a and not private.is_blocked_between(user_b))
  or ((select auth.uid()) = user_b and not private.is_blocked_between(user_a))
);

create policy "messages_select_match_participant"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status = 'active'
      and ((select auth.uid()) = m.user_a or (select auth.uid()) = m.user_b)
  )
);

create policy "messages_insert_match_participant"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status = 'active'
      and ((select auth.uid()) = m.user_a or (select auth.uid()) = m.user_b)
  )
);

create policy "blocks_select_own"
on public.blocks for select to authenticated
using (blocker_id = (select auth.uid()));

create policy "blocks_insert_own"
on public.blocks for insert to authenticated
with check (blocker_id = (select auth.uid()));

create policy "blocks_delete_own"
on public.blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

create policy "reports_select_own"
on public.reports for select to authenticated
using (reporter_id = (select auth.uid()));

create policy "reports_insert_own"
on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

create policy "settings_select_own"
on public.user_settings for select to authenticated
using (user_id = (select auth.uid()));

create policy "settings_insert_own"
on public.user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "settings_update_own"
on public.user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "subscriptions_select_own"
on public.subscriptions for select to authenticated
using (user_id = (select auth.uid()));

create function private.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action = 'like'
     and exists (
       select 1 from public.swipes reciprocal
       where reciprocal.swiper_id = new.target_id
         and reciprocal.target_id = new.swiper_id
         and reciprocal.action = 'like'
     )
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = new.swiper_id and b.blocked_id = new.target_id)
          or (b.blocker_id = new.target_id and b.blocked_id = new.swiper_id)
     ) then
    insert into public.matches (user_a, user_b)
    values (least(new.swiper_id, new.target_id), greatest(new.swiper_id, new.target_id))
    on conflict (user_a, user_b) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.create_match_on_mutual_like() from public, anon, authenticated;

create trigger swipes_create_mutual_match
after insert on public.swipes
for each row execute function private.create_match_on_mutual_like();

create function public.get_discovery_candidates(
  p_min_age integer default 18,
  p_max_age integer default 29,
  p_genders text[] default null,
  p_country_codes text[] default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.profiles
language sql
stable
security invoker
set search_path = ''
as $$
  select candidate.*
  from public.profiles candidate
  join public.profiles viewer on viewer.id = (select auth.uid())
  where candidate.id <> (select auth.uid())
    and candidate.is_active
    and candidate.profile_completed
    and candidate.birth_date <= current_date - make_interval(years => greatest(p_min_age, 18))
    and candidate.birth_date > current_date - make_interval(years => greatest(p_max_age, 18) + 1)
    and (p_genders is null or candidate.gender = any(p_genders))
    and (p_country_codes is null or candidate.country_code = any(p_country_codes))
    and viewer.gender = any(candidate.interested_in)
    and not private.is_blocked_between(candidate.id)
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = (select auth.uid()) and s.target_id = candidate.id
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

revoke execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer) from public, anon;
grant execute on function public.get_discovery_candidates(integer, integer, text[], text[], integer, integer) to authenticated;

revoke all on public.profiles from anon;
revoke all on public.profile_photos from anon;
revoke all on public.interests from anon;
revoke all on public.profile_interests from anon;
revoke all on public.swipes from anon;
revoke all on public.matches from anon;
revoke all on public.messages from anon;
revoke all on public.blocks from anon;
revoke all on public.reports from anon;
revoke all on public.user_settings from anon;
revoke all on public.subscriptions from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_photos to authenticated;
grant select on public.interests to authenticated;
grant select, insert, delete on public.profile_interests to authenticated;
grant select, insert on public.swipes to authenticated;
grant select on public.matches to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select on public.subscriptions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "profile_photo_objects_select_visible"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or exists (
      select 1 from public.profiles p
      where p.id::text = split_part(name, '/', 1)
        and p.is_active
        and p.profile_completed
        and not private.is_blocked_between(p.id)
    )
  )
);

create policy "profile_photo_objects_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy "profile_photo_objects_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy "profile_photo_objects_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

alter publication supabase_realtime add table public.messages;
