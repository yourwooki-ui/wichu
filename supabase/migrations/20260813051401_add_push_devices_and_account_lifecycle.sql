create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_devices_user_enabled_idx
on public.push_devices (user_id, enabled, last_registered_at desc);

alter table public.push_devices enable row level security;

create policy "push_devices_select_own"
on public.push_devices for select to authenticated
using (user_id = (select auth.uid()));

create policy "push_devices_insert_own"
on public.push_devices for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "push_devices_update_own"
on public.push_devices for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "push_devices_delete_own"
on public.push_devices for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.push_devices from public, anon, authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  last_error text
);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;

create function public.deactivate_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.profiles set is_active = false where id = (select auth.uid());
  update public.matches set status = 'unmatched'
  where status = 'active' and ((select auth.uid()) = user_a or (select auth.uid()) = user_b);
  update public.push_devices set enabled = false where user_id = (select auth.uid());
end;
$$;

create function public.request_my_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform public.deactivate_my_account();
  insert into public.account_deletion_requests (user_id, requested_at, status, last_error)
  values ((select auth.uid()), now(), 'pending', null)
  on conflict (user_id) do update set requested_at = excluded.requested_at, status = 'pending', last_error = null;
end;
$$;

revoke execute on function public.deactivate_my_account() from public, anon;
revoke execute on function public.request_my_account_deletion() from public, anon;
grant execute on function public.deactivate_my_account() to authenticated;
grant execute on function public.request_my_account_deletion() to authenticated;
