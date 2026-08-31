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
 * CSV import (roadmap: CSV Import/Export). Two-step preview/confirm — see
 * csv-import.ts's `buildPreview`/`runPreviewedImport`. Every row runs
 * through the same `vehicleSchema` the manual form uses; only the FK
 * resolution (code -> id, from the human-readable columns a spreadsheet
 * can hold) and the code-collision check are import-specific.
 */

const CSV_CODE_COLUMN = "vehicle_code";

/** Optional fields only — a blank cell here leaves the existing value
 * alone on Update rather than clearing it (required fields can never be
 * blank; a row with one is already an Error before reaching a decision). */
const OPTIONAL_UPDATE_FIELDS: { column: string; key: string }[] = [
  { column: "vehicle_type_code", key: "vehicle_type_id" },
  { column: "fuel_type_code", key: "fuel_type_id" },
  { column: "battery_capacity_kwh", key: "battery_capacity_kwh" },
  { column: "license_expiry_date", key: "license_expiry_date" },
  { column: "default_driver_code", key: "default_driver_id" },
  { column: "status_code", key: "status_id" },
];

async function loadImportMaps(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [vendorCodes, driverCodes, vehicleTypes, fuelTypes, statuses] = await Promise.all([
    loadCodeMap(supabase, "vendors", "vendor_code"),
    loadCodeMap(supabase, "drivers", "driver_code"),
    loadLookups("vehicle_type").then(codeMapFromLookups),
    loadLookups("fuel_type").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);
  return { vendorCodes, driverCodes, vehicleTypes, fuelTypes, statuses };
}

function makeRowValidator(maps: Awaited<ReturnType<typeof loadImportMaps>>) {
  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id ? { id, error: null } : { id: null, error: `Unknown ${field} "${code}"` };
  };

  return async (record: Record<string, string>): Promise<RowValidation<VehicleInput>> => {
    const vendor = resolve(maps.vendorCodes, record.vendor_code, "vendor_code");
    if (vendor.error) return { error: vendor.error };
    const driver = resolve(maps.driverCodes, record.default_driver_code, "default_driver_code");
    if (driver.error) return { error: driver.error };
    const type = resolve(maps.vehicleTypes, record.vehicle_type_code, "vehicle_type_code");
    if (type.error) return { error: type.error };
    const fuel = resolve(maps.fuelTypes, record.fuel_type_code, "fuel_type_code");
    if (fuel.error) return { error: fuel.error };
    const status = resolve(maps.statuses, record.status_code, "status_code");
    if (status.error) return { error: status.error };

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
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    return { error: null, data: parsed.data };
  };
}

export async function previewImportVehicles(
  _prev: PreviewFormState,
  formData: FormData,
): Promise<PreviewFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", preview: null };

  const supabase = await createClient();
  const maps = await loadImportMaps(supabase);
  const existingCodes = await loadCodeMap(supabase, "vehicles", "vehicle_code");

  return buildPreview(formData, CSV_CODE_COLUMN, existingCodes, makeRowValidator(maps));
}

export async function confirmImportVehicles(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const maps = await loadImportMaps(supabase);
  const existingCodes = await loadCodeMap(supabase, "vehicles", "vehicle_code");

  const report = await runPreviewedImport(
    formData,
    CSV_CODE_COLUMN,
    existingCodes,
    makeRowValidator(maps),
    async (data, _rowNumber, codeOverride) => {
      const row = toRow(data);
      if (codeOverride) row.vehicle_code = codeOverride;
      const { error } = await supabase.from("vehicles").insert(row);
      return error ? dbErrorText(error) : null;
    },
    async (matchId, data, record) => {
      const row = toRow(data);
      for (const f of OPTIONAL_UPDATE_FIELDS) {
        if (!record[f.column]) delete (row as Record<string, unknown>)[f.key];
      }
      const { error } = await supabase.from("vehicles").update(row).eq("id", matchId);
      return error ? dbErrorText(error) : null;
    },
  );

  revalidatePath("/[locale]/vehicles", "page");
  return { formError: null, report };
}
