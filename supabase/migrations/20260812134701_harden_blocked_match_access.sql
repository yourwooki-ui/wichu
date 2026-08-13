-- A block must immediately revoke access to both the match row and its messages.
-- The client never receives a blocked user's conversation through the Data API or Realtime RLS.

drop policy if exists "messages_select_match_participant" on public.messages;
create policy "messages_select_match_participant"
on public.messages for select to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.status = 'active'
      and (
        ((select auth.uid()) = m.user_a and not private.is_blocked_between(m.user_b))
        or ((select auth.uid()) = m.user_b and not private.is_blocked_between(m.user_a))
      )
  )
);

drop policy if exists "messages_insert_match_participant" on public.messages;
create policy "messages_insert_match_participant"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.status = 'active'
      and (
        ((select auth.uid()) = m.user_a and not private.is_blocked_between(m.user_b))
        or ((select auth.uid()) = m.user_b and not private.is_blocked_between(m.user_a))
      )
  )
);
