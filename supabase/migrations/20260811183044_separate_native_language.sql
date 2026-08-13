create type public.language_proficiency as enum (
  'beginner',
  'intermediate',
  'advanced',
  'fluent'
);

alter table public.profiles
add column native_language varchar(8)
check (native_language ~ '^[a-z]{2,3}$');

create table public.profile_languages (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  language_code varchar(8) not null check (language_code ~ '^[a-z]{2,3}$'),
  proficiency public.language_proficiency not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, language_code)
);

create index profile_languages_lookup_idx
on public.profile_languages (language_code, proficiency, profile_id);

alter table public.profile_languages enable row level security;

create policy "profile_languages_select_own"
on public.profile_languages for select to authenticated
using (profile_id = (select auth.uid()));

create policy "profile_languages_insert_own"
on public.profile_languages for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "profile_languages_update_own"
on public.profile_languages for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "profile_languages_delete_own"
on public.profile_languages for delete to authenticated
using (profile_id = (select auth.uid()));

revoke all on public.profile_languages from anon;
grant select, insert, update, delete on public.profile_languages to authenticated;

alter table public.user_settings
drop constraint if exists user_settings_min_age_check,
drop constraint if exists user_settings_max_age_check;

alter table public.user_settings
add constraint user_settings_min_age_check check (min_age between 18 and 90),
add constraint user_settings_max_age_check check (max_age between 18 and 90);
