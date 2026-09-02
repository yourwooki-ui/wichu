-- Fetch only the active match required by a chat room. This avoids loading the
-- entire chat list while preserving the same participant, block, and photo
-- visibility checks as get_my_match_connections.
create function public.get_my_match_connection(p_match_id uuid)
returns table (
  match_id uuid,
  matched_at timestamptz,
  profile_id uuid,
  display_name varchar(50),
  country_code varchar(2),
  last_active_at timestamptz,
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as id
  )
  select
    connection.id,
    connection.matched_at,
    partner.id,
    partner.display_name,
    partner.country_code,
    partner.last_active_at,
    primary_photo.storage_path
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
      and photo.review_status = 'approved'::public.profile_review_status
    order by photo.position
    limit 1
  ) primary_photo on true
  where caller.id is not null
    and connection.id = p_match_id
    and connection.status = 'active'::public.match_status
    and caller.id in (connection.user_a, connection.user_b)
    and not private.is_blocked_between(partner.id)
  limit 1;
$$;

revoke all on function public.get_my_match_connection(uuid)
from public, anon, authenticated;
grant execute on function public.get_my_match_connection(uuid)
to authenticated, service_role;

alter table public.product_events
drop constraint product_events_known_event;

alter table public.product_events
add constraint product_events_known_event check (
  event_name in (
    'app_opened',
    'app_error',
    'profile_completed',
    'discover_viewed',
    'discover_empty',
    'discovery_filters_saved',
    'swipe_recorded',
    'match_created',
    'chat_opened',
    'message_sent',
    'message_safety_warning',
    'profile_reported',
    'profile_blocked',
    'date_plan_shared',
    'purchase_viewed',
    'purchase_started',
    'purchase_cancelled',
    'purchase_failed',
    'purchase_completed',
    'purchase_restored'
  )
);
