import { createClient } from "@/lib/supabase/server";

export type FleetLocationRow = {
  id: string;
  vehicleCode: string;
  plateNumber: string;
  vendorName: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  ignitionOn: boolean | null;
  recordedAt: string | null;
  provider: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadFleetLocations(): Promise<FleetLocationRow[]> {
  const supabase = await createClient();

  // Independent queries — run in parallel rather than one after the other.
  const [vehicles, pings] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, vehicle_code, plate_number, vendors ( vendor_name )")
      .order("vehicle_code"),
    loadLatestPings(supabase),
  ]);

  const pingByVehicle = new Map(pings.map((p) => [p.vehicle_id, p]));

  return (vehicles.data ?? []).map((v) => {
    const vendor = Array.isArray(v.vendors) ? v.vendors[0] : v.vendors;
    const ping = pingByVehicle.get(v.id);
    return {
      id: v.id,
      vehicleCode: v.vehicle_code,
      plateNumber: v.plate_number,
      vendorName: vendor?.vendor_name ?? null,
      latitude: ping?.latitude ?? null,
      longitude: ping?.longitude ?? null,
      speedKmh: ping?.speed_kmh ?? null,
      ignitionOn: ping?.ignition_on ?? null,
      recordedAt: ping?.recorded_at ?? null,
      provider: ping?.provider ?? null,
    };
  });
}

/**
 * v_vehicle_latest_gps (0019_gps_pings.sql) isn't in the generated types
 * yet, and the migration itself is still pending against the live database
 * (roadmap: GPS integration is schema-ready, not yet run) — so this query
 * can legitimately fail with "relation does not exist" right up until the
 * user applies it. Treated as "no GPS data yet", not an error, so the page
 * still renders every vehicle once the schema lands without a code change
 * here.
 */
async function loadLatestPings(supabase: any): Promise<any[]> {
  try {
    const result = await supabase.from("v_vehicle_latest_gps").select("*");
    // Supabase-js reports a missing relation as `{ error }`, not a thrown
    // exception — checked explicitly rather than relying on the catch below.
    return result.error ? [] : (result.data ?? []);
  } catch {
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
