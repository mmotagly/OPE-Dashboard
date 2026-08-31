import { createClient } from "@/lib/supabase/server";
import { loadLookupSets, type LookupOption } from "@/lib/lookups";
import type { PmStatus } from "@/lib/format";

export type VehicleRow = {
  id: string;
  vehicleCode: string;
  plateNumber: string;
  vendorId: string;
  vendorName: string | null;
  vendorCode: string | null;
  vehicleTypeId: string | null;
  vehicleTypeLabel: string | null;
  vehicleTypeCode: string | null;
  fuelTypeId: string | null;
  fuelTypeLabel: string | null;
  fuelTypeCode: string | null;
  batteryCapacityKwh: number | null;
  licenseExpiryDate: string | null;
  defaultDriverId: string | null;
  defaultDriverName: string | null;
  defaultDriverCode: string | null;
  currentOdometerKm: number | null;
  currentOdometerDate: string | null;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
};

export type VehicleFormValues = {
  vehicleCode: string;
  plateNumber: string;
  vendorId: string;
  vehicleTypeId: string;
  fuelTypeId: string;
  batteryCapacityKwh: string;
  licenseExpiryDate: string;
  defaultDriverId: string;
  statusId: string;
};

export type VehicleOptions = {
  vendors: { id: string; vendorCode: string; vendorName: string }[];
  drivers: { id: string; driverCode: string; driverName: string }[];
  vehicleTypes: LookupOption[];
  fuelTypes: LookupOption[];
  statuses: LookupOption[];
};

/** One line of the vehicle's PM schedule, straight from the view. */
export type PmScheduleRow = {
  partName: string;
  status: PmStatus;
  intervalKm: number | null;
  lastServiceKm: number | null;
  scheduledKm: number | null;
  kmRemaining: number | null;
};

const SELECT = `
  id,
  vehicle_code,
  plate_number,
  vendor_id,
  vehicle_type_id,
  fuel_type_id,
  battery_capacity_kwh,
  license_expiry_date,
  default_driver_id,
  current_odometer_km,
  current_odometer_date,
  status_id,
  vendors ( vendor_code, vendor_name ),
  drivers ( driver_code, driver_name )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(v: any, lookups: Map<string, LookupOption>): VehicleRow {
  const vendor = Array.isArray(v.vendors) ? v.vendors[0] : v.vendors;
  const driver = Array.isArray(v.drivers) ? v.drivers[0] : v.drivers;
  const status = v.status_id ? lookups.get(v.status_id) : undefined;

  return {
    id: v.id,
    vehicleCode: v.vehicle_code,
    plateNumber: v.plate_number,
    vendorId: v.vendor_id,
    vendorName: vendor?.vendor_name ?? null,
    vendorCode: vendor?.vendor_code ?? null,
    vehicleTypeId: v.vehicle_type_id,
    vehicleTypeLabel: v.vehicle_type_id
      ? (lookups.get(v.vehicle_type_id)?.labelEn ?? null)
      : null,
    vehicleTypeCode: v.vehicle_type_id
      ? (lookups.get(v.vehicle_type_id)?.code ?? null)
      : null,
    fuelTypeId: v.fuel_type_id,
    fuelTypeLabel: v.fuel_type_id
      ? (lookups.get(v.fuel_type_id)?.labelEn ?? null)
      : null,
    fuelTypeCode: v.fuel_type_id
      ? (lookups.get(v.fuel_type_id)?.code ?? null)
      : null,
    batteryCapacityKwh: v.battery_capacity_kwh,
    licenseExpiryDate: v.license_expiry_date,
    defaultDriverId: v.default_driver_id,
    defaultDriverName: driver?.driver_name ?? null,
    defaultDriverCode: driver?.driver_code ?? null,
    currentOdometerKm: v.current_odometer_km,
    currentOdometerDate: v.current_odometer_date,
    statusId: v.status_id,
    statusCode: status?.code ?? null,
    statusLabel: status?.labelEn ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Every lookup a vehicle can reference, keyed by id. Resolving labels for
 * whatever an existing row already points at — a deactivated value should
 * still show its real label here, not a dash.
 */
async function lookupMap(): Promise<Map<string, LookupOption>> {
  const sets = await loadLookupSets(
    ["vehicle_type", "fuel_type", "generic_status"] as const,
    { includeInactive: true },
  );

  return new Map(
    [...sets.vehicle_type, ...sets.fuel_type, ...sets.generic_status].map((l) => [
      l.id,
      l,
    ]),
  );
}

export async function loadVehicles(search: string): Promise<VehicleRow[]> {
  const supabase = await createClient();
  const lookups = await lookupMap();

  let query = supabase.from("vehicles").select(SELECT).order("vehicle_code");
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term}`);
  }

  const { data } = await query;
  return (data ?? []).map((v) => toRow(v, lookups));
}

export async function loadVehicle(id: string): Promise<VehicleRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("vehicles").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  return data ? toRow(data, lookups) : null;
}

export async function loadVehicleOptions(): Promise<VehicleOptions> {
  const supabase = await createClient();

  const [sets, vendors, drivers] = await Promise.all([
    loadLookupSets(["vehicle_type", "fuel_type", "generic_status"] as const),
    supabase.from("vendors").select("id, vendor_code, vendor_name").order("vendor_code"),
    supabase.from("drivers").select("id, driver_code, driver_name").order("driver_code"),
  ]);

  return {
    vendors: (vendors.data ?? []).map((v) => ({
      id: v.id,
      vendorCode: v.vendor_code,
      vendorName: v.vendor_name,
    })),
    drivers: (drivers.data ?? []).map((d) => ({
      id: d.id,
      driverCode: d.driver_code,
      driverName: d.driver_name,
    })),
    vehicleTypes: sets.vehicle_type,
    fuelTypes: sets.fuel_type,
    statuses: sets.generic_status,
  };
}

/**
 * The vehicle's whole PM board. Status and km_remaining are the view's — the
 * only thing decided here is the sort.
 */
export async function loadPmSchedule(vehicleId: string): Promise<PmScheduleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_periodic_maintenance")
    .select(
      "part_name, maintenance_status, interval_km, last_service_km, scheduled_km, km_remaining",
    )
    .eq("vehicle_id", vehicleId)
    .order("km_remaining", { ascending: true, nullsFirst: false });

  return (data ?? []).map((p) => ({
    partName: p.part_name ?? "—",
    status: (p.maintenance_status ?? "no_km_data") as PmStatus,
    intervalKm: p.interval_km,
    lastServiceKm: p.last_service_km,
    scheduledKm: p.scheduled_km,
    kmRemaining: p.km_remaining,
  }));
}

/** Latest operation row, for the signature KM meter on the vehicle detail. */
export async function loadLatestOperation(vehicleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_vehicle_operations")
    .select("operation_date, starting_odometer_km, ending_odometer_km")
    .eq("vehicle_id", vehicleId)
    .order("operation_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    date: data.operation_date,
    startKm: data.starting_odometer_km,
    endKm: data.ending_odometer_km,
  };
}

export function toVehicleFormValues(row: VehicleRow): VehicleFormValues {
  return {
    vehicleCode: row.vehicleCode,
    plateNumber: row.plateNumber,
    vendorId: row.vendorId,
    vehicleTypeId: row.vehicleTypeId ?? "",
    fuelTypeId: row.fuelTypeId ?? "",
    batteryCapacityKwh:
      row.batteryCapacityKwh === null ? "" : String(row.batteryCapacityKwh),
    licenseExpiryDate: row.licenseExpiryDate ?? "",
    defaultDriverId: row.defaultDriverId ?? "",
    statusId: row.statusId ?? "",
  };
}

export const EMPTY_VEHICLE_FORM: VehicleFormValues = {
  vehicleCode: "",
  plateNumber: "",
  vendorId: "",
  vehicleTypeId: "",
  fuelTypeId: "",
  batteryCapacityKwh: "",
  licenseExpiryDate: "",
  defaultDriverId: "",
  statusId: "",
};
