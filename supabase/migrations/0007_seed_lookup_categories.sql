-- ============================================================================
-- 0007: Seed lookup_categories
-- ============================================================================
-- lookup_categories is empty in the live database — confirmed by querying it
-- directly (unfiltered, via the public anon key; the table carries no RLS
-- policy, so this wasn't a permissions read, it genuinely has zero rows).
-- The `lookups` table itself is populated (0001_init.sql's insert into
-- lookups ran fine), so this one small reference table's own seed insert
-- from 0001_init.sql apparently never took. Nothing else in the app reads
-- lookup_categories directly — every other module gets its category labels
-- from next-intl strings — so this went unnoticed until Data Validation's
-- category dropdown, the first real consumer of this table, came up empty.
--
-- on conflict do update so this is safe to run regardless of whether some
-- rows already exist, and also repairs any label drift.

insert into lookup_categories (key, label) values
  ('vendor_type',          'Vendor Type'),
  ('vehicle_type',         'Vehicle Type'),
  ('fuel_type',            'Fuel Type'),
  ('license_grade',        'License Grade'),
  ('shift_type',           'Shift Type'),
  ('generic_status',       'Status'),
  ('rfr_stage',            'RFR Stage'),
  ('maintenance_type',     'Maintenance Type'),
  ('issue_type',           'Issue Type'),
  ('maintenance_category', 'Maintenance Category'),
  ('vehicle_status_after', 'Vehicle Status After Maintenance'),
  ('skip_reason',          'Skip Reason')
on conflict (key) do update set label = excluded.label;
