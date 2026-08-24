import { createClient } from "@/lib/supabase/server";
import { loadLookups, type LookupOption } from "@/lib/lookups";
import type { PmStatus } from "@/lib/format";

/**
 * Read side of the daily operations module. Every shape the pages need is
 * loaded here so the components stay presentational.
 *
 * Supabase rows are untyped until `npx supabase gen types` has run, so each
 * query result is narrowed onto an explicit type below.
 */

export type ShiftOption = { id: string; code: string; labelEn: string };
export type VehicleOption = {
  id: string;
  vehicleCode: string;
  plateNumber: string;
  currentOdometerKm: number | null;
  defaultDriverId: string | null;
};
export type DriverOption = { id: string; driverCode: string; driverName: string };
export type RouteOption = { id: string; routeCode: string; routeName: string };
export type StatusOption = LookupOption;

export type PickerOptions = {
  shifts: ShiftOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  routes: RouteOption[];
  statuses: StatusOption[];
};

export type OperationRow = {
  id: string;
  code: string;
  date: string;
  shiftId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  routeId: string | null;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
  vehicleCode: string;
  plate: string;
  vendorName: string | null;
  driverName: string | null;
  driverCode: string | null;
  routeName: string | null;
  routeCode: string | null;
  startKm: number | null;
  endKm: number | null;
  /** The generated column, not end-minus-start worked out here. */
  distanceKm: number | null;
  operatingPct: number | null;
  batteryStart: number | null;
  batteryEnd: number | null;
  driverTips: number | null;
  remarks: string | null;
};

/** Values the edit form needs, keyed the way the zod schema expects them. */
export type OperationFormValues = {
  operationDate: string;
  shiftTypeId: string;
  vehicleId: string;
  statusId: string;
  driverId: string;
  routeId: string;
  startingKm: string;
  endingKm: string;
  operatingPct: string;
  startingBatteryPct: string;
  endingBatteryPct: string;
  driverTips: string;
  remarks: string;
};

const SELECT = `
  id,
  operation_code,
  operation_date,
  shift_type_id,
  vehicle_id,
  driver_id,
  route_id,
  status_id,
  operating_percentage,
  starting_odometer_km,
  ending_odometer_km,
  total_distance_km,
  starting_battery_pct,
  ending_battery_pct,
  driver_tips,
  remarks,
  vehicles ( id, vehicle_code, plate_number ),
  drivers ( id, driver_code, driver_name ),
  routes ( id, route_code, route_name ),
  vendors ( vendor_name )
`;

/** PostgREST returns an embedded row as an object, or an array on some joins. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(o: any, statuses: Map<string, LookupOption>): OperationRow {
  const vehicle = one<any>(o.vehicles);
  const driver = one<any>(o.drivers);
  const route = one<any>(o.routes);
  const vendor = one<any>(o.vendors);
  const status = o.status_id ? statuses.get(String(o.status_id)) : undefined;

  return {
    id: String(o.id),
    code: text(o.operation_code),
    date: text(o.operation_date),
    shiftId: o.shift_type_id ? String(o.shift_type_id) : null,
    vehicleId: o.vehicle_id ? String(o.vehicle_id) : null,
    driverId: o.driver_id ? String(o.driver_id) : null,
    routeId: o.route_id ? String(o.route_id) : null,
    statusId: o.status_id ? String(o.status_id) : null,
    statusCode: status?.code ?? null,
    statusLabel: status?.labelEn ?? null,
    vehicleCode: vehicle?.vehicle_code ?? "—",
    plate: vehicle?.plate_number ?? "—",
    vendorName: vendor?.vendor_name ?? null,
    driverName: driver?.driver_name ?? null,
    driverCode: driver?.driver_code ?? null,
    routeName: route?.route_name ?? null,
    routeCode: route?.route_code ?? null,
    startKm: num(o.starting_odometer_km),
    endKm: num(o.ending_odometer_km),
    distanceKm: num(o.total_distance_km),
    operatingPct: num(o.operating_percentage),
    batteryStart: num(o.starting_battery_pct),
    batteryEnd: num(o.ending_battery_pct),
    driverTips: num(o.driver_tips),
    remarks: o.remarks ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadShifts(): Promise<ShiftOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lookups")
    .select("id, code, label_en")
    .eq("category", "shift_type")
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((l: { id: string; code: string; label_en: string }) => ({
    id: String(l.id),
    code: String(l.code),
    labelEn: String(l.label_en),
  }));
}

/** operation_status id -> {code, labelEn}. Resolves status onto a row without
 * an embed — daily_vehicle_operations has two FKs into lookups
 * (shift_type_id, status_id), so an embedded `lookups(...)` select is
 * ambiguous; shift_type_id is resolved the same way via the shifts list. */
async function loadStatusMap(): Promise<Map<string, LookupOption>> {
  const statuses = await loadLookups("operation_status", { includeInactive: true });
  return new Map(statuses.map((s) => [s.id, s]));
}

export async function loadPickerOptions(): Promise<PickerOptions> {
  const supabase = await createClient();

  const [shifts, statuses, vehicles, drivers, routes] = await Promise.all([
    loadShifts(),
    loadLookups("operation_status"),
    supabase
      .from("vehicles")
      .select("id, vehicle_code, plate_number, current_odometer_km, default_driver_id")
      .order("vehicle_code"),
    supabase.from("drivers").select("id, driver_code, driver_name").order("driver_code"),
    supabase.from("routes").select("id, route_code, route_name").order("route_code"),
  ]);

  return {
    shifts,
    statuses,
    vehicles: (vehicles.data ?? []).map(
      (v: {
        id: string;
        vehicle_code: string;
        plate_number: string;
        current_odometer_km: number | null;
        default_driver_id: string | null;
      }) => ({
        id: String(v.id),
        vehicleCode: String(v.vehicle_code),
        plateNumber: String(v.plate_number),
        currentOdometerKm: num(v.current_odometer_km),
        defaultDriverId: v.default_driver_id ? String(v.default_driver_id) : null,
      }),
    ),
    drivers: (drivers.data ?? []).map(
      (d: { id: string; driver_code: string; driver_name: string }) => ({
        id: String(d.id),
        driverCode: String(d.driver_code),
        driverName: String(d.driver_name),
      }),
    ),
    routes: (routes.data ?? []).map(
      (r: { id: string; route_code: string; route_name: string }) => ({
        id: String(r.id),
        routeCode: String(r.route_code),
        routeName: String(r.route_name),
      }),
    ),
  };
}

export async function loadOperations({
  date,
  shiftId,
  limit = 200,
}: {
  date?: string;
  shiftId?: string;
  limit?: number;
}): Promise<OperationRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("daily_vehicle_operations")
    .select(SELECT)
    .order("operation_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (date) query = query.eq("operation_date", date);
  if (shiftId) query = query.eq("shift_type_id", shiftId);

  const [{ data }, statuses] = await Promise.all([query, loadStatusMap()]);
  return (data ?? []).map((row) => toRow(row, statuses));
}

export async function loadOperation(id: string): Promise<OperationRow | null> {
  const supabase = await createClient();
  const [{ data }, statuses] = await Promise.all([
    supabase.from("daily_vehicle_operations").select(SELECT).eq("id", id).maybeSingle(),
    loadStatusMap(),
  ]);

  return data ? toRow(data, statuses) : null;
}

export function toFormValues(row: OperationRow): OperationFormValues {
  const n = (v: number | null) => (v === null ? "" : String(v));
  return {
    operationDate: row.date,
    shiftTypeId: row.shiftId ?? "",
    vehicleId: row.vehicleId ?? "",
    statusId: row.statusId ?? "",
    driverId: row.driverId ?? "",
    routeId: row.routeId ?? "",
    startingKm: n(row.startKm),
    endingKm: n(row.endKm),
    operatingPct: n(row.operatingPct),
    startingBatteryPct: n(row.batteryStart),
    endingBatteryPct: n(row.batteryEnd),
    driverTips: n(row.driverTips),
    remarks: row.remarks ?? "",
  };
}

export type NearestPm = {
  partName: string;
  status: PmStatus;
  kmRemaining: number | null;
  intervalKm: number | null;
  scheduledKm: number | null;
};

/**
 * Nearest due periodic maintenance item for a vehicle. Read straight from
 * v_periodic_maintenance — the status is the database's, never recomputed here.
 */
export async function loadNearestPm(vehicleId: string): Promise<NearestPm | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_periodic_maintenance")
    .select("part_name, maintenance_status, km_remaining, interval_km, scheduled_km")
    .eq("vehicle_id", vehicleId)
    .not("km_remaining", "is", null)
    .order("km_remaining", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    partName: String(data.part_name),
    status: data.maintenance_status as PmStatus,
    kmRemaining: num(data.km_remaining),
    intervalKm: num(data.interval_km),
    scheduledKm: num(data.scheduled_km),
  };
}

/**
 * Nearest due PM item for several vehicles in one query — avoids one
 * `loadNearestPm` round trip per row on pages like Day Board that show many
 * vehicles at once. Same source view and ordering as `loadNearestPm`.
 */
export async function loadNearestPmForVehicles(
  vehicleIds: string[],
): Promise<Map<string, NearestPm>> {
  const result = new Map<string, NearestPm>();
  if (vehicleIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_periodic_maintenance")
    .select("vehicle_id, part_name, maintenance_status, km_remaining, interval_km, scheduled_km")
    .in("vehicle_id", vehicleIds)
    .not("km_remaining", "is", null)
    .order("km_remaining", { ascending: true });

  for (const row of data ?? []) {
    const vehicleId = String(row.vehicle_id);
    if (result.has(vehicleId)) continue;
    result.set(vehicleId, {
      partName: String(row.part_name),
      status: row.maintenance_status as PmStatus,
      kmRemaining: num(row.km_remaining),
      intervalKm: num(row.interval_km),
      scheduledKm: num(row.scheduled_km),
    });
  }

  return result;
}
