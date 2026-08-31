"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { guardMaster, isDenied } from "@/lib/master";
import { dbErrorText, dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import { codeMapFromLookups, importFromFormData, loadCodeMap, type ImportFormState } from "@/lib/csv-import";
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

/** CSV import (roadmap: CSV Import/Export). See vehicles/actions.ts's importVehicles. */
export async function importDrivers(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const [vendorCodes, licenseGrades, statuses] = await Promise.all([
    loadCodeMap(supabase, "vendors", "vendor_code"),
    loadLookups("license_grade").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);

  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id ? { id, error: null } : { id: null, error: `Unknown ${field} "${code}"` };
  };

  const result = await importFromFormData(formData, async (record) => {
    const vendor = resolve(vendorCodes, record.vendor_code, "vendor_code");
    if (vendor.error) return vendor.error;
    const grade = resolve(licenseGrades, record.license_grade_code, "license_grade_code");
    if (grade.error) return grade.error;
    const status = resolve(statuses, record.status_code, "status_code");
    if (status.error) return status.error;

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
      return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    const { error } = await supabase.from("drivers").insert(toRow(parsed.data));
    return error ? dbErrorText(error) : null;
  });

  if (result.formError) return { formError: result.formError, report: null };

  revalidatePath("/[locale]/drivers", "page");
  return { formError: null, report: result.report };
}
