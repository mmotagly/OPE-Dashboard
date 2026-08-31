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
import { vendorSchema, parseVendorForm, type VendorInput } from "./schema";

const UNIQUE_FIELDS = { vendor_code: "vendorCode" };

function toRow(input: VendorInput) {
  return {
    vendor_code: input.vendorCode,
    vendor_name: input.vendorName,
    vendor_type_id: input.vendorTypeId,
    is_company: input.isCompany,
    contact_person: input.contactPerson,
    mobile_number: input.mobileNumber,
    email_address: input.emailAddress,
    billing_basis: input.billingBasis,
    rate_amount: input.rateAmount,
    apply_kpi: input.applyKpi,
    currency: input.currency,
    billing_notes: input.billingNotes,
    status_id: input.statusId,
  };
}

/**
 * There is exactly one company vendor. `one_company_vendor` is the authority;
 * this checks first so the message names the vendor already holding the flag
 * instead of surfacing a constraint violation.
 */
async function companyVendorTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  exceptId?: string,
) {
  let query = supabase.from("vendors").select("id").eq("is_company", true);
  if (exceptId) query = query.neq("id", exceptId);

  const { data } = await query.maybeSingle();
  return data !== null;
}

/** The unique index fires on `is_company`, not on a column named for it. */
const isCompanyClash = (e: { message?: string; details?: string | null }) =>
  `${e.message ?? ""} ${e.details ?? ""}`.includes("one_company_vendor");

export async function createVendor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseVendorForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  if (parsed.data.isCompany && (await companyVendorTaken(supabase))) {
    return { formError: "companyVendorExists", fieldErrors: {} };
  }

  const { data, error } = await supabase
    .from("vendors")
    .insert(toRow(parsed.data))
    .select("id")
    .single();

  if (error) {
    if (isCompanyClash(error)) {
      return { formError: "companyVendorExists", fieldErrors: {} };
    }
    return dbErrorToState(error, UNIQUE_FIELDS);
  }

  revalidatePath("/[locale]/vendors", "page");
  return redirect({
    href: { pathname: "/vendors", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateVendor(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseVendorForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  if (parsed.data.isCompany && (await companyVendorTaken(supabase, id))) {
    return { formError: "companyVendorExists", fieldErrors: {} };
  }

  const { error } = await supabase.from("vendors").update(toRow(parsed.data)).eq("id", id);

  if (error) {
    if (isCompanyClash(error)) {
      return { formError: "companyVendorExists", fieldErrors: {} };
    }
    return dbErrorToState(error, UNIQUE_FIELDS);
  }

  revalidatePath("/[locale]/vendors", "page");
  return redirect({
    href: { pathname: "/vendors", query: { selected: id } },
    locale: gate.locale,
  });
}

/** CSV import (roadmap: CSV Import/Export). Two-step preview/confirm — see
 * vehicles/actions.ts. A row that would create a second `is_company`
 * vendor fails that row only — the same rule `companyVendorTaken`
 * enforces on the manual form. */

const CSV_CODE_COLUMN = "vendor_code";

/** Optional fields only — a blank cell here leaves the existing value
 * alone on Update. `currency` is required and never blank, so it's always
 * overwritten and doesn't appear here. */
const OPTIONAL_UPDATE_FIELDS: { column: string; key: string }[] = [
  { column: "vendor_type_code", key: "vendor_type_id" },
  { column: "is_company", key: "is_company" },
  { column: "contact_person", key: "contact_person" },
  { column: "mobile_number", key: "mobile_number" },
  { column: "email_address", key: "email_address" },
  { column: "billing_basis", key: "billing_basis" },
  { column: "rate_amount", key: "rate_amount" },
  { column: "apply_kpi", key: "apply_kpi" },
  { column: "billing_notes", key: "billing_notes" },
  { column: "status_code", key: "status_id" },
];

async function loadImportMaps() {
  const [vendorTypes, statuses] = await Promise.all([
    loadLookups("vendor_type").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);
  return { vendorTypes, statuses };
}

function makeRowValidator(maps: Awaited<ReturnType<typeof loadImportMaps>>) {
  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id ? { id, error: null } : { id: null, error: `Unknown ${field} "${code}"` };
  };

  return async (record: Record<string, string>): Promise<RowValidation<VendorInput>> => {
    const type = resolve(maps.vendorTypes, record.vendor_type_code, "vendor_type_code");
    if (type.error) return { error: type.error };
    const status = resolve(maps.statuses, record.status_code, "status_code");
    if (status.error) return { error: status.error };

    const parsed = vendorSchema.safeParse({
      vendorCode: record.vendor_code,
      vendorName: record.vendor_name,
      vendorTypeId: type.id ?? "",
      isCompany: record.is_company,
      contactPerson: record.contact_person,
      mobileNumber: record.mobile_number,
      emailAddress: record.email_address,
      billingBasis: record.billing_basis,
      rateAmount: record.rate_amount,
      applyKpi: record.apply_kpi,
      currency: record.currency || "EGP",
      billingNotes: record.billing_notes,
      statusId: status.id ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    return { error: null, data: parsed.data };
  };
}

export async function previewImportVendors(
  _prev: PreviewFormState,
  formData: FormData,
): Promise<PreviewFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", preview: null };

  const supabase = await createClient();
  const maps = await loadImportMaps();
  const existingCodes = await loadCodeMap(supabase, "vendors", "vendor_code");

  return buildPreview(formData, CSV_CODE_COLUMN, existingCodes, makeRowValidator(maps));
}

export async function confirmImportVendors(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const maps = await loadImportMaps();
  const existingCodes = await loadCodeMap(supabase, "vendors", "vendor_code");

  const report = await runPreviewedImport(
    formData,
    CSV_CODE_COLUMN,
    existingCodes,
    makeRowValidator(maps),
    async (data, _rowNumber, codeOverride) => {
      const row = toRow(data);
      if (codeOverride) row.vendor_code = codeOverride;
      if (row.is_company && (await companyVendorTaken(supabase))) {
        return "A company vendor already exists";
      }
      const { error } = await supabase.from("vendors").insert(row);
      return error ? (isCompanyClash(error) ? "A company vendor already exists" : dbErrorText(error)) : null;
    },
    async (matchId, data, record) => {
      const row = toRow(data);
      for (const f of OPTIONAL_UPDATE_FIELDS) {
        if (!record[f.column]) delete (row as Record<string, unknown>)[f.key];
      }
      if ("is_company" in row && row.is_company && (await companyVendorTaken(supabase, matchId))) {
        return "A company vendor already exists";
      }
      const { error } = await supabase.from("vendors").update(row).eq("id", matchId);
      return error ? (isCompanyClash(error) ? "A company vendor already exists" : dbErrorText(error)) : null;
    },
  );

  revalidatePath("/[locale]/vendors", "page");
  return { formError: null, report };
}
