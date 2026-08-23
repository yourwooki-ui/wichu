create table public.profile_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  occupation varchar(80),
  education_level text check (
    education_level is null
    or education_level in ('high_school', 'vocational', 'college', 'graduate', 'other')
  ),
  height_cm smallint check (height_cm is null or height_cm between 120 and 220),
  personality_type varchar(4) check (
    personality_type is null
    or personality_type in (
      'INTJ', 'INTP', 'ENTJ', 'ENTP',
      'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
      'ISTP', 'ISFP', 'ESTP', 'ESFP'
    )
  ),
  drinking text check (
    drinking is null or drinking in ('never', 'sometimes', 'socially', 'often')
  ),
  smoking text check (
    smoking is null or smoking in ('never', 'sometimes', 'regularly', 'quitting')
  ),
  exercise text check (
    exercise is null or exercise in ('rarely', 'sometimes', 'often', 'daily')
  ),
  pets text check (
    pets is null or pets in ('none', 'dog', 'cat', 'both', 'other')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_details_set_updated_at
before update on public.profile_details
for each row execute function private.set_updated_at();

alter table public.profile_details enable row level security;

create policy "profile_details_select_visible"
on public.profile_details for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
      and profile.review_status = 'approved'
      and not private.is_blocked_between(profile.id)
  )
);

create policy "profile_details_insert_own"
on public.profile_details for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "profile_details_update_own"
on public.profile_details for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "profile_details_delete_own"
on public.profile_details for delete to authenticated
using (profile_id = (select auth.uid()));

revoke all on public.profile_details from anon;
grant select, insert, update, delete on public.profile_details to authenticated;
