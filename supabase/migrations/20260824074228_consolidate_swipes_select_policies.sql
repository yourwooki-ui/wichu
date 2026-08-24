-- A single permissive SELECT policy keeps the same access semantics while
-- avoiding two policy expressions for every authenticated swipe read.
drop policy if exists "swipes_select_own" on public.swipes;
drop policy if exists "swipes_select_incoming_likes" on public.swipes;

create policy "swipes_select_related"
on public.swipes for select to authenticated
using (
  swiper_id = (select auth.uid())
  or (
    target_id = (select auth.uid())
    and action = 'like'::public.swipe_action
  )
);
