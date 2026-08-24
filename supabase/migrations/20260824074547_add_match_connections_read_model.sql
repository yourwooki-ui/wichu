create function public.get_my_match_connections(p_limit integer default 100)
returns table (
  match_id uuid,
  matched_at timestamptz,
  profile_id uuid,
  display_name varchar(50),
  birth_date date,
  country_code varchar(2),
  last_active_at timestamptz,
  photo_path text,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as id
  ),
  unread as (
    select counts.match_id, counts.unread_count
    from public.get_my_unread_counts() counts
  )
  select
    connection.id,
    connection.matched_at,
    partner.id,
    partner.display_name,
    partner.birth_date,
    partner.country_code,
    partner.last_active_at,
    primary_photo.storage_path,
    latest_message.content,
    latest_message.created_at,
    latest_message.sender_id,
    coalesce(unread.unread_count, 0)::bigint
  from public.matches connection
  cross join caller
  join public.profiles partner
    on partner.id = case
      when connection.user_a = caller.id then connection.user_b
      else connection.user_a
    end
  left join lateral (
    select photo.storage_path
    from public.profile_photos photo
    where photo.profile_id = partner.id
    order by photo.position
    limit 1
  ) primary_photo on true
  left join lateral (
    select message.content, message.created_at, message.sender_id
    from public.messages message
    where message.match_id = connection.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest_message on true
  left join unread on unread.match_id = connection.id
  where caller.id is not null
    and connection.status = 'active'::public.match_status
    and caller.id in (connection.user_a, connection.user_b)
  order by coalesce(latest_message.created_at, connection.matched_at) desc, connection.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_match_connections(integer) from public, anon;
grant execute on function public.get_my_match_connections(integer) to authenticated;
grant execute on function public.get_my_match_connections(integer) to service_role;
