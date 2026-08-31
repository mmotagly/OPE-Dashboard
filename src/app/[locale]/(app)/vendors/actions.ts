"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { guardMaster, isDenied } from "@/lib/master";
import { dbErrorText, dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import { codeMapFromLookups, importFromFormData, type ImportFormState } from "@/lib/csv-import";
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

/** CSV import (roadmap: CSV Import/Export). See vehicles/actions.ts's importVehicles.
 * A row that would create a second `is_company` vendor fails that row only —
 * the same rule `companyVendorTaken` enforces on the manual form. */
export async function importVendors(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return { formError: gate.formError ?? "forbidden", report: null };

  const supabase = await createClient();
  const [vendorTypes, statuses] = await Promise.all([
    loadLookups("vendor_type").then(codeMapFromLookups),
    loadLookups("generic_status").then(codeMapFromLookups),
  ]);

  const resolve = (codes: Map<string, string>, code: string, field: string) => {
    if (!code) return { id: null as string | null, error: null as string | null };
    const id = codes.get(code);
    return id ? { id, error: null } : { id: null, error: `Unknown ${field} "${code}"` };
  };

  const result = await importFromFormData(formData, async (record) => {
    const type = resolve(vendorTypes, record.vendor_type_code, "vendor_type_code");
    if (type.error) return type.error;
    const status = resolve(statuses, record.status_code, "status_code");
    if (status.error) return status.error;

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
      return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }

    if (parsed.data.isCompany && (await companyVendorTaken(supabase))) {
      return "A company vendor already exists";
    }

    const { error } = await supabase.from("vendors").insert(toRow(parsed.data));
    if (error) return isCompanyClash(error) ? "A company vendor already exists" : dbErrorText(error);
    return null;
  });

  if (result.formError) return { formError: result.formError, report: null };

  revalidatePath("/[locale]/vendors", "page");
  return { formError: null, report: result.report };
}
