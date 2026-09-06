create table public.profile_prompts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prompt_key varchar(40) not null,
  answer varchar(240) not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, position),
  unique (profile_id, prompt_key),
  constraint profile_prompts_key_check check (
    prompt_key in (
      'learning_now',
      'ideal_weekend',
      'language_exchange',
      'looking_for',
      'small_joy',
      'first_date'
    )
  ),
  constraint profile_prompts_answer_check check (
    char_length(trim(answer)) between 3 and 240
  ),
  constraint profile_prompts_position_check check (position between 0 and 2)
);

create trigger profile_prompts_set_updated_at
before update on public.profile_prompts
for each row execute function private.set_updated_at();

alter table public.profile_prompts enable row level security;

create policy "profile_prompts_select_visible"
on public.profile_prompts for select to authenticated
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

revoke all on public.profile_prompts from public, anon, authenticated;
grant select on public.profile_prompts to authenticated;

create function public.replace_my_profile_prompts(p_prompts jsonb)
returns setof public.profile_prompts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_prompts jsonb := coalesce(p_prompts, '[]'::jsonb);
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(normalized_prompts) <> 'array' then
    raise exception 'Prompts must be an array';
  end if;
  if jsonb_array_length(normalized_prompts) > 3 then
    raise exception 'A profile can contain at most three prompts';
  end if;
  if not exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'Profile not found';
  end if;

  delete from public.profile_prompts where profile_id = current_user_id;

  insert into public.profile_prompts (profile_id, prompt_key, answer, position)
  select
    current_user_id,
    trim(prompt.prompt_key),
    trim(prompt.answer),
    prompt.position
  from jsonb_to_recordset(normalized_prompts) as prompt(
    prompt_key text,
    answer text,
    position smallint
  );

  return query
  select *
  from public.profile_prompts
  where profile_id = current_user_id
  order by position;
end;
$$;

revoke execute on function public.replace_my_profile_prompts(jsonb)
from public, anon;
grant execute on function public.replace_my_profile_prompts(jsonb)
to authenticated;

create table public.date_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  met boolean not null,
  meet_again boolean,
  safety_concern boolean not null default false,
  notes varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, reviewer_id),
  constraint date_feedback_meet_again_check check (met or meet_again is null),
  constraint date_feedback_notes_check check (
    notes is null or char_length(trim(notes)) between 1 and 500
  )
);

create index date_feedback_reviewer_updated_idx
on public.date_feedback (reviewer_id, updated_at desc);

create index date_feedback_safety_review_idx
on public.date_feedback (updated_at desc)
where safety_concern;

create trigger date_feedback_set_updated_at
before update on public.date_feedback
for each row execute function private.set_updated_at();

alter table public.date_feedback enable row level security;

create policy "date_feedback_select_own"
on public.date_feedback for select to authenticated
using (reviewer_id = (select auth.uid()));

revoke all on public.date_feedback from public, anon, authenticated;
grant select on public.date_feedback to authenticated;

create function public.submit_my_date_feedback(
  p_match_id uuid,
  p_met boolean,
  p_meet_again boolean default null,
  p_safety_concern boolean default false,
  p_notes text default null
)
returns public.date_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_notes text := nullif(trim(p_notes), '');
  saved_feedback public.date_feedback;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.matches match_row
    where match_row.id = p_match_id
      and current_user_id in (match_row.user_a, match_row.user_b)
  ) then
    raise exception 'Match not found';
  end if;

  insert into public.date_feedback (
    match_id,
    reviewer_id,
    met,
    meet_again,
    safety_concern,
    notes
  )
  values (
    p_match_id,
    current_user_id,
    p_met,
    case when p_met then p_meet_again else null end,
    p_safety_concern,
    normalized_notes
  )
  on conflict (match_id, reviewer_id) do update
  set
    met = excluded.met,
    meet_again = excluded.meet_again,
    safety_concern = excluded.safety_concern,
    notes = excluded.notes,
    updated_at = now()
  returning * into saved_feedback;

  return saved_feedback;
end;
$$;

revoke execute on function public.submit_my_date_feedback(uuid, boolean, boolean, boolean, text)
from public, anon;
grant execute on function public.submit_my_date_feedback(uuid, boolean, boolean, boolean, text)
to authenticated;

-- Reporters can follow the progress of their own reports, but internal operator
-- identities and moderation notes remain private.
revoke select on public.reports from authenticated;
grant select (
  id,
  reporter_id,
  reported_id,
  reasons,
  details,
  report_context,
  source_match_id,
  status,
  moderation_action,
  created_at,
  updated_at,
  resolved_at
) on public.reports to authenticated;
