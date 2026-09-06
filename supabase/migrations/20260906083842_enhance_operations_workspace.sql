-- Give operators one consolidated queue-health read model and turn post-date
-- safety concerns into an explicit, auditable moderation workflow.

alter table public.date_feedback
add column safety_review_status varchar(20) not null default 'pending',
add column safety_resolution_note varchar(1000),
add column safety_action varchar(30) not null default 'none',
add column safety_resolved_by uuid references auth.users(id) on delete set null,
add column safety_resolved_at timestamptz,
add constraint date_feedback_safety_review_status_check
  check (safety_review_status in ('pending', 'reviewed', 'closed')),
add constraint date_feedback_safety_action_check
  check (safety_action in ('none', 'profile_hidden'));

drop index if exists public.date_feedback_safety_review_idx;

create index date_feedback_pending_safety_review_idx
on public.date_feedback (updated_at asc, id asc)
where safety_concern and safety_review_status = 'pending';

create function private.reset_date_feedback_safety_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.safety_concern
    and (
      not old.safety_concern
      or new.notes is distinct from old.notes
    )
  then
    new.safety_review_status := 'pending';
    new.safety_resolution_note := null;
    new.safety_action := 'none';
    new.safety_resolved_by := null;
    new.safety_resolved_at := null;
  elsif not new.safety_concern then
    new.safety_review_status := 'closed';
    new.safety_action := 'none';
    new.safety_resolved_by := null;
    new.safety_resolved_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.reset_date_feedback_safety_review()
from public, anon, authenticated;

create trigger reset_date_feedback_safety_review_before_update
before update of safety_concern, notes on public.date_feedback
for each row execute function private.reset_date_feedback_safety_review();

create function public.get_operations_overview()
returns table (
  pending_profiles bigint,
  pending_reports bigint,
  urgent_reports bigint,
  pending_safety bigint,
  overdue_items bigint,
  resolved_today bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_admin_role() is null then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    (
      select count(*)
      from public.profiles profile
      where profile.review_status = 'pending'
        or exists (
          select 1
          from public.profile_photos photo
          where photo.profile_id = profile.id
            and photo.review_status = 'pending'
        )
    ),
    (select count(*) from public.reports where status = 'pending'),
    (
      select count(*)
      from public.reports
      where status = 'pending'
        and (reasons && array['underage', 'scam']::text[])
    ),
    (
      select count(*)
      from public.date_feedback
      where safety_concern and safety_review_status = 'pending'
    ),
    (
      select
        (
          select count(*)
          from public.profiles profile
          where (
              profile.review_status = 'pending'
              or exists (
                select 1
                from public.profile_photos pending_photo
                where pending_photo.profile_id = profile.id
                  and pending_photo.review_status = 'pending'
              )
            )
            and coalesce(
              (
                select min(photo.submitted_at)
                from public.profile_photos photo
                where photo.profile_id = profile.id
                  and photo.review_status = 'pending'
              ),
              profile.submitted_at
            ) < now() - interval '24 hours'
        )
        + (select count(*) from public.reports where status = 'pending' and created_at < now() - interval '24 hours')
        + (select count(*) from public.date_feedback where safety_concern and safety_review_status = 'pending' and updated_at < now() - interval '24 hours')
    ),
    (
      select count(*)
      from private.moderation_audit_log
      where created_at >= date_trunc('day', now())
    );
end;
$$;

revoke execute on function public.get_operations_overview() from public, anon;
grant execute on function public.get_operations_overview() to authenticated;

create function public.get_pending_safety_feedback(
  p_limit integer default 30,
  p_before timestamptz default null
)
returns table (
  id uuid,
  subject_id uuid,
  subject_display_name varchar(50),
  subject_photo_path text,
  met boolean,
  meet_again boolean,
  notes varchar(500),
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_admin_role() is null then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    feedback.id,
    case
      when match_row.user_a = feedback.reviewer_id then match_row.user_b
      else match_row.user_a
    end,
    subject.display_name,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = subject.id
      order by photo.position
      limit 1
    ),
    feedback.met,
    feedback.meet_again,
    feedback.notes,
    feedback.created_at,
    feedback.updated_at
  from public.date_feedback feedback
  join public.matches match_row on match_row.id = feedback.match_id
  join public.profiles subject on subject.id = case
    when match_row.user_a = feedback.reviewer_id then match_row.user_b
    else match_row.user_a
  end
  where feedback.safety_concern
    and feedback.safety_review_status = 'pending'
    and (p_before is null or feedback.updated_at < p_before)
  order by feedback.updated_at asc, feedback.id asc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke execute on function public.get_pending_safety_feedback(integer, timestamptz)
from public, anon;
grant execute on function public.get_pending_safety_feedback(integer, timestamptz)
to authenticated;

create function public.resolve_safety_feedback(
  p_feedback_id uuid,
  p_resolution varchar,
  p_note text default null,
  p_action varchar default 'none'
)
returns varchar(20)
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_role text := private.current_admin_role();
  subject_id uuid;
  next_status varchar(20);
begin
  if admin_role is null then
    raise exception 'Administrator access required';
  end if;
  if p_resolution not in ('reviewed', 'closed') then
    raise exception 'Invalid safety resolution';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Resolution note must be 1000 characters or fewer';
  end if;
  if p_action not in ('none', 'profile_hidden') then
    raise exception 'Invalid moderation action';
  end if;
  if p_action = 'profile_hidden' and admin_role <> 'master' then
    raise exception 'Master administrator access required';
  end if;

  select
    case
      when match_row.user_a = feedback.reviewer_id then match_row.user_b
      else match_row.user_a
    end
  into subject_id
  from public.date_feedback feedback
  join public.matches match_row on match_row.id = feedback.match_id
  where feedback.id = p_feedback_id
    and feedback.safety_concern
    and feedback.safety_review_status = 'pending';

  if subject_id is null then
    raise exception 'Pending safety feedback not found';
  end if;

  update public.date_feedback
  set
    safety_review_status = p_resolution,
    safety_resolution_note = nullif(trim(p_note), ''),
    safety_action = p_action,
    safety_resolved_by = (select auth.uid()),
    safety_resolved_at = now(),
    updated_at = now()
  where id = p_feedback_id
  returning safety_review_status into next_status;

  if p_action = 'profile_hidden' then
    update public.profiles set is_active = false where id = subject_id;
  end if;

  insert into private.moderation_audit_log (actor_id, action, subject_id, metadata)
  values (
    (select auth.uid()),
    'safety_' || p_resolution,
    subject_id,
    jsonb_build_object(
      'feedback_id', p_feedback_id,
      'moderation_action', p_action,
      'note', nullif(trim(p_note), '')
    )
  );

  return next_status;
end;
$$;

revoke execute on function public.resolve_safety_feedback(uuid, varchar, text, varchar)
from public, anon;
grant execute on function public.resolve_safety_feedback(uuid, varchar, text, varchar)
to authenticated;
