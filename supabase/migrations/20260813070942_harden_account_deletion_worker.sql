alter table public.account_deletion_requests
add column if not exists attempt_count integer not null default 0,
add column if not exists processing_started_at timestamptz,
add column if not exists storage_object_count integer not null default 0;

create extension if not exists pgcrypto with schema extensions;

create table private.account_deletion_audit (
  request_id uuid primary key default gen_random_uuid(),
  user_fingerprint text not null,
  requested_at timestamptz not null,
  completed_at timestamptz not null default now(),
  storage_object_count integer not null default 0 check (storage_object_count >= 0)
);

revoke all on private.account_deletion_audit from public, anon, authenticated;

create function public.claim_account_deletion_as_worker(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.account_deletion_requests
  set
    status = 'processing',
    processing_started_at = now(),
    attempt_count = attempt_count + 1,
    last_error = null
  where user_id = p_user_id
    and (
      status in ('pending', 'failed')
      or (status = 'processing' and processing_started_at < now() - interval '15 minutes')
    );

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.claim_account_deletion_as_worker(uuid) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_as_worker(uuid) to service_role;

create function public.claim_my_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  return public.claim_account_deletion_as_worker((select auth.uid()));
end;
$$;

revoke execute on function public.claim_my_account_deletion() from public, anon;
grant execute on function public.claim_my_account_deletion() to authenticated;

create function public.fail_account_deletion_as_worker(p_user_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_deletion_requests
  set status = 'failed', last_error = left(p_error, 1000)
  where user_id = p_user_id and status = 'processing';
$$;

revoke execute on function public.fail_account_deletion_as_worker(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_account_deletion_as_worker(uuid, text) to service_role;

create function private.audit_completed_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_request public.account_deletion_requests%rowtype;
begin
  select * into deletion_request
  from public.account_deletion_requests
  where user_id = old.id and status = 'processing';

  if deletion_request.user_id is not null then
    insert into private.account_deletion_audit (
      user_fingerprint,
      requested_at,
      storage_object_count
    ) values (
      encode(extensions.digest(old.id::text, 'sha256'), 'hex'),
      deletion_request.requested_at,
      deletion_request.storage_object_count
    );
  end if;

  return old;
end;
$$;

revoke execute on function private.audit_completed_account_deletion() from public, anon, authenticated;

create trigger audit_completed_account_deletion_before_auth_delete
before delete on auth.users
for each row execute function private.audit_completed_account_deletion();
