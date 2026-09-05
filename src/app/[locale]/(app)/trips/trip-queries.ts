import { tripsDb } from "@/lib/trips-db";
import { loadLookups } from "@/lib/lookups";
import { loadRouteStations, type RouteStationRow } from "./queries";

/**
 * Real, timestamped trips — on top of the `routes`/`stations` reference data
 * in `queries.ts`, which this file never touches. See migration
 * 0023_trips.sql for the schema and the computed leg/round-trip/headway
 * functions this reads from instead of recomputing them here.
 */

export type TripDirection = "outbound" | "return";
export type TripSource = "manual" | "gps";

export type TripSummaryRow = {
  id: string;
  tripCode: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  operationId: string;
  tripDate: string;
  hasReturn: boolean;
  outboundStartAt: string | null;
  outboundLegMinutes: number | null;
  outboundLegDisplay: string | null;
  returnLegMinutes: number | null;
  returnLegDisplay: string | null;
  roundTripMinutes: number | null;
  roundTripDisplay: string | null;
  source: TripSource;
  createdAt: string;
};

export type TripStopDetail = {
  id: string;
  direction: TripDirection;
  routeStationId: string;
  stationCode: string;
  stationName: string;
  sequenceNumber: number;
  departureAt: string;
};

export type TripDetail = {
  id: string;
  tripCode: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  operationId: string;
  tripDate: string;
  outboundLegDisplay: string | null;
  returnLegDisplay: string | null;
  roundTripDisplay: string | null;
  stops: TripStopDetail[];
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toSummaryRow(r: Record<string, unknown>): TripSummaryRow {
  return {
    id: String(r.trip_id),
    tripCode: String(r.trip_code),
    vehicleId: String(r.vehicle_id),
    vehicleCode: String(r.vehicle_code),
    plateNumber: String(r.plate_number),
    routeId: String(r.route_id),
    routeCode: String(r.route_code),
    routeName: String(r.route_name),
    operationId: String(r.operation_id),
    tripDate: String(r.trip_date),
    hasReturn: Boolean(r.has_return),
    outboundStartAt: (r.outbound_start_at as string | null) ?? null,
    outboundLegMinutes: num(r.outbound_leg_minutes),
    outboundLegDisplay: (r.outbound_leg_display as string | null) ?? null,
    returnLegMinutes: num(r.return_leg_minutes),
    returnLegDisplay: (r.return_leg_display as string | null) ?? null,
    roundTripMinutes: num(r.round_trip_minutes),
    roundTripDisplay: (r.round_trip_display as string | null) ?? null,
    source: r.source === "gps" ? "gps" : "manual",
    createdAt: String(r.created_at),
  };
}

/** Recent trips, newest first — the FilterBar narrows further client-request-side,
 * same pattern as every other module's `load<Module>({})`. */
export async function loadTrips({ limit = 200 }: { limit?: number } = {}): Promise<
  TripSummaryRow[]
> {
  const supabase = await tripsDb();
  const { data } = await supabase
    .from("v_trip_summary")
    .select("*")
    .order("trip_date", { ascending: false })
    .order("outbound_start_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map(toSummaryRow);
}

export async function loadTrip(id: string): Promise<TripDetail | null> {
  const supabase = await tripsDb();

  const { data: summary } = await supabase
    .from("v_trip_summary")
    .select("*")
    .eq("trip_id", id)
    .maybeSingle();

  if (!summary) return null;

  const { data: stops } = await supabase
    .from("trip_stops")
    .select(
      "id, direction, departure_at, route_stations ( id, sequence_number, stations ( station_code, station_name ) )",
    )
    .eq("trip_id", id);

  const stopRows: TripStopDetail[] = ((stops ?? []) as Record<string, unknown>[]).map((s) => {
    const rs = (Array.isArray(s.route_stations) ? s.route_stations[0] : s.route_stations) as
      | Record<string, unknown>
      | undefined;
    const station = rs
      ? ((Array.isArray(rs.stations) ? rs.stations[0] : rs.stations) as
          | Record<string, unknown>
          | undefined)
      : undefined;

    return {
      id: String(s.id),
      direction: s.direction === "return" ? "return" : "outbound",
      routeStationId: rs ? String(rs.id) : "",
      stationCode: station ? String(station.station_code) : "—",
      stationName: station ? String(station.station_name) : "—",
      sequenceNumber: rs ? Number(rs.sequence_number) : 0,
      departureAt: String(s.departure_at),
    };
  });

  stopRows.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "outbound" ? -1 : 1;
    const bySeq = a.sequenceNumber - b.sequenceNumber;
    return a.direction === "outbound" ? bySeq : -bySeq;
  });

  const row = toSummaryRow(summary as Record<string, unknown>);

  return {
    id: row.id,
    tripCode: row.tripCode,
    vehicleId: row.vehicleId,
    vehicleCode: row.vehicleCode,
    plateNumber: row.plateNumber,
    routeId: row.routeId,
    routeCode: row.routeCode,
    routeName: row.routeName,
    operationId: row.operationId,
    tripDate: row.tripDate,
    outboundLegDisplay: row.outboundLegDisplay,
    returnLegDisplay: row.returnLegDisplay,
    roundTripDisplay: row.roundTripDisplay,
    stops: stopRows,
  };
}

/* ---------------- entry-grid support ---------------- */

export type TripEntryVehicleOption = { id: string; vehicleCode: string; plateNumber: string };
export type TripEntryShiftOption = { id: string; code: string; labelEn: string };
export type TripEntryRouteOption = { id: string; routeCode: string; routeName: string };

export type TripEntryOptions = {
  vehicles: TripEntryVehicleOption[];
  shifts: TripEntryShiftOption[];
  routes: TripEntryRouteOption[];
};

export async function loadTripEntryOptions(): Promise<TripEntryOptions> {
  const supabase = await tripsDb();

  const [vehicles, shifts, routes] = await Promise.all([
    supabase.from("vehicles").select("id, vehicle_code, plate_number").order("vehicle_code"),
    loadLookups("shift_type"),
    supabase.from("routes").select("id, route_code, route_name").order("route_code"),
  ]);

  return {
    vehicles: ((vehicles.data ?? []) as Record<string, unknown>[]).map((v) => ({
      id: String(v.id),
      vehicleCode: String(v.vehicle_code),
      plateNumber: String(v.plate_number),
    })),
    shifts: shifts.map((s) => ({ id: s.id, code: s.code, labelEn: s.labelEn })),
    routes: ((routes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      routeCode: String(r.route_code),
      routeName: String(r.route_name),
    })),
  };
}

export type TripEntryContext = {
  operationId: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  operationDate: string;
  shiftId: string;
};

function toEntryContext(data: Record<string, unknown>, fallbackVehicleId = ""): TripEntryContext {
  const vehicle = (Array.isArray(data.vehicles) ? data.vehicles[0] : data.vehicles) as
    | Record<string, unknown>
    | undefined;

  return {
    operationId: String(data.id),
    vehicleId: vehicle ? String(vehicle.id) : fallbackVehicleId,
    vehicleCode: vehicle ? String(vehicle.vehicle_code) : "",
    plateNumber: vehicle ? String(vehicle.plate_number) : "",
    operationDate: String(data.operation_date),
    shiftId: String(data.shift_type_id),
  };
}

/** Resolves the one (vehicle, date, shift) shift row a batch of trips
 * attaches to — trips always belong to an existing Operation, never create
 * one implicitly (see the Phase 1 plan: Operations is entered first). */
export async function loadTripEntryContext(
  vehicleId: string,
  date: string,
  shiftTypeId: string,
): Promise<TripEntryContext | null> {
  const supabase = await tripsDb();
  const { data } = await supabase
    .from("daily_vehicle_operations")
    .select("id, operation_date, shift_type_id, vehicles ( id, vehicle_code, plate_number )")
    .eq("vehicle_id", vehicleId)
    .eq("operation_date", date)
    .eq("shift_type_id", shiftTypeId)
    .maybeSingle();

  return data ? toEntryContext(data as Record<string, unknown>, vehicleId) : null;
}

/** Same shape, reached directly by id — used when arriving via a trip's own
 * "Edit" link, which already knows the operation rather than the (vehicle,
 * date, shift) triple. */
export async function loadOperationContext(operationId: string): Promise<TripEntryContext | null> {
  const supabase = await tripsDb();
  const { data } = await supabase
    .from("daily_vehicle_operations")
    .select("id, operation_date, shift_type_id, vehicles ( id, vehicle_code, plate_number )")
    .eq("id", operationId)
    .maybeSingle();

  return data ? toEntryContext(data as Record<string, unknown>) : null;
}

export type TripEntryExistingStop = {
  routeStationId: string;
  direction: TripDirection;
  departureAt: string;
};

export type TripEntryExistingTrip = {
  id: string;
  routeId: string;
  stops: TripEntryExistingStop[];
};

/** Every trip already logged for one shift, in the shape the entry grid
 * edits directly — reused for both "load the grid" and "diff on save". */
export async function loadTripsForOperation(operationId: string): Promise<TripEntryExistingTrip[]> {
  const supabase = await tripsDb();
  const { data } = await supabase
    .from("trips")
    .select("id, route_id, trip_stops ( route_station_id, direction, departure_at )")
    .eq("operation_id", operationId)
    .order("created_at");

  return ((data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: String(t.id),
    routeId: String(t.route_id),
    stops: ((Array.isArray(t.trip_stops) ? t.trip_stops : []) as Record<string, unknown>[]).map(
      (s) => ({
        routeStationId: String(s.route_station_id),
        direction: s.direction === "return" ? "return" : "outbound",
        departureAt: String(s.departure_at),
      }),
    ),
  }));
}

export type { RouteStationRow };
export { loadRouteStations };
