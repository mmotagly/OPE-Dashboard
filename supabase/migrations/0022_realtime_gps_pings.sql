-- Enables Supabase Realtime (postgres_changes) on vehicle_gps_pings so the
-- fleet map can subscribe to new pings instead of polling. Idempotent —
-- adding a table to a publication twice errors, so this checks first.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'vehicle_gps_pings'
  ) then
    alter publication supabase_realtime add table vehicle_gps_pings;
  end if;
end $$;
