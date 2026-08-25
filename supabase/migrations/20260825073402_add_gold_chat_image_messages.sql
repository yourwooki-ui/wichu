-- Gold members can send up to five private images in one chat message.
-- Image binaries live in a private Storage bucket; immutable metadata travels
-- with the message so Realtime subscribers receive a complete message row.

alter table public.messages
add column attachments jsonb not null default '[]'::jsonb;

alter table public.messages
drop constraint if exists messages_content_check;

alter table public.messages
add constraint messages_content_length_check
check (char_length(content) between 0 and 4000),
add constraint messages_attachments_shape_check
check (
  jsonb_typeof(attachments) = 'array'
  and jsonb_array_length(attachments) <= 5
),
add constraint messages_content_or_attachments_check
check (
  char_length(trim(content)) > 0
  or jsonb_array_length(attachments) > 0
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_media_objects_select_participant" on storage.objects;
create policy "chat_media_objects_select_participant"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-media'
  and exists (
    select 1
    from public.matches match
    where match.id::text = split_part(name, '/', 2)
      and match.status = 'active'::public.match_status
      and ((select auth.uid()) = match.user_a or (select auth.uid()) = match.user_b)
      and not private.is_blocked_between(
        case
          when (select auth.uid()) = match.user_a then match.user_b
          else match.user_a
        end
      )
  )
);

drop policy if exists "chat_media_objects_insert_gold_owner" on storage.objects;
create policy "chat_media_objects_insert_gold_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and private.has_active_gold((select auth.uid()))
  and exists (
    select 1
    from public.matches match
    where match.id::text = split_part(name, '/', 2)
      and match.status = 'active'::public.match_status
      and ((select auth.uid()) = match.user_a or (select auth.uid()) = match.user_b)
      and not private.is_blocked_between(
        case
          when (select auth.uid()) = match.user_a then match.user_b
          else match.user_a
        end
      )
  )
);

drop policy if exists "chat_media_objects_delete_owner" on storage.objects;
create policy "chat_media_objects_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-media'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create or replace function public.send_my_image_message(
  p_match_id uuid,
  p_client_id uuid,
  p_content text,
  p_original_language text default 'ko',
  p_attachments jsonb default '[]'::jsonb
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.messages;
  v_content text := trim(coalesce(p_content, ''));
  v_attachment_count integer;
  v_object_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_client_id is null or jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'Invalid message' using errcode = '22023';
  end if;

  v_attachment_count := jsonb_array_length(p_attachments);
  if v_attachment_count not between 1 and 5 or char_length(v_content) > 4000 then
    raise exception 'One to five images are required' using errcode = '22023';
  end if;
  if not private.has_active_gold(v_user_id) then
    raise exception 'Gold Pass required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) with ordinality as attachment(value, position)
    where jsonb_typeof(attachment.value) <> 'object'
      or nullif(attachment.value ->> 'path', '') is null
      or attachment.value ->> 'mimeType' not in ('image/jpeg', 'image/png', 'image/webp')
      or coalesce((attachment.value ->> 'width')::integer, 0) not between 1 and 20000
      or coalesce((attachment.value ->> 'height')::integer, 0) not between 1 and 20000
      or split_part(attachment.value ->> 'path', '/', 1) <> v_user_id::text
      or split_part(attachment.value ->> 'path', '/', 2) <> p_match_id::text
      or split_part(attachment.value ->> 'path', '/', 3) <> p_client_id::text
      or (attachment.value ->> 'path') !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[1-5]-[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) then
    raise exception 'Invalid image metadata' using errcode = '22023';
  end if;

  if (
    select count(distinct attachment.value ->> 'path')
    from jsonb_array_elements(p_attachments) as attachment(value)
  ) <> v_attachment_count then
    raise exception 'Duplicate image path' using errcode = '22023';
  end if;

  select message.* into v_message
  from public.messages message
  where message.sender_id = v_user_id
    and message.client_id = p_client_id;
  if v_message.id is not null then
    if v_message.match_id <> p_match_id
       or v_message.content <> v_content
       or v_message.attachments <> p_attachments then
      raise exception 'Message idempotency key conflict' using errcode = '23505';
    end if;
    return v_message;
  end if;

  if (
    select count(*)
    from public.messages recent
    where recent.sender_id = v_user_id
      and recent.created_at >= now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Message rate limit exceeded' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.matches match
    where match.id = p_match_id
      and match.status = 'active'::public.match_status
      and (v_user_id = match.user_a or v_user_id = match.user_b)
      and not private.is_blocked_between(
        case when v_user_id = match.user_a then match.user_b else match.user_a end
      )
  ) then
    raise exception 'Active match required' using errcode = '42501';
  end if;

  select count(*) into v_object_count
  from jsonb_array_elements(p_attachments) as attachment(value)
  join storage.objects object
    on object.bucket_id = 'chat-media'
   and object.name = attachment.value ->> 'path';
  if v_object_count <> v_attachment_count then
    raise exception 'Uploaded image not found' using errcode = '22023';
  end if;

  insert into public.messages (
    match_id,
    sender_id,
    client_id,
    content,
    original_language,
    attachments
  ) values (
    p_match_id,
    v_user_id,
    p_client_id,
    v_content,
    left(nullif(trim(coalesce(p_original_language, '')), ''), 16),
    p_attachments
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.send_my_image_message(uuid, uuid, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.send_my_image_message(uuid, uuid, text, text, jsonb)
to authenticated, service_role;

-- Keep the chat list useful for image-only messages without changing the
-- existing mobile read-model shape.
drop function public.get_my_match_connections(integer);
create function public.get_my_match_connections(p_limit integer default 100)
returns table (
  match_id uuid,
  matched_at timestamptz,
  profile_id uuid,
  display_name varchar(50),
  age integer,
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
security definer
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
    date_part('year', age(current_date, partner.birth_date))::integer,
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
      and photo.review_status = 'approved'::public.profile_review_status
    order by photo.position
    limit 1
  ) primary_photo on true
  left join lateral (
    select
      case
        when char_length(trim(message.content)) > 0 then message.content
        when jsonb_array_length(message.attachments) > 0
          then '사진 ' || jsonb_array_length(message.attachments)::text || '장'
        else null
      end as content,
      message.created_at,
      message.sender_id
    from public.messages message
    where message.match_id = connection.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest_message on true
  left join unread on unread.match_id = connection.id
  where caller.id is not null
    and connection.status = 'active'::public.match_status
    and caller.id in (connection.user_a, connection.user_b)
    and not private.is_blocked_between(partner.id)
  order by coalesce(latest_message.created_at, connection.matched_at) desc, connection.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_match_connections(integer)
from public, anon, authenticated;
grant execute on function public.get_my_match_connections(integer)
to authenticated, service_role;
