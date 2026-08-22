-- ============================================================================
-- 0005: RFR stage label wording fix
-- ============================================================================
-- "Skipped Next Trip" / "Skipped Next PM" read oddly next to "Skipped" —
-- these two are a deferral, not a drop, so they read better as an
-- instruction ("Skip Next Trip") than a past-tense state.
--
-- These are rows in `lookups` (category = 'rfr_stage'), not next-intl
-- strings — loadLookups() only ever selects label_en (never label_ar), so
-- stage labels render in English in both locales by design already; there is
-- no messages/*.json entry to update alongside this.

update lookups set label_en = 'Skip Next Trip'
  where category = 'rfr_stage' and code = 'skipped_next_trip';

update lookups set label_en = 'Skip Next PM'
  where category = 'rfr_stage' and code = 'skipped_next_pm';
