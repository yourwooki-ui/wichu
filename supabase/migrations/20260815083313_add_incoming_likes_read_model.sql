create policy "swipes_select_incoming_likes"
on public.swipes for select to authenticated
using (
  target_id = (select auth.uid())
  and action = 'like'::public.swipe_action
);

create function public.get_my_incoming_likes(p_limit integer default 50)
returns table (
  profile_id uuid,
  display_name varchar(50),
  birth_date date,
  country_code varchar(2),
  last_active_at timestamptz,
  distance_km integer,
  is_gold_pass boolean,
  liked_at timestamptz,
  photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    liker.id,
    liker.display_name,
    liker.birth_date,
    liker.country_code,
    liker.last_active_at,
    private.profile_distance_km(liker.id),
    private.has_active_gold(liker.id),
    incoming.created_at,
    (
      select photo.storage_path
      from public.profile_photos photo
      where photo.profile_id = liker.id
      order by photo.position
      limit 1
    )
  from public.swipes incoming
  join public.profiles liker on liker.id = incoming.swiper_id
  where incoming.target_id = (select auth.uid())
    and incoming.action = 'like'::public.swipe_action
    and liker.is_active
    and liker.profile_completed
    and liker.review_status = 'approved'
    and not private.is_blocked_between(liker.id)
    and not exists (
      select 1
      from public.swipes mine
      where mine.swiper_id = (select auth.uid())
        and mine.target_id = liker.id
    )
  order by private.has_active_gold(liker.id) desc, incoming.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.get_my_incoming_likes(integer) from public, anon;
grant execute on function public.get_my_incoming_likes(integer) to authenticated;
