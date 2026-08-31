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
import { driverSchema, parseDriverForm, type DriverInput } from "./schema";

const UNIQUE_FIELDS = { driver_code: "driverCode" };

function toRow(input: DriverInput) {
  return {
    driver_code: input.driverCode,
    driver_name: input.driverName,
    mobile_number: input.mobileNumber,
    hiring_date: input.hiringDate,
    license_number: input.licenseNumber,
    license_grade_id: input.licenseGradeId,
    license_expiry_date: input.licenseExpiryDate,
    has_tourism_id: input.hasTourismId,
    // only meaningful while the driver actually holds a tourism ID
    tourism_id_issuing_company: input.hasTourismId
      ? input.tourismIdIssuingCompany
      : null,
    tourism_id_expiry_date: input.hasTourismId ? input.tourismIdExpiryDate : null,
    vendor_id: input.vendorId,
    status_id: input.statusId,
  };
}

export async function createDriver(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseDriverForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drivers")
    .insert(toRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, UNIQUE_FIELDS);

  revalidatePath("/[locale]/drivers", "page");
  return redirect({
    href: { pathname: "/drivers", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateDriver(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseDriverForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("drivers").update(toRow(parsed.data)).eq("id", id);

  if (error) return dbErrorToState(error, UNIQUE_FIELDS);

  revalidatePath("/[locale]/drivers", "page");
  return redirect({
    href: { pathname: "/drivers", query: { selected: id } },
    locale: gate.locale,
  });
}

/** CSV import (roadmap: CSV Import/Export). Two-step preview/confirm — see
 * vehicles/actions.ts's previewImportVehicles/confirmImportVehicles for the
 * full shape; this mirrors it. */

const CSV_CODE_COLUMN = "driver_code";

/** Optional fields only — a blank cell here leaves the existing value
 * alone on Update. Tourism fields are each independently preservable, not
 * gated by has_tourism_id's own blankness — see the driver import plan
 * discussion: bulk-updating one field (say mobile_number) shouldn't blank
 * out a driver's tourism status just because that column was left out. */
const OPTIONAL_UPDATE_FIELDS: { column: string; key: string }[] = [
  { column: "mobile_number", key: "mobile_number" },
  { column: "hiring_date", key: "hiring_date" },
  { column: "license_number", key: "license_number" },
  { column: "license_grade_code", key: "license_grade_id" },
  { column: "license_expiry_date", key: "license_expiry_date" },
  { column: "has_tourism_id", key: "has_tourism_id" },
  { column: "tourism_id_issuing_company", key: "tourism_id_issuing_company" },
  { column: "tourism_id_expiry_date", key: "tourism_id_expiry_date" },
  { column: "vendor_code", key: "vendor_id" },
  { column: "status_code", key: "status_id" },
];

async function loadImportMaps(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [vendorCodes, licenseGrades, statuses] = await Promise.all([
    loadCodeMap(supabase, "vendors", "vendor_code"),
    loadLookups("license_grade").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);
  return { vendorCodes, licenseGrades, statuses };
}

function makeRowValidator(maps: Awaited<ReturnType<typeof loadImportMaps>>) {
  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id ? { id, error: null } : { id: null, error: `Unknown ${field} "${code}"` };
  };

  return async (record: Record<string, string>): Promise<RowValidation<DriverInput>> => {
    const vendor = resolve(maps.vendorCodes, record.vendor_code, "vendor_code");
    if (vendor.error) return { error: vendor.error };
    const grade = resolve(maps.licenseGrades, record.license_grade_code, "license_grade_code");
    if (grade.error) return { error: grade.error };
    const status = resolve(maps.statuses, record.status_code, "status_code");
    if (status.error) return { error: status.error };

    const parsed = driverSchema.safeParse({
      driverCode: record.driver_code,
      driverName: record.driver_name,
      mobileNumber: record.mobile_number,
      hiringDate: record.hiring_date,
      licenseNumber: record.license_number,
      licenseGradeId: grade.id ?? "",
      licenseExpiryDate: record.license_expiry_date,
      hasTourismId: record.has_tourism_id,
      tourismIdIssuingCompany: record.tourism_id_issuing_company,
      tourismIdExpiryDate: record.tourism_id_expiry_date,
      vendorId: vendor.id ?? "",
      statusId: status.id ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    return { error: null, data: parsed.data };
  };
}

export async function previewImportDrivers(
  _prev: PreviewFormState,
  formData: FormData,
): Promise<PreviewFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", preview: null };

  const supabase = await createClient();
  const maps = await loadImportMaps(supabase);
  const existingCodes = await loadCodeMap(supabase, "drivers", "driver_code");

  return buildPreview(formData, CSV_CODE_COLUMN, existingCodes, makeRowValidator(maps));
}

export async function confirmImportDrivers(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const maps = await loadImportMaps(supabase);
  const existingCodes = await loadCodeMap(supabase, "drivers", "driver_code");

  const report = await runPreviewedImport(
    formData,
    CSV_CODE_COLUMN,
    existingCodes,
    makeRowValidator(maps),
    async (data, _rowNumber, codeOverride) => {
      const row = toRow(data);
      if (codeOverride) row.driver_code = codeOverride;
      const { error } = await supabase.from("drivers").insert(row);
      return error ? dbErrorText(error) : null;
    },
    async (matchId, data, record) => {
      const row = toRow(data);
      for (const f of OPTIONAL_UPDATE_FIELDS) {
        if (!record[f.column]) delete (row as Record<string, unknown>)[f.key];
      }
      const { error } = await supabase.from("drivers").update(row).eq("id", matchId);
      return error ? dbErrorText(error) : null;
    },
  );

  revalidatePath("/[locale]/drivers", "page");
  return { formError: null, report };
}
