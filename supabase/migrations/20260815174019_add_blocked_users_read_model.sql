create function public.get_my_blocked_users()
returns table (
  block_id uuid,
  profile_id uuid,
  display_name text,
  country_code text,
  photo_path text,
  blocked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    block.id,
    profile.id,
    profile.display_name::text,
    profile.country_code::text,
    (
      select photo.storage_path::text
      from public.profile_photos photo
      where photo.profile_id = profile.id
      order by photo.position asc, photo.created_at asc
      limit 1
    ),
    block.created_at
  from public.blocks block
  join public.profiles profile on profile.id = block.blocked_id
  where block.blocker_id = (select auth.uid())
  order by block.created_at desc, block.id desc;
end;
$$;

revoke execute on function public.get_my_blocked_users() from public, anon;
grant execute on function public.get_my_blocked_users() to authenticated;
