create type public.report_resolution as enum ('reviewed', 'closed');

create function public.get_my_admin_access()
returns table (
  role text,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select admin_user.role::text, admin_user.active
  from private.admin_users admin_user
  where admin_user.user_id = (select auth.uid())
    and admin_user.active;
$$;

revoke execute on function public.get_my_admin_access() from public, anon;
grant execute on function public.get_my_admin_access() to authenticated;

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
  reason varchar(80),
  details varchar(1000),
  status varchar(20),
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active_admin()) then
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
    report.reason,
    report.details,
    report.status,
    report.created_at
  from public.reports report
  join public.profiles profile on profile.id = report.reported_id
  where report.status = 'pending'
    and (p_before is null or report.created_at < p_before)
  order by report.created_at asc, report.id asc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke execute on function public.get_pending_reports(integer, timestamptz) from public, anon;
grant execute on function public.get_pending_reports(integer, timestamptz) to authenticated;

create function public.resolve_report(
  p_report_id uuid,
  p_resolution public.report_resolution
)
returns varchar(20)
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status varchar(20);
begin
  if not (select private.is_active_admin()) then
    raise exception 'Administrator access required';
  end if;

  update public.reports
  set status = p_resolution::text
  where id = p_report_id
    and status = 'pending'
  returning status into next_status;

  if next_status is null then
    raise exception 'Pending report not found';
  end if;

  return next_status;
end;
$$;

revoke execute on function public.resolve_report(uuid, public.report_resolution) from public, anon;
grant execute on function public.resolve_report(uuid, public.report_resolution) to authenticated;

create index if not exists reports_pending_queue_idx
on public.reports (created_at, id)
where status = 'pending';

-- A member can explicitly end their own active match. Direct table updates stay unavailable.
create function public.end_my_match(p_match_id uuid)
returns public.match_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.match_status;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.matches match
  set status = 'unmatched'
  where match.id = p_match_id
    and match.status = 'active'
    and (select auth.uid()) in (match.user_a, match.user_b)
  returning match.status into next_status;

  if next_status is null then
    raise exception 'Active match not found';
  end if;

  return next_status;
end;
$$;

revoke execute on function public.end_my_match(uuid) from public, anon;
grant execute on function public.end_my_match(uuid) to authenticated;
