grant usage on schema private to supabase_auth_admin;

create function private.hook_enforce_adult_signup(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  birth_date_text text;
  parsed_birth_date date;
begin
  birth_date_text := event->'user'->'user_metadata'->>'birth_date';

  if birth_date_text is null or birth_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'A valid date of birth is required to create a WICHU account.'
      )
    );
  end if;

  begin
    parsed_birth_date := birth_date_text::date;
  exception when others then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'A valid date of birth is required to create a WICHU account.'
      )
    );
  end;

  if parsed_birth_date > current_date - interval '18 years' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'WICHU is only available to users aged 18 or older.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function private.hook_enforce_adult_signup(jsonb) to supabase_auth_admin;
revoke execute on function private.hook_enforce_adult_signup(jsonb) from public, anon, authenticated;
