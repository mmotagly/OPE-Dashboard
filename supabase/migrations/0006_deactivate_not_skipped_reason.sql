-- ============================================================================
-- 0006: Remove "Not Skipped" from the skip-reason options
-- ============================================================================
-- ('skip_reason','not_skipped','Not Skipped',5) from 0001_init.sql is a
-- contradiction as a reason FOR skipping something. Deactivated rather than
-- deleted, per this app's own convention (see Settings' deactivateHint):
-- values already referenced by historical skip records stay intact and
-- readable, they just stop appearing as a choice going forward — loadLookups()
-- only ever selects is_active = true rows.

update lookups set is_active = false
  where category = 'skip_reason' and code = 'not_skipped';
