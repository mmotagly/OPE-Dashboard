import { createServiceClient } from "@/lib/supabase/service";
import type { NormalizedGpsPing } from "./types";

/**
 * Below this, GPS-derived speed is noise, not motion — smartphone GPS
 * position accuracy (~3-5m) alone produces phantom "speed" close to this
 * size even standing still. Applied to every final speed value (device- or
 * fallback-derived) so a stationary vehicle settles to a clean 0 instead of
 * a jittering near-zero number.
 */
const SPEED_DEADBAND_KMH = 1.5;

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
  const rows = await Promise.all(
    pings.map(async (p) => ({
      vehicle_id: p.vehicleId,
      recorded_at: p.recordedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      speed_kmh: await resolveSpeedKmh(supabase, p),
      heading_deg: p.headingDeg,
      odometer_km: p.odometerKm,
      ignition_on: p.ignitionOn,
      provider,
      raw_payload: p.rawPayload,
    })),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("vehicle_gps_pings").insert(rows);
  if (error) throw error;

  return rows.length;
}

/**
 * Trusts the device/provider's own speed when it supplied one — that's
 * Doppler-derived and more accurate than anything we can compute from two
 * positions. Falls back to a distance/time estimate against the vehicle's
 * immediately-preceding ping only when the source gave nothing at all
 * (e.g. a background-delivered Android fix with no computed speed), so a
 * missing sensor reading doesn't just show as a permanently stuck value.
 */
async function resolveSpeedKmh(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  p: NormalizedGpsPing,
): Promise<number | null> {
  const kmh = p.speedKmh ?? (await fallbackSpeedFromPriorPing(supabase, p));
  if (kmh === null) return null;
  return kmh < SPEED_DEADBAND_KMH ? 0 : kmh;
}

async function fallbackSpeedFromPriorPing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  p: NormalizedGpsPing,
): Promise<number | null> {
  const { data } = await supabase
    .from("vehicle_gps_pings")
    .select("recorded_at, latitude, longitude")
    .eq("vehicle_id", p.vehicleId)
    .lt("recorded_at", p.recordedAt)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const elapsedSec = (new Date(p.recordedAt).getTime() - new Date(data.recorded_at).getTime()) / 1000;
  if (elapsedSec <= 0) return null;

  const distanceM = haversineMeters(data.latitude, data.longitude, p.latitude, p.longitude);
  return (distanceM / elapsedSec) * 3.6;
}

/** Great-circle distance in meters. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
