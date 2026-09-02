"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { guardMaster, isDenied } from "@/lib/master";
import { dbErrorText, dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import {
  buildPreview,
  codeMapFromLookups,
  loadCodeMap,
  runPreviewedImport,
  type ImportFormState,
  type PreviewFormState,
  type RowValidation,
} from "@/lib/csv-import";
import { loadLookups } from "@/lib/lookups";
import {
  routeSchema,
  parseRouteForm,
  parseRouteStationsForm,
  parseStationForm,
  type RouteInput,
  type StationInput,
} from "./schema";

const ROUTE_UNIQUE = { route_code: "routeCode" };
const STATION_UNIQUE = { station_code: "stationCode" };

const routeRow = (input: RouteInput) => ({
  route_code: input.routeCode,
  route_name: input.routeName,
  route_distance_km: input.routeDistanceKm,
  number_of_stations: input.numberOfStations,
  standard_leg_time: input.standardLegTime,
  standard_round_trip_time: input.standardRoundTripTime,
  status_id: input.statusId,
});

const stationRow = (input: StationInput) => ({
  station_code: input.stationCode,
  station_name: input.stationName,
  status_id: input.statusId,
});

/* ---------------- routes ---------------- */

export async function createRoute(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseRouteForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes")
    .insert(routeRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, ROUTE_UNIQUE);

  revalidatePath("/[locale]/trips", "page");
  return redirect({
    href: { pathname: "/trips", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateRoute(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseRouteForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("routes").update(routeRow(parsed.data)).eq("id", id);

  if (error) return dbErrorToState(error, ROUTE_UNIQUE);

  revalidatePath("/[locale]/trips", "page");
  return redirect({
    href: { pathname: "/trips", query: { selected: id } },
    locale: gate.locale,
  });
}

/** CSV import (roadmap: CSV Import/Export). Two-step preview/confirm — see
 * vehicles/actions.ts. Routes only — the stop list stays out of scope,
 * see routes/schema.ts. */

const CSV_CODE_COLUMN = "route_code";

/** Optional fields only — a blank cell here leaves the existing value
 * alone on Update. */
const OPTIONAL_UPDATE_FIELDS: { column: string; key: string }[] = [
  { column: "route_distance_km", key: "route_distance_km" },
  { column: "number_of_stations", key: "number_of_stations" },
  { column: "standard_leg_time", key: "standard_leg_time" },
  { column: "standard_round_trip_time", key: "standard_round_trip_time" },
  { column: "status_code", key: "status_id" },
];

function makeRowValidator(statuses: Map<string, string>) {
  return async (record: Record<string, string>): Promise<RowValidation<RouteInput>> => {
    let statusId: string | null = null;
    if (record.status_code) {
      statusId = statuses.get(record.status_code) ?? null;
      if (!statusId) return { error: `Unknown status_code "${record.status_code}"` };
    }

    const parsed = routeSchema.safeParse({
      routeCode: record.route_code,
      routeName: record.route_name,
      routeDistanceKm: record.route_distance_km,
      numberOfStations: record.number_of_stations,
      standardLegTime: record.standard_leg_time,
      standardRoundTripTime: record.standard_round_trip_time,
      statusId: statusId ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    return { error: null, data: parsed.data };
  };
}

export async function previewImportRoutes(
  _prev: PreviewFormState,
  formData: FormData,
): Promise<PreviewFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", preview: null };

  const supabase = await createClient();
  const statuses = codeMapFromLookups(await loadLookups("generic_status"));
  const existingCodes = await loadCodeMap(supabase, "routes", "route_code");

  return buildPreview(formData, CSV_CODE_COLUMN, existingCodes, makeRowValidator(statuses));
}

export async function confirmImportRoutes(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const statuses = codeMapFromLookups(await loadLookups("generic_status"));
  const existingCodes = await loadCodeMap(supabase, "routes", "route_code");

  const report = await runPreviewedImport(
    formData,
    CSV_CODE_COLUMN,
    existingCodes,
    makeRowValidator(statuses),
    async (data, _rowNumber, codeOverride) => {
      const row = routeRow(data);
      if (codeOverride) row.route_code = codeOverride;
      const { error } = await supabase.from("routes").insert(row);
      return error ? dbErrorText(error) : null;
    },
    async (matchId, data, record) => {
      const row = routeRow(data);
      for (const f of OPTIONAL_UPDATE_FIELDS) {
        if (!record[f.column]) delete (row as Record<string, unknown>)[f.key];
      }
      const { error } = await supabase.from("routes").update(row).eq("id", matchId);
      return error ? dbErrorText(error) : null;
    },
  );

  revalidatePath("/[locale]/trips", "page");
  return { formError: null, report };
}

/* ---------------- stations ---------------- */

export async function createStation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseStationForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stations")
    .insert(stationRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, STATION_UNIQUE);

  revalidatePath("/[locale]/trips", "page");
  return redirect({
    href: { pathname: "/trips", query: { entity: "stations", selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateStation(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseStationForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stations")
    .update(stationRow(parsed.data))
    .eq("id", id);

  if (error) return dbErrorToState(error, STATION_UNIQUE);

  revalidatePath("/[locale]/trips", "page");
  return redirect({
    href: { pathname: "/trips", query: { entity: "stations", selected: id } },
    locale: gate.locale,
  });
}

/* ---------------- the stop list ---------------- */

type Stop = { id: string; station_id: string };

/**
 * Rewrites a route's sequence numbers to 1..n in the given order.
 *
 * `unique (route_id, sequence_number)` is not deferrable, so the rows are first
 * parked on negative numbers — which no live row can hold — and only then given
 * their final positions. Two statements, no intermediate collision.
 */
async function renumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routeId: string,
  ordered: Stop[],
) {
  const rows = (sequence: (index: number) => number) =>
    ordered.map((stop, index) => ({
      id: stop.id,
      route_id: routeId,
      station_id: stop.station_id,
      sequence_number: sequence(index),
    }));

  const parked = await supabase.from("route_stations").upsert(rows((i) => -(i + 1)));
  if (parked.error) return parked.error;

  const settled = await supabase.from("route_stations").upsert(rows((i) => i + 1));
  return settled.error;
}

async function currentStops(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routeId: string,
): Promise<Stop[]> {
  const { data } = await supabase
    .from("route_stations")
    .select("id, station_id")
    .eq("route_id", routeId)
    .order("sequence_number");

  return (data ?? []).map((s) => ({ id: s.id, station_id: s.station_id }));
}

/**
 * Add, reorder and remove all arrive here so the editor has one error surface.
 * Reordering rewrites the whole route rather than swapping a pair, which keeps
 * the sequence gap-free.
 */
export async function editRouteStations(
  routeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseRouteStationsForm(formData);
  if (!parsed.success) {
    return { formError: "saveFailed", fieldErrors: {} };
  }

  const { intent, stationId, routeStationId } = parsed.data;
  const supabase = await createClient();
  const stops = await currentStops(supabase, routeId);

  if (intent === "add") {
    if (!stationId) return { formError: null, fieldErrors: { stationId: "required" } };
    if (stops.some((s) => s.station_id === stationId)) {
      return { formError: null, fieldErrors: { stationId: "stationAlreadyOnRoute" } };
    }

    const { error } = await supabase.from("route_stations").insert({
      route_id: routeId,
      station_id: stationId,
      sequence_number: stops.length + 1,
    });

    if (error) return dbErrorToState(error);
    revalidatePath("/[locale]/trips", "page");
    return { formError: null, fieldErrors: {} };
  }

  const index = stops.findIndex((s) => s.id === routeStationId);
  if (index === -1) return { formError: "saveFailed", fieldErrors: {} };

  if (intent === "remove") {
    const { error } = await supabase
      .from("route_stations")
      .delete()
      .eq("id", stops[index].id);

    if (error) return dbErrorToState(error);

    const remaining = stops.filter((_, i) => i !== index);
    const renumberError = await renumber(supabase, routeId, remaining);
    if (renumberError) return dbErrorToState(renumberError);

    revalidatePath("/[locale]/trips", "page");
    return { formError: null, fieldErrors: {} };
  }

  const target = intent === "moveUp" ? index - 1 : index + 1;
  if (target < 0 || target >= stops.length) {
    return { formError: null, fieldErrors: {} };
  }

  const reordered = [...stops];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  const renumberError = await renumber(supabase, routeId, reordered);
  if (renumberError) return dbErrorToState(renumberError);

  revalidatePath("/[locale]/trips", "page");
  return { formError: null, fieldErrors: {} };
}
