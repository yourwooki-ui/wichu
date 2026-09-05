-- Keep old clients compatible while introducing structured, auditable reports.
alter table public.reports
  add column reasons text[] not null default '{}',
  add column report_context varchar(20) not null default 'profile',
  add column source_match_id uuid references public.matches(id) on delete set null,
  add column resolved_by uuid references auth.users(id) on delete set null,
  add column resolved_at timestamptz,
  add column resolution_note varchar(1000),
  add column moderation_action varchar(30) not null default 'none',
  add column updated_at timestamptz not null default now();

update public.reports
set
  reasons = array[reason],
  resolved_at = case when status = 'pending' then null else created_at end
where cardinality(reasons) = 0
   or (status <> 'pending' and resolved_at is null);

alter table public.reports
  add constraint reports_context_check
    check (report_context in ('profile', 'chat')),
  add constraint reports_reasons_count_check
    check (cardinality(reasons) between 1 and 3),
  add constraint reports_reasons_allowed_check
    check (
      reasons <@ array[
        'inappropriate_content',
        'harassment',
        'spam',
        'fake_profile',
        'underage',
        'scam',
        'other'
      ]::text[]
    ),
  add constraint reports_other_details_check
    check (not ('other' = any(reasons)) or nullif(trim(details), '') is not null),
  add constraint reports_resolution_state_check
    check (
      (status = 'pending' and resolved_by is null and resolved_at is null)
      or (status in ('reviewed', 'closed') and resolved_at is not null)
    ),
  add constraint reports_moderation_action_check
    check (moderation_action in ('none', 'profile_hidden'));

alter table public.reports
  drop constraint if exists reports_reporter_id_reported_id_key;

create unique index reports_one_pending_per_pair_idx
on public.reports (reporter_id, reported_id)
where status = 'pending';

create function private.normalize_report_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_reasons text[];
begin
  select coalesce(array_agg(distinct normalized_reason order by normalized_reason), '{}')
  into normalized_reasons
  from (
    select lower(trim(value)) as normalized_reason
    from unnest(
      case
        when cardinality(new.reasons) > 0 then new.reasons
        else array[new.reason]
      end
    ) value
    where nullif(trim(value), '') is not null
  ) normalized;

  new.reasons := normalized_reasons;
  new.reason := normalized_reasons[1];
  new.details := nullif(trim(new.details), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.normalize_report_submission() from public, anon, authenticated;

create trigger normalize_report_submission_before_write
before insert or update of reason, reasons, details on public.reports
for each row execute function private.normalize_report_submission();

create table private.moderation_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action varchar(60) not null,
  subject_id uuid references auth.users(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table private.moderation_audit_log is
  'Immutable record of privileged WICHU moderation and operator-management actions.';

alter table private.moderation_audit_log enable row level security;
alter table private.moderation_audit_log force row level security;
revoke all on table private.moderation_audit_log from public, anon, authenticated;
grant select, insert on table private.moderation_audit_log to service_role;

create index moderation_audit_log_created_idx
on private.moderation_audit_log (created_at desc, id desc);

create function private.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select admin_user.role::text
  from private.admin_users admin_user
  where admin_user.user_id = (select auth.uid())
    and admin_user.active;
$$;

revoke execute on function private.current_admin_role() from public, anon, authenticated;

create function private.audit_profile_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.review_status is distinct from new.review_status
    and new.review_status in ('approved', 'rejected')
    and new.reviewed_by is not null
  then
    insert into private.moderation_audit_log (actor_id, action, subject_id, metadata)
    values (
      new.reviewed_by,
      'profile_' || new.review_status::text,
      new.id,
      jsonb_build_object('note', new.review_note)
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.audit_profile_review() from public, anon, authenticated;

create trigger audit_profile_review_after_update
after update of review_status on public.profiles
for each row execute function private.audit_profile_review();

create function public.submit_report(
  p_reported_id uuid,
  p_reasons text[],
  p_details text default null,
  p_context varchar default 'profile',
  p_source_match_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  report_id uuid;
  normalized_reasons text[];
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if p_reported_id is null or p_reported_id = caller_id then
    raise exception 'Invalid reported profile';
  end if;

  select coalesce(array_agg(distinct normalized_reason order by normalized_reason), '{}')
  into normalized_reasons
  from (
    select lower(trim(value)) as normalized_reason
    from unnest(coalesce(p_reasons, '{}')) value
    where nullif(trim(value), '') is not null
  ) normalized;

  if cardinality(normalized_reasons) not between 1 and 3
    or not normalized_reasons <@ array[
      'inappropriate_content',
      'harassment',
      'spam',
      'fake_profile',
      'underage',
      'scam',
      'other'
    ]::text[]
  then
    raise exception 'Choose between one and three valid report reasons';
  end if;
  if 'other' = any(normalized_reasons) and nullif(trim(p_details), '') is null then
    raise exception 'Details are required for other reports';
  end if;
  if p_details is not null and char_length(p_details) > 1000 then
    raise exception 'Report details must be 1000 characters or fewer';
  end if;
  if p_context not in ('profile', 'chat') then
    raise exception 'Invalid report context';
  end if;
  if not exists (select 1 from public.profiles profile where profile.id = p_reported_id) then
    raise exception 'Reported profile not found';
  end if;

  if p_context = 'chat' then
    if p_source_match_id is null or not exists (
      select 1
      from public.matches match
      where match.id = p_source_match_id
        and caller_id in (match.user_a, match.user_b)
        and p_reported_id in (match.user_a, match.user_b)
    ) then
      raise exception 'Chat report does not belong to this match';
    end if;
  else
    p_source_match_id := null;
  end if;

  insert into public.reports (
    reporter_id,
    reported_id,
    reason,
    reasons,
    details,
    report_context,
    source_match_id
  ) values (
    caller_id,
    p_reported_id,
    normalized_reasons[1],
    normalized_reasons,
    nullif(trim(p_details), ''),
    p_context,
    p_source_match_id
  )
  on conflict (reporter_id, reported_id) where status = 'pending'
  do update set
    reasons = excluded.reasons,
    reason = excluded.reason,
    details = excluded.details,
    report_context = excluded.report_context,
    source_match_id = excluded.source_match_id
  returning id into report_id;

  return report_id;
end;
$$;

revoke execute on function public.submit_report(uuid, text[], text, varchar, uuid)
from public, anon;
grant execute on function public.submit_report(uuid, text[], text, varchar, uuid)
to authenticated;

drop function public.get_pending_reports(integer, timestamptz);

create function public.get_pending_reports(
  p_limit integer default 20,
  p_before timestamptz default null
)
returns table (
  id uuid,
  reporter_id uuid,
  reported_id uuid,
  reported_display_name varchar(50),
  reported_photo_path text,
  reasons text[],
  details varchar(1000),
  report_context varchar(20),
  source_match_id uuid,
  status varchar(20),
  created_at timestamptz
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
    report.id,
    report.reporter_id,
    report.reported_id,
    profile.display_name,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = report.reported_id
      order by photo.position
      limit 1
    ),
    report.reasons,
    report.details,
    report.report_context,
    report.source_match_id,
    report.status,
    report.created_at
  from public.reports report
  join public.profiles profile on profile.id = report.reported_id
  where report.status = 'pending'
    and (p_before is null or report.created_at < p_before)
  order by
    case
      when 'underage' = any(report.reasons) then 0
      when 'scam' = any(report.reasons) then 1
      else 2
    end,
    report.created_at asc,
    report.id asc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke execute on function public.get_pending_reports(integer, timestamptz) from public, anon;
grant execute on function public.get_pending_reports(integer, timestamptz) to authenticated;

create function public.resolve_report_v2(
  p_report_id uuid,
  p_resolution public.report_resolution,
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
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Resolution note must be 1000 characters or fewer';
  end if;
  if p_action not in ('none', 'profile_hidden') then
    raise exception 'Invalid moderation action';
  end if;
  if p_action = 'profile_hidden' and admin_role <> 'master' then
    raise exception 'Master administrator access required';
  end if;

  update public.reports report
  set
    status = p_resolution::text,
    resolved_by = (select auth.uid()),
    resolved_at = now(),
    resolution_note = nullif(trim(p_note), ''),
    moderation_action = p_action,
    updated_at = now()
  where report.id = p_report_id
    and report.status = 'pending'
  returning report.status, report.reported_id into next_status, subject_id;

  if next_status is null then
    raise exception 'Pending report not found';
  end if;

  if p_action = 'profile_hidden' then
    update public.profiles set is_active = false where id = subject_id;
  end if;

  insert into private.moderation_audit_log (
    actor_id,
    action,
    subject_id,
    report_id,
    metadata
  ) values (
    (select auth.uid()),
    'report_' || p_resolution::text,
    subject_id,
    p_report_id,
    jsonb_build_object('moderation_action', p_action, 'note', nullif(trim(p_note), ''))
  );

  return next_status;
end;
$$;

revoke execute on function public.resolve_report_v2(uuid, public.report_resolution, text, varchar)
from public, anon;
grant execute on function public.resolve_report_v2(uuid, public.report_resolution, text, varchar)
to authenticated;

create or replace function public.resolve_report(
  p_report_id uuid,
  p_resolution public.report_resolution
)
returns varchar(20)
language sql
security definer
set search_path = ''
as $$
  select public.resolve_report_v2(p_report_id, p_resolution, null, 'none');
$$;

revoke execute on function public.resolve_report(uuid, public.report_resolution)
from public, anon;
grant execute on function public.resolve_report(uuid, public.report_resolution)
to authenticated;

create function public.get_admin_team()
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_admin_role() <> 'master' then
    raise exception 'Master administrator access required';
  end if;

  return query
  select
    admin_user.user_id,
    coalesce(auth_user.email, '')::text,
    admin_user.role::text,
    admin_user.active,
    admin_user.created_at
  from private.admin_users admin_user
  join auth.users auth_user on auth_user.id = admin_user.user_id
  order by admin_user.role, admin_user.created_at;
end;
$$;

revoke execute on function public.get_admin_team() from public, anon;
grant execute on function public.get_admin_team() to authenticated;

create function public.set_operator_access(
  p_email text,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_id uuid;
begin
  if private.current_admin_role() <> 'master' then
    raise exception 'Master administrator access required';
  end if;
  if nullif(trim(p_email), '') is null then
    raise exception 'Operator email is required';
  end if;

  select auth_user.id
  into target_id
  from auth.users auth_user
  where lower(auth_user.email) = lower(trim(p_email))
  limit 1;

  if target_id is null or target_id = caller_id then
    raise exception 'Eligible operator account not found';
  end if;
  if exists (
    select 1 from private.admin_users admin_user
    where admin_user.user_id = target_id and admin_user.role = 'master'
  ) then
    raise exception 'Master administrator access cannot be changed here';
  end if;

  insert into private.admin_users (user_id, role, parent_user_id, active, updated_at)
  values (target_id, 'operator', caller_id, p_active, now())
  on conflict (user_id) do update
  set active = excluded.active, parent_user_id = caller_id, updated_at = now()
  where private.admin_users.role = 'operator';

  insert into private.moderation_audit_log (actor_id, action, subject_id, metadata)
  values (
    caller_id,
    case when p_active then 'operator_enabled' else 'operator_disabled' end,
    target_id,
    jsonb_build_object('email', lower(trim(p_email)))
  );

  return target_id;
end;
$$;

revoke execute on function public.set_operator_access(text, boolean) from public, anon;
grant execute on function public.set_operator_access(text, boolean) to authenticated;

create function public.get_moderation_activity(p_limit integer default 30)
returns table (
  id bigint,
  actor_email text,
  action varchar(60),
  subject_display_name varchar(50),
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_admin_role() <> 'master' then
    raise exception 'Master administrator access required';
  end if;

  return query
  select
    audit.id,
    auth_user.email::text,
    audit.action,
    profile.display_name,
    audit.metadata,
    audit.created_at
  from private.moderation_audit_log audit
  left join auth.users auth_user on auth_user.id = audit.actor_id
  left join public.profiles profile on profile.id = audit.subject_id
  order by audit.created_at desc, audit.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

revoke execute on function public.get_moderation_activity(integer) from public, anon;
grant execute on function public.get_moderation_activity(integer) to authenticated;
