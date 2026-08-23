import { createClient } from "@/lib/supabase/server";
import { loadLookupSets, type LookupOption } from "@/lib/lookups";

export type DriverRow = {
  id: string;
  driverCode: string;
  driverName: string;
  mobileNumber: string | null;
  hiringDate: string | null;
  licenseNumber: string | null;
  licenseGradeId: string | null;
  licenseGradeLabel: string | null;
  licenseExpiryDate: string | null;
  hasTourismId: boolean;
  tourismIdIssuingCompany: string | null;
  tourismIdExpiryDate: string | null;
  /** null means a company driver, not a missing value. */
  vendorId: string | null;
  vendorName: string | null;
  statusId: string | null;
  statusCode: string | null;
  statusLabel: string | null;
};

export type DriverFormValues = {
  driverCode: string;
  driverName: string;
  mobileNumber: string;
  hiringDate: string;
  licenseNumber: string;
  licenseGradeId: string;
  licenseExpiryDate: string;
  hasTourismId: boolean;
  tourismIdIssuingCompany: string;
  tourismIdExpiryDate: string;
  vendorId: string;
  statusId: string;
};

export type DriverOptions = {
  vendors: { id: string; vendorCode: string; vendorName: string }[];
  licenseGrades: LookupOption[];
  statuses: LookupOption[];
};

const SELECT = `
  id,
  driver_code,
  driver_name,
  mobile_number,
  hiring_date,
  license_number,
  license_grade_id,
  license_expiry_date,
  has_tourism_id,
  tourism_id_issuing_company,
  tourism_id_expiry_date,
  vendor_id,
  status_id,
  vendors ( vendor_name )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(d: any, lookups: Map<string, LookupOption>): DriverRow {
  const vendor = Array.isArray(d.vendors) ? d.vendors[0] : d.vendors;
  const status = d.status_id ? lookups.get(d.status_id) : undefined;

  return {
    id: d.id,
    driverCode: d.driver_code,
    driverName: d.driver_name,
    mobileNumber: d.mobile_number,
    hiringDate: d.hiring_date,
    licenseNumber: d.license_number,
    licenseGradeId: d.license_grade_id,
    licenseGradeLabel: d.license_grade_id
      ? (lookups.get(d.license_grade_id)?.labelEn ?? null)
      : null,
    licenseExpiryDate: d.license_expiry_date,
    hasTourismId: d.has_tourism_id,
    tourismIdIssuingCompany: d.tourism_id_issuing_company,
    tourismIdExpiryDate: d.tourism_id_expiry_date,
    vendorId: d.vendor_id,
    vendorName: vendor?.vendor_name ?? null,
    statusId: d.status_id,
    statusCode: status?.code ?? null,
    statusLabel: status?.labelEn ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function lookupMap(): Promise<Map<string, LookupOption>> {
  // Resolving labels for whatever an existing row already points at — a
  // deactivated value should still show its real label here, not a dash.
  const sets = await loadLookupSets(["license_grade", "generic_status"] as const, {
    includeInactive: true,
  });
  return new Map(
    [...sets.license_grade, ...sets.generic_status].map((l) => [l.id, l]),
  );
}

export async function loadDrivers(search: string): Promise<DriverRow[]> {
  const supabase = await createClient();
  const lookups = await lookupMap();

  let query = supabase.from("drivers").select(SELECT).order("driver_code");
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `driver_code.ilike.${term},driver_name.ilike.${term},license_number.ilike.${term}`,
    );
  }

  const { data } = await query;
  return (data ?? []).map((d) => toRow(d, lookups));
}

export async function loadDriver(id: string): Promise<DriverRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("drivers").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  return data ? toRow(data, lookups) : null;
}

export async function loadDriverOptions(): Promise<DriverOptions> {
  const supabase = await createClient();
  const [sets, vendors] = await Promise.all([
    loadLookupSets(["license_grade", "generic_status"] as const),
    supabase.from("vendors").select("id, vendor_code, vendor_name").order("vendor_code"),
  ]);

  return {
    vendors: (vendors.data ?? []).map((v) => ({
      id: v.id,
      vendorCode: v.vendor_code,
      vendorName: v.vendor_name,
    })),
    licenseGrades: sets.license_grade,
    statuses: sets.generic_status,
  };
}

export function toDriverFormValues(row: DriverRow): DriverFormValues {
  return {
    driverCode: row.driverCode,
    driverName: row.driverName,
    mobileNumber: row.mobileNumber ?? "",
    hiringDate: row.hiringDate ?? "",
    licenseNumber: row.licenseNumber ?? "",
    licenseGradeId: row.licenseGradeId ?? "",
    licenseExpiryDate: row.licenseExpiryDate ?? "",
    hasTourismId: row.hasTourismId,
    tourismIdIssuingCompany: row.tourismIdIssuingCompany ?? "",
    tourismIdExpiryDate: row.tourismIdExpiryDate ?? "",
    vendorId: row.vendorId ?? "",
    statusId: row.statusId ?? "",
  };
}

export const EMPTY_DRIVER_FORM: DriverFormValues = {
  driverCode: "",
  driverName: "",
  mobileNumber: "",
  hiringDate: "",
  licenseNumber: "",
  licenseGradeId: "",
  licenseExpiryDate: "",
  hasTourismId: false,
  tourismIdIssuingCompany: "",
  tourismIdExpiryDate: "",
  vendorId: "",
  statusId: "",
};
