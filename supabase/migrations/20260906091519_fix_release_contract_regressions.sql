-- PostgreSQL's ARE engine accepts bounded repetitions only up to 255. The
-- previous 260 upper bound failed before evaluating otherwise valid Expo tokens.
create or replace function public.register_my_push_device(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_token text := trim(p_expo_push_token);
  existing_owner uuid;
  device_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Unsupported platform'; end if;
  if normalized_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{20,255}\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  select device.user_id
  into existing_owner
  from public.push_devices device
  where device.expo_push_token = normalized_token
  for update;

  if existing_owner is not null and existing_owner <> caller_id then
    raise exception 'Push token is already registered to another account';
  end if;

  insert into public.push_devices (
    user_id,
    expo_push_token,
    platform,
    device_name,
    enabled,
    last_registered_at
  )
  values (
    caller_id,
    normalized_token,
    p_platform,
    nullif(left(regexp_replace(trim(p_device_name), '[[:cntrl:]]+', '', 'g'), 120), ''),
    true,
    now()
  )
  on conflict (expo_push_token) do update
  set platform = excluded.platform,
      device_name = excluded.device_name,
      enabled = true,
      last_registered_at = now()
  returning id into device_id;

  return device_id;
end;
$$;

revoke all on function public.register_my_push_device(text, text, text)
from public, anon, authenticated;
grant execute on function public.register_my_push_device(text, text, text)
to authenticated, service_role;
