"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { guardMaster, isDenied } from "@/lib/master";
import { dbErrorText, dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import { codeMapFromLookups, importFromFormData, loadCodeMap, type ImportFormState } from "@/lib/csv-import";
import { loadLookups } from "@/lib/lookups";
import { vehicleSchema, parseVehicleForm, type VehicleInput } from "./schema";

/**
 * Vehicle master data. Supervisor and above only — `guardMaster` rejects
 * `data_admin` here as well as hiding the buttons, and RLS rejects it again.
 */

const UNIQUE_FIELDS = {
  vehicle_code: "vehicleCode",
  plate_number: "plateNumber",
};

function toRow(input: VehicleInput) {
  return {
    vehicle_code: input.vehicleCode,
    plate_number: input.plateNumber,
    vendor_id: input.vendorId,
    vehicle_type_id: input.vehicleTypeId,
    fuel_type_id: input.fuelTypeId,
    battery_capacity_kwh: input.batteryCapacityKwh,
    license_expiry_date: input.licenseExpiryDate,
    default_driver_id: input.defaultDriverId,
    status_id: input.statusId,
  };
}

export async function createVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert(toRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, UNIQUE_FIELDS);

  revalidatePath("/[locale]/vehicles", "page");
  return redirect({
    href: { pathname: "/vehicles", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateVehicle(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update(toRow(parsed.data)).eq("id", id);

  if (error) return dbErrorToState(error, UNIQUE_FIELDS);

  revalidatePath("/[locale]/vehicles", "page");
  return redirect({
    href: { pathname: "/vehicles", query: { selected: id } },
    locale: gate.locale,
  });
}

/**
 * Seeds this vehicle's PM schedule from the parts catalogue. The function owns
 * which parts qualify and what the intervals are; nothing is decided here.
 */
export async function buildPmSchedule(
  vehicleId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_init_pm_schedules", {
    p_vehicle_id: vehicleId,
  });

  if (error) return dbErrorToState(error);

  revalidatePath("/[locale]/vehicles", "page");
  return { formError: null, fieldErrors: {} };
}

/**
 * CSV import (roadmap: CSV Import/Export). Runs every row through the same
 * `vehicleSchema` + `toRow` the manual form uses — only the FK resolution
 * (code -> id, from the human-readable columns a spreadsheet can hold) is
 * import-specific.
 */
export async function importVehicles(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const [vendorCodes, driverCodes, vehicleTypes, fuelTypes, statuses] = await Promise.all([
    loadCodeMap(supabase, "vendors", "vendor_code"),
    loadCodeMap(supabase, "drivers", "driver_code"),
    loadLookups("vehicle_type").then(codeMapFromLookups),
    loadLookups("fuel_type").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);

  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id
      ? { id, error: null }
      : { id: null, error: `Unknown ${field} "${code}"` };
  };

  const result = await importFromFormData(formData, async (record) => {
    const vendor = resolve(vendorCodes, record.vendor_code, "vendor_code");
    if (vendor.error) return vendor.error;
    const driver = resolve(driverCodes, record.default_driver_code, "default_driver_code");
    if (driver.error) return driver.error;
    const type = resolve(vehicleTypes, record.vehicle_type_code, "vehicle_type_code");
    if (type.error) return type.error;
    const fuel = resolve(fuelTypes, record.fuel_type_code, "fuel_type_code");
    if (fuel.error) return fuel.error;
    const status = resolve(statuses, record.status_code, "status_code");
    if (status.error) return status.error;

    const parsed = vehicleSchema.safeParse({
      vehicleCode: record.vehicle_code,
      plateNumber: record.plate_number,
      vendorId: vendor.id ?? "",
      vehicleTypeId: type.id ?? "",
      fuelTypeId: fuel.id ?? "",
      batteryCapacityKwh: record.battery_capacity_kwh,
      licenseExpiryDate: record.license_expiry_date,
      defaultDriverId: driver.id ?? "",
      statusId: status.id ?? "",
    });
    if (!parsed.success) {
      return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    const { error } = await supabase.from("vehicles").insert(toRow(parsed.data));
    return error ? dbErrorText(error) : null;
  });

  if (result.formError) return { formError: result.formError, report: null };

  revalidatePath("/[locale]/vehicles", "page");
  return { formError: null, report: result.report };
}
