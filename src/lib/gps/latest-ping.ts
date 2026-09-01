import { createClient } from "@/lib/supabase/server";

/**
 * The one query behind every "where is this vehicle right now" UI —
 * `/fleet-location`'s table and the Daily Operations drawer's map both read
 * this. `v_vehicle_latest_gps` (migration 0019) already does the
 * distinct-on-latest-ping work; this just gives it a shared, typed callers
 * can both use instead of each hand-rolling the same untyped select.
 */
export type LatestGpsPing = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadLatestGpsPing(vehicleId: string): Promise<LatestGpsPing | null> {
  const supabase = await createClient();

  // Same defensive shape as fleet-location/queries.ts: a missing view
  // reports as `{ error }`, not a thrown exception, and either way "no
  // location data" is a real, expected state to degrade to, not a bug.
  try {
    const result = await (supabase as any)
      .from("v_vehicle_latest_gps")
      .select("latitude, longitude, recorded_at, speed_kmh")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (result.error || !result.data) return null;
    return {
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      recordedAt: result.data.recorded_at,
      speedKmh: result.data.speed_kmh,
    };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
