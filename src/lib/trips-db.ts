import { createClient } from "@/lib/supabase/server";

/**
 * Migration 0023 (trips, trip_stops, v_trip_summary, v_trip_headway_points,
 * fn_operation_trip_summary, fn_trip_headway_report) is newer than the
 * checked-in generated types — same gap `saved-filters-db.ts` documents for
 * `saved_filters`, here for a whole migration's worth of tables/views/
 * functions instead of one table. Centralizing the `as any` escape hatch
 * here keeps it out of every call site. Removable once types are
 * regenerated (`npx supabase gen types ...`).
 */
export async function tripsDb() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}
