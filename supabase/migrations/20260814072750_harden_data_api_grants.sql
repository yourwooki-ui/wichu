-- Make Data API exposure opt-in for every future public object.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions
  from public, anon, authenticated, service_role;

-- Keep the server-only role able to operate on the current public API surface.
-- New migrations must grant service_role access explicitly after this migration.
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Remove write privileges inherited from the old Supabase default ACL where the
-- application intentionally exposes a narrower authenticated API. RLS remains
-- enabled on every table; these grants are the outer Data API permission layer.
revoke update on table public.blocks from authenticated;
revoke insert, update, delete on table public.interests from authenticated;
revoke insert, update, delete on table public.matches from authenticated;
revoke update on table public.profile_interests from authenticated;
revoke update on table public.profile_tags from authenticated;
revoke update, delete on table public.reports from authenticated;
revoke insert, update, delete on table public.subscriptions from authenticated;
revoke delete on table public.user_settings from authenticated;
