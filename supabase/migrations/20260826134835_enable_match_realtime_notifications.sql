-- Messages are already in the Realtime publication. Matches need the same
-- foreground delivery path so a participant can receive an in-app banner when
-- the other user's Pick creates the match. Existing participant RLS remains the
-- authorization boundary; adding a table to the publication grants no row access.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end
$$;
