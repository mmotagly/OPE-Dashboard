-- ============================================================================
-- 0008: lookup_categories read policy
-- ============================================================================
-- The real root cause of the empty Data Validation category dropdown: the
-- table has 12 rows (confirmed directly in the SQL editor), but the anon-key
-- API read returns zero (also confirmed directly) — a 200 with an empty
-- array, not a 401/403. That's the signature of RLS enabled with no policy
-- at all: PostgREST silently filters out every row for any role that isn't
-- the table owner, rather than raising a permission error. The SQL editor
-- runs as postgres and bypasses RLS entirely, which is why it saw all 12
-- rows while the app's own reads saw none.
--
-- This never showed up in 0001_init.sql's RLS section — lookup_categories
-- was never in that table list — so RLS here was almost certainly toggled on
-- later via the Supabase dashboard's Policies UI directly, without adding a
-- policy, rather than through any migration.
--
-- Idempotent: enabling RLS twice is a no-op, and the policy is dropped first
-- so this is safe to re-run.

alter table lookup_categories enable row level security;

drop policy if exists p_lookup_categories_read on lookup_categories;
create policy p_lookup_categories_read on lookup_categories
  for select using (can_read());
