import { createClient } from "@/lib/supabase/server";
import { loadLookups, type LookupOption } from "@/lib/lookups";

/** The page lists one of two entities; `entity` in the URL says which. */
export type RouteEntity = "routes" | "stations";

export type RouteRow = {
  id: string;
  routeCode: string;
  routeName: string;
  routeDistanceKm: number | null;
  numberOfStations: number | null;
  standardLegTime: string | null;
  standardRoundTripTime: string | null;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
  /** Stations actually linked, as opposed to the manually kept count above. */
  linkedStations: number;
};

export type StationRow = {
  id: string;
  stationCode: string;
  stationName: string;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
};

/** One stop on a route, in sequence order. */
export type RouteStationRow = {
  id: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  sequenceNumber: number;
};

export type RouteFormValues = {
  routeCode: string;
  routeName: string;
  routeDistanceKm: string;
  numberOfStations: string;
  standardLegTime: string;
  standardRoundTripTime: string;
  statusId: string;
};

export type StationFormValues = {
  stationCode: string;
  stationName: string;
  statusId: string;
};

export type RouteOptions = {
  statuses: LookupOption[];
  /** Every station, for the "add a stop" picker. */
  stations: { id: string; stationCode: string; stationName: string }[];
};

const statusOf = (
  id: string | null,
  lookups: Map<string, LookupOption>,
): { code: string | null; label: string | null } => {
  const found = id ? lookups.get(id) : undefined;
  return { code: found?.code ?? null, label: found?.labelEn ?? null };
};

async function statusMap(): Promise<Map<string, LookupOption>> {
  // Resolving labels for whatever an existing row already points at — a
  // deactivated value should still show its real label here, not a dash.
  const statuses = await loadLookups("generic_status", { includeInactive: true });
  return new Map(statuses.map((l) => [l.id, l]));
}

export async function loadRoutes(search: string): Promise<RouteRow[]> {
  const supabase = await createClient();
  const lookups = await statusMap();

  let query = supabase
    .from("routes")
    .select(
      `id, route_code, route_name, route_distance_km, number_of_stations,
       standard_leg_time, standard_round_trip_time, status_id,
       route_stations ( id )`,
    )
    .order("route_code");

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`route_code.ilike.${term},route_name.ilike.${term}`);
  }

  const { data } = await query;

  return (data ?? []).map((r) => {
    const status = statusOf(r.status_id, lookups);
    return {
      id: r.id,
      routeCode: r.route_code,
      routeName: r.route_name,
      routeDistanceKm: r.route_distance_km,
      numberOfStations: r.number_of_stations,
      standardLegTime: r.standard_leg_time,
      standardRoundTripTime: r.standard_round_trip_time,
      statusId: r.status_id,
      statusCode: status.code,
      statusLabel: status.label,
      linkedStations: Array.isArray(r.route_stations) ? r.route_stations.length : 0,
    };
  });
}

export async function loadRoute(id: string): Promise<RouteRow | null> {
  const rows = await loadRoutes("");
  return rows.find((r) => r.id === id) ?? null;
}

export async function loadStations(search: string): Promise<StationRow[]> {
  const supabase = await createClient();
  const lookups = await statusMap();

  let query = supabase
    .from("stations")
    .select("id, station_code, station_name, status_id")
    .order("station_code");

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`station_code.ilike.${term},station_name.ilike.${term}`);
  }

  const { data } = await query;

  return (data ?? []).map((s) => {
    const status = statusOf(s.status_id, lookups);
    return {
      id: s.id,
      stationCode: s.station_code,
      stationName: s.station_name,
      statusId: s.status_id,
      statusCode: status.code,
      statusLabel: status.label,
    };
  });
}

export async function loadStation(id: string): Promise<StationRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    statusMap(),
    supabase
      .from("stations")
      .select("id, station_code, station_name, status_id")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!data) return null;
  const status = statusOf(data.status_id, lookups);
  return {
    id: data.id,
    stationCode: data.station_code,
    stationName: data.station_name,
    statusId: data.status_id,
    statusCode: status.code,
    statusLabel: status.label,
  };
}

/** A route's stops, ordered by the sequence column that the UI reorders. */
export async function loadRouteStations(routeId: string): Promise<RouteStationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_stations")
    .select("id, station_id, sequence_number, stations ( station_code, station_name )")
    .eq("route_id", routeId)
    .order("sequence_number");

  return (data ?? []).map((rs) => {
    const station = Array.isArray(rs.stations) ? rs.stations[0] : rs.stations;
    return {
      id: rs.id,
      stationId: rs.station_id,
      stationCode: station?.station_code ?? "—",
      stationName: station?.station_name ?? "—",
      sequenceNumber: rs.sequence_number,
    };
  });
}

export async function loadRouteOptions(): Promise<RouteOptions> {
  const supabase = await createClient();
  const [statuses, stations] = await Promise.all([
    loadLookups("generic_status"),
    supabase.from("stations").select("id, station_code, station_name").order("station_code"),
  ]);

  return {
    statuses,
    stations: (stations.data ?? []).map((s) => ({
      id: s.id,
      stationCode: s.station_code,
      stationName: s.station_name,
    })),
  };
}

export function toRouteFormValues(row: RouteRow): RouteFormValues {
  return {
    routeCode: row.routeCode,
    routeName: row.routeName,
    routeDistanceKm: row.routeDistanceKm === null ? "" : String(row.routeDistanceKm),
    numberOfStations: row.numberOfStations === null ? "" : String(row.numberOfStations),
    standardLegTime: row.standardLegTime ?? "",
    standardRoundTripTime: row.standardRoundTripTime ?? "",
    statusId: row.statusId ?? "",
  };
}

export function toStationFormValues(row: StationRow): StationFormValues {
  return {
    stationCode: row.stationCode,
    stationName: row.stationName,
    statusId: row.statusId ?? "",
  };
}

export const EMPTY_ROUTE_FORM: RouteFormValues = {
  routeCode: "",
  routeName: "",
  routeDistanceKm: "",
  numberOfStations: "",
  standardLegTime: "",
  standardRoundTripTime: "",
  statusId: "",
};

export const EMPTY_STATION_FORM: StationFormValues = {
  stationCode: "",
  stationName: "",
  statusId: "",
};
