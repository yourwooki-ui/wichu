grant delete on public.swipes to authenticated;

drop policy if exists "swipes_delete_own" on public.swipes;
create policy "swipes_delete_own"
on public.swipes for delete to authenticated
using (swiper_id = (select auth.uid()));
