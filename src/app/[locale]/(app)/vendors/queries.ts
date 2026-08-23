import { createClient } from "@/lib/supabase/server";
import { loadLookupSets, type LookupOption } from "@/lib/lookups";

export type BillingBasis = "per_bus_day" | "per_avg_bus_month";

export type VendorRow = {
  id: string;
  vendorCode: string;
  vendorName: string;
  vendorTypeId: string | null;
  vendorTypeLabel: string | null;
  isCompany: boolean;
  contactPerson: string | null;
  mobileNumber: string | null;
  emailAddress: string | null;
  billingBasis: BillingBasis | null;
  rateAmount: number | null;
  applyKpi: boolean;
  currency: string;
  billingNotes: string | null;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
};

export type VendorFormValues = {
  vendorCode: string;
  vendorName: string;
  vendorTypeId: string;
  isCompany: boolean;
  contactPerson: string;
  mobileNumber: string;
  emailAddress: string;
  billingBasis: string;
  rateAmount: string;
  applyKpi: boolean;
  currency: string;
  billingNotes: string;
  statusId: string;
};

export type VendorOptions = {
  vendorTypes: LookupOption[];
  statuses: LookupOption[];
  /** The single existing company vendor, if there is one. */
  companyVendor: { id: string; vendorName: string } | null;
};

const SELECT = `
  id,
  vendor_code,
  vendor_name,
  vendor_type_id,
  is_company,
  contact_person,
  mobile_number,
  email_address,
  billing_basis,
  rate_amount,
  apply_kpi,
  currency,
  billing_notes,
  status_id
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(v: any, lookups: Map<string, LookupOption>): VendorRow {
  const status = v.status_id ? lookups.get(v.status_id) : undefined;

  return {
    id: v.id,
    vendorCode: v.vendor_code,
    vendorName: v.vendor_name,
    vendorTypeId: v.vendor_type_id,
    vendorTypeLabel: v.vendor_type_id
      ? (lookups.get(v.vendor_type_id)?.labelEn ?? null)
      : null,
    isCompany: v.is_company,
    contactPerson: v.contact_person,
    mobileNumber: v.mobile_number,
    emailAddress: v.email_address,
    billingBasis: v.billing_basis,
    rateAmount: v.rate_amount,
    applyKpi: v.apply_kpi,
    currency: v.currency,
    billingNotes: v.billing_notes,
    statusId: v.status_id,
    statusCode: status?.code ?? null,
    statusLabel: status?.labelEn ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function lookupMap(): Promise<Map<string, LookupOption>> {
  // Resolving labels for whatever an existing row already points at — a
  // deactivated value should still show its real label here, not a dash.
  const sets = await loadLookupSets(["vendor_type", "generic_status"] as const, {
    includeInactive: true,
  });
  return new Map([...sets.vendor_type, ...sets.generic_status].map((l) => [l.id, l]));
}

export async function loadVendors(search: string): Promise<VendorRow[]> {
  const supabase = await createClient();
  const lookups = await lookupMap();

  let query = supabase
    .from("vendors")
    .select(SELECT)
    .order("is_company", { ascending: false })
    .order("vendor_code");

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`vendor_code.ilike.${term},vendor_name.ilike.${term}`);
  }

  const { data } = await query;
  return (data ?? []).map((v) => toRow(v, lookups));
}

export async function loadVendor(id: string): Promise<VendorRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("vendors").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  return data ? toRow(data, lookups) : null;
}

/** Whoever currently holds `is_company`, enforced by the one_company_vendor index. */
export async function loadCompanyVendor() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, vendor_name")
    .eq("is_company", true)
    .maybeSingle();

  return data ? { id: data.id, vendorName: data.vendor_name } : null;
}

export async function loadVendorOptions(): Promise<VendorOptions> {
  const [sets, companyVendor] = await Promise.all([
    loadLookupSets(["vendor_type", "generic_status"] as const),
    loadCompanyVendor(),
  ]);

  return {
    vendorTypes: sets.vendor_type,
    statuses: sets.generic_status,
    companyVendor,
  };
}

export function toVendorFormValues(row: VendorRow): VendorFormValues {
  return {
    vendorCode: row.vendorCode,
    vendorName: row.vendorName,
    vendorTypeId: row.vendorTypeId ?? "",
    isCompany: row.isCompany,
    contactPerson: row.contactPerson ?? "",
    mobileNumber: row.mobileNumber ?? "",
    emailAddress: row.emailAddress ?? "",
    billingBasis: row.billingBasis ?? "",
    rateAmount: row.rateAmount === null ? "" : String(row.rateAmount),
    applyKpi: row.applyKpi,
    currency: row.currency,
    billingNotes: row.billingNotes ?? "",
    statusId: row.statusId ?? "",
  };
}

export const EMPTY_VENDOR_FORM: VendorFormValues = {
  vendorCode: "",
  vendorName: "",
  vendorTypeId: "",
  isCompany: false,
  contactPerson: "",
  mobileNumber: "",
  emailAddress: "",
  billingBasis: "",
  rateAmount: "",
  applyKpi: false,
  currency: "EGP",
  billingNotes: "",
  statusId: "",
};
