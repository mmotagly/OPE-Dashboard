import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { loadVendors } from "@/app/[locale]/(app)/vendors/queries";

/** CSV export for vendor master data (roadmap item 1). Columns match
 * VENDOR_IMPORT_COLUMNS so an exported file re-imports. */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await loadVendors("");

  const csv = toCsv(
    rows.map((v) => ({
      vendor_code: v.vendorCode,
      vendor_name: v.vendorName,
      vendor_type_code: v.vendorTypeCode,
      is_company: v.isCompany,
      contact_person: v.contactPerson,
      mobile_number: v.mobileNumber,
      email_address: v.emailAddress,
      billing_basis: v.billingBasis,
      rate_amount: v.rateAmount,
      apply_kpi: v.applyKpi,
      currency: v.currency,
      billing_notes: v.billingNotes,
      status_code: v.statusCode,
    })),
    [
      { key: "vendor_code", header: "vendor_code" },
      { key: "vendor_name", header: "vendor_name" },
      { key: "vendor_type_code", header: "vendor_type_code" },
      { key: "is_company", header: "is_company" },
      { key: "contact_person", header: "contact_person" },
      { key: "mobile_number", header: "mobile_number" },
      { key: "email_address", header: "email_address" },
      { key: "billing_basis", header: "billing_basis" },
      { key: "rate_amount", header: "rate_amount" },
      { key: "apply_kpi", header: "apply_kpi" },
      { key: "currency", header: "currency" },
      { key: "billing_notes", header: "billing_notes" },
      { key: "status_code", header: "status_code" },
    ],
  );

  return csvResponse(csv, `vendors-${new Date().toISOString().slice(0, 10)}.csv`);
}
