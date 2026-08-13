drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_active_participant"
on public.matches for select to authenticated
using (
  status = 'active'
  and (
    ((select auth.uid()) = user_a and not private.is_blocked_between(user_b))
    or ((select auth.uid()) = user_b and not private.is_blocked_between(user_a))
  )
);
