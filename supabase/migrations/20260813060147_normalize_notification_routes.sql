alter table public.notification_outbox
drop constraint notification_outbox_route_check;

alter table public.notification_outbox
add constraint notification_outbox_route_check
check (route ~ '^/(chat/[0-9a-f-]{36}|matches|chat)$');

create or replace function private.queue_match_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then return new; end if;

  insert into public.notification_outbox (user_id, kind, title, body, route, source_id)
  select
    recipient.id,
    'match',
    '새로운 매치가 생겼어요',
    counterpart.display_name || '님과 서로 Pick했어요.',
    '/matches',
    new.id
  from (
    values (new.user_a, new.user_b), (new.user_b, new.user_a)
  ) pair(recipient_id, counterpart_id)
  join public.profiles recipient on recipient.id = pair.recipient_id
  join public.profiles counterpart on counterpart.id = pair.counterpart_id
  join public.user_settings settings on settings.user_id = recipient.id
  where recipient.is_active
    and settings.push_matches
    and not exists (
      select 1 from public.blocks block
      where (block.blocker_id = recipient.id and block.blocked_id = counterpart.id)
         or (block.blocker_id = counterpart.id and block.blocked_id = recipient.id)
    )
  on conflict (user_id, kind, source_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.queue_match_notification() from public, anon, authenticated;
