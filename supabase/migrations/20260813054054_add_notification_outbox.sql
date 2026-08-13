create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('match', 'message')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 300),
  route text not null check (
    route ~ '^/(chat/[0-9a-f-]{36}|matches|chat)$'
  ),
  source_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, source_id)
);

create index notification_outbox_pending_idx
on public.notification_outbox (created_at)
where status = 'pending';

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;

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

create or replace function private.queue_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  sender_name text;
begin
  select
    case when match.user_a = new.sender_id then match.user_b else match.user_a end,
    sender.display_name
  into recipient_id, sender_name
  from public.matches match
  join public.profiles sender on sender.id = new.sender_id
  where match.id = new.match_id
    and match.status = 'active'
    and (match.user_a = new.sender_id or match.user_b = new.sender_id);

  if recipient_id is null then return new; end if;

  insert into public.notification_outbox (user_id, kind, title, body, route, source_id)
  select
    recipient_id,
    'message',
    sender_name || '님의 새 메시지',
    left(regexp_replace(new.content, '[\n\r]+', ' ', 'g'), 160),
    '/chat/' || new.match_id::text,
    new.id
  from public.profiles recipient
  join public.user_settings settings on settings.user_id = recipient.id
  where recipient.id = recipient_id
    and recipient.is_active
    and settings.push_messages
    and not exists (
      select 1 from public.blocks block
      where (block.blocker_id = recipient_id and block.blocked_id = new.sender_id)
         or (block.blocker_id = new.sender_id and block.blocked_id = recipient_id)
    )
  on conflict (user_id, kind, source_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.queue_match_notification() from public, anon, authenticated;
revoke execute on function private.queue_message_notification() from public, anon, authenticated;

create trigger matches_queue_push
after insert on public.matches
for each row execute function private.queue_match_notification();

create trigger messages_queue_push
after insert on public.messages
for each row execute function private.queue_message_notification();
