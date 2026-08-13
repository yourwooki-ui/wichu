create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  value text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, category, value),
  constraint profile_tags_allowed_values check (
    (category = 'connection_goal' and value in ('dating', 'friends', 'language_exchange', 'travel_buddy'))
    or (category = 'vibe' and value in ('calm', 'playful', 'curious', 'active', 'creative', 'spontaneous', 'warm', 'independent'))
    or (category = 'daily_rhythm' and value in ('early_bird', 'night_owl', 'flexible'))
    or (category = 'communication_style' and value in ('talkative', 'listener', 'balanced'))
  )
);

create index profile_tags_discovery_idx
on public.profile_tags (category, value, profile_id);

alter table public.profile_tags enable row level security;

create policy "profile_tags_select_visible"
on public.profile_tags for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles profile
    where profile.id = profile_id
      and profile.is_active
      and profile.profile_completed
  )
);

create policy "profile_tags_insert_own"
on public.profile_tags for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy "profile_tags_delete_own"
on public.profile_tags for delete to authenticated
using (profile_id = (select auth.uid()));

revoke all on public.profile_tags from anon;
grant select, insert, delete on public.profile_tags to authenticated;
