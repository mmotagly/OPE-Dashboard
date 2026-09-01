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

/** A shuttle bus on a fixed local route will never legitimately hit this —
 * a last-resort clamp against any jitter-driven spike that slips past the
 * gates below. */
const SPEED_CEILING_KMH = 100;

/** Below this many seconds between consecutive pings, GPS position jitter
 * (~3-5m of noise) dominates a distance/time speed estimate — half the
 * normal ~10s ping cadence, chosen so a routine gap never gets discarded
 * but a suspiciously tight one (e.g. queued pings draining after a
 * reconnect) does. */
const MIN_RELIABLE_INTERVAL_SEC = 5;

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
 * Prefers the device's own speed when it's a real, non-zero reading —
 * Doppler-based, and doesn't depend on elapsed time between pings the way
 * a position-derived estimate does. Falls back to a distance/time estimate
 * against the vehicle's immediately-preceding ping only when the device
 * gave `0` or `null`.
 *
 * A first version of this combined the two via `Math.max()` — that was
 * itself the bug behind erratic real-world readings: `Math.max` doesn't
 * reduce noise, it keeps whichever of two independently-noisy sources
 * happens to be higher, so a spike from *either* side (a jittery device
 * reading, or a fallback computed over a too-short interval) always won.
 * Preferring one source over the other, with a minimum-interval gate on
 * the fallback and a sanity ceiling on the result, replaces that.
 *
 * (Android's native `Location.getSpeed()` returns `0.0`, not `null`,
 * whenever it has nothing real to report — the field is non-nullable on
 * Android; `expo-location`'s own type only documents `null` as a *Web*
 * possibility — which is why `0` is treated as "no real reading" here,
 * same as `null`.)
 */
async function resolveSpeedKmh(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  p: NormalizedGpsPing,
): Promise<number | null> {
  if (p.speedKmh !== null && p.speedKmh > 0) {
    return clampSpeed(p.speedKmh);
  }

  const fallback = await fallbackSpeedFromPriorPing(supabase, p);
  if (fallback === null) return p.speedKmh === null ? null : 0;

  return clampSpeed(fallback);
}

function clampSpeed(kmh: number): number {
  const deadbanded = kmh < SPEED_DEADBAND_KMH ? 0 : kmh;
  return Math.min(deadbanded, SPEED_CEILING_KMH);
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
  if (elapsedSec < MIN_RELIABLE_INTERVAL_SEC) return null;

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
