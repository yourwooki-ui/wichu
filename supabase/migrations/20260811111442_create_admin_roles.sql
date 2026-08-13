create type private.admin_role as enum ('master', 'operator');

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role private.admin_role not null,
  parent_user_id uuid references private.admin_users(user_id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_hierarchy_check check (
    (role = 'master' and parent_user_id is null)
    or (role = 'operator' and parent_user_id is not null)
  ),
  constraint admin_users_no_self_parent_check check (parent_user_id is distinct from user_id)
);

comment on table private.admin_users is
  'Server-managed WICHU operations roles. Credentials are stored only in Supabase Auth.';

create index admin_users_parent_user_idx
on private.admin_users (parent_user_id)
where parent_user_id is not null;

alter table private.admin_users enable row level security;
alter table private.admin_users force row level security;

revoke all on table private.admin_users from public, anon, authenticated;
grant select, insert, update, delete on table private.admin_users to service_role;

create function private.validate_admin_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role = 'operator' and not exists (
    select 1
    from private.admin_users parent_admin
    where parent_admin.user_id = new.parent_user_id
      and parent_admin.role = 'master'
      and parent_admin.active
  ) then
    raise exception 'An operator must belong to an active master administrator.';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_admin_hierarchy() from public, anon, authenticated;

create trigger validate_admin_hierarchy_before_write
before insert or update of role, parent_user_id on private.admin_users
for each row execute function private.validate_admin_hierarchy();
