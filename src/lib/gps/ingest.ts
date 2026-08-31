import { createServiceClient } from "@/lib/supabase/service";
import type { NormalizedGpsPing } from "./types";

/**
 * Writes normalized pings to `vehicle_gps_pings` via the service-role
 * client (webhook/poll routes have no logged-in user, so RLS's
 * can_write_ops() has nothing to check against). Shared by both the
 * webhook and poll routes so there's exactly one insert path regardless of
 * which pattern a provider turns out to need.
 */
export async function ingestPings(provider: string, pings: NormalizedGpsPing[]): Promise<number> {
  if (pings.length === 0) return 0;

  const supabase = createServiceClient();
  const rows = pings.map((p) => ({
    vehicle_id: p.vehicleId,
    recorded_at: p.recordedAt,
    latitude: p.latitude,
    longitude: p.longitude,
    speed_kmh: p.speedKmh,
    heading_deg: p.headingDeg,
    odometer_km: p.odometerKm,
    ignition_on: p.ignitionOn,
    provider,
    raw_payload: p.rawPayload,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("vehicle_gps_pings").insert(rows);
  if (error) throw error;

  return rows.length;
}
