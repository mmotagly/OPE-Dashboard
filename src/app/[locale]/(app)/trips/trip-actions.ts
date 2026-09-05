"use server";

import { revalidatePath } from "next/cache";
import { canWriteOps } from "@/lib/auth";
import { deniedAction, makeActionGuard } from "@/lib/action-guard";
import { UNIQUE_VIOLATION, type DbError } from "@/lib/forms";
import { tripsDb } from "@/lib/trips-db";
import {
  parseTripsBatch,
  type SaveTripsState,
  type TripDraft,
  type TripSaveResult,
  type TripStopDraft,
} from "./trip-schema";

/**
 * Saves every trip in the entry grid for one shift in a single round trip.
 *
 * Deliberately never redirects, unlike most create/edit actions in this app:
 * the grid is an ongoing data-entry session (a clerk adding 10+ trips across
 * a shift), not a one-shot form, so a successful save just reconciles state
 * in place — a brand-new row's `id: null` becomes a real id via the returned
 * results, and the grid stays open for the next trip. Partial failure is
 * expected and reported per row, same as `createBulkPlanned` in the
 * Operations module.
 */

const guardOps = makeActionGuard(canWriteOps);
const denied = deniedAction;

const refresh = () => revalidatePath("/[locale]/trips", "page");

const errorText = (e: DbError) => `${e.message ?? ""} ${e.details ?? ""}`;

const isCodeCollision = (e: DbError) =>
  e.code === UNIQUE_VIOLATION && errorText(e).includes("trip_code");

/** `trip_code` is `not null unique` with no default, so the application
 * supplies it — same numbered-per-day retry loop as operation_code and
 * charging_session_code. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextTripCode(supabase: any, date: string, attempt: number): Promise<string> {
  const { count } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("trip_date", date);

  const sequence = (count ?? 0) + 1 + attempt;
  return `TRP-${date.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Replaces one trip's stop set with exactly the draft's: deletes whatever
 * isn't in it, then upserts the rest on the (trip_id, direction,
 * route_station_id) unique constraint, so an unchanged stop is a no-op
 * write rather than a delete-then-reinsert.
 */
async function applyStops(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  stops: TripStopDraft[],
): Promise<DbError | null> {
  const keys = new Set(stops.map((s) => `${s.direction}:${s.routeStationId}`));

  const { data: existing } = await supabase
    .from("trip_stops")
    .select("direction, route_station_id")
    .eq("trip_id", tripId);

  const toDelete = ((existing ?? []) as { direction: string; route_station_id: string }[]).filter(
    (s) => !keys.has(`${s.direction}:${s.route_station_id}`),
  );

  for (const s of toDelete) {
    const { error } = await supabase
      .from("trip_stops")
      .delete()
      .eq("trip_id", tripId)
      .eq("direction", s.direction)
      .eq("route_station_id", s.route_station_id);
    if (error) return error;
  }

  if (stops.length === 0) return null;

  const { error } = await supabase.from("trip_stops").upsert(
    stops.map((s) => ({
      trip_id: tripId,
      direction: s.direction,
      route_station_id: s.routeStationId,
      departure_at: s.departureAt,
    })),
    { onConflict: "trip_id,direction,route_station_id" },
  );

  return error ?? null;
}

export async function saveTrips(
  _prev: SaveTripsState,
  formData: FormData,
): Promise<SaveTripsState> {
  const gate = await guardOps();
  if (denied(gate)) return { ...gate, results: null };

  const parsed = parseTripsBatch(formData);
  if (!parsed.success) {
    return { formError: parsed.error, fieldErrors: {}, results: null };
  }

  const supabase = await tripsDb();
  const { operationId } = parsed.data;

  // A row the user added but never entered a single stop time for is a
  // scratch row, not a trip — dropped silently rather than rejected.
  const draftTrips: TripDraft[] = parsed.data.trips.filter((t) => t.stops.length > 0);

  const { data: existingRows } = await supabase
    .from("trips")
    .select("id, route_id")
    .eq("operation_id", operationId);
  const existing = (existingRows ?? []) as { id: string; route_id: string }[];

  const keptIds = new Set(draftTrips.map((t) => t.id).filter((id): id is string => id !== null));
  const droppedIds = existing.map((t) => t.id).filter((id) => !keptIds.has(id));

  if (droppedIds.length > 0) {
    await supabase.from("trips").delete().in("id", droppedIds);
  }

  // Only needed to number a brand-new trip's code — read once, not per trip.
  let tripDate: string | null = null;
  if (draftTrips.some((t) => t.id === null)) {
    const { data: op } = await supabase
      .from("daily_vehicle_operations")
      .select("operation_date")
      .eq("id", operationId)
      .maybeSingle();
    tripDate = op ? String(op.operation_date) : new Date().toISOString().slice(0, 10);
  }

  const results: TripSaveResult[] = [];

  for (const trip of draftTrips) {
    const existingRow = trip.id ? existing.find((e) => e.id === trip.id) : undefined;

    let tripId: string | null = trip.id;
    let stepError: DbError | null = null;

    if (tripId && existingRow) {
      if (existingRow.route_id !== trip.routeId) {
        const { error } = await supabase
          .from("trips")
          .update({ route_id: trip.routeId })
          .eq("id", tripId);
        stepError = error ?? null;
      }
    } else {
      let created: string | null = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const trip_code = await nextTripCode(supabase, tripDate ?? "", attempt);
        const { data, error } = await supabase
          .from("trips")
          .insert({ operation_id: operationId, route_id: trip.routeId, trip_code })
          .select("id")
          .single();

        if (!error) {
          created = String(data.id);
          break;
        }
        stepError = error;
        if (!isCodeCollision(error)) break;
      }
      tripId = created;
    }

    if (!tripId) {
      results.push({
        clientKey: trip.clientKey,
        tripId: null,
        ok: false,
        reason: stepError?.code === UNIQUE_VIOLATION ? "duplicate" : "saveFailed",
      });
      continue;
    }

    const stopsError = await applyStops(supabase, tripId, trip.stops);

    results.push({
      clientKey: trip.clientKey,
      tripId,
      ok: !stepError && !stopsError,
      reason: stepError || stopsError ? "saveFailed" : null,
    });
  }

  refresh();
  return { formError: null, fieldErrors: {}, results };
}
