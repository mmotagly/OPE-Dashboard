import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { loadDrivers } from "@/app/[locale]/(app)/drivers/queries";

/** CSV export for driver master data (roadmap item 1). Columns match
 * DRIVER_IMPORT_COLUMNS so an exported file re-imports. */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await loadDrivers("");

  const csv = toCsv(
    rows.map((d) => ({
      driver_code: d.driverCode,
      driver_name: d.driverName,
      mobile_number: d.mobileNumber,
      hiring_date: d.hiringDate,
      license_number: d.licenseNumber,
      license_grade_code: d.licenseGradeCode,
      license_expiry_date: d.licenseExpiryDate,
      has_tourism_id: d.hasTourismId,
      tourism_id_issuing_company: d.tourismIdIssuingCompany,
      tourism_id_expiry_date: d.tourismIdExpiryDate,
      vendor_code: d.vendorCode,
      status_code: d.statusCode,
    })),
    [
      { key: "driver_code", header: "driver_code" },
      { key: "driver_name", header: "driver_name" },
      { key: "mobile_number", header: "mobile_number" },
      { key: "hiring_date", header: "hiring_date" },
      { key: "license_number", header: "license_number" },
      { key: "license_grade_code", header: "license_grade_code" },
      { key: "license_expiry_date", header: "license_expiry_date" },
      { key: "has_tourism_id", header: "has_tourism_id" },
      { key: "tourism_id_issuing_company", header: "tourism_id_issuing_company" },
      { key: "tourism_id_expiry_date", header: "tourism_id_expiry_date" },
      { key: "vendor_code", header: "vendor_code" },
      { key: "status_code", header: "status_code" },
    ],
  );

  return csvResponse(csv, `drivers-${new Date().toISOString().slice(0, 10)}.csv`);
}
