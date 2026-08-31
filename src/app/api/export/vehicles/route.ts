import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { loadVehicles } from "@/app/[locale]/(app)/vehicles/queries";

/** CSV export for vehicle master data (roadmap item 1). Columns match
 * VEHICLE_IMPORT_COLUMNS's `_code` fields so an exported file re-imports. */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await loadVehicles("");

  const csv = toCsv(
    rows.map((v) => ({
      vehicle_code: v.vehicleCode,
      plate_number: v.plateNumber,
      vendor_code: v.vendorCode,
      vehicle_type_code: v.vehicleTypeCode,
      fuel_type_code: v.fuelTypeCode,
      battery_capacity_kwh: v.batteryCapacityKwh,
      license_expiry_date: v.licenseExpiryDate,
      default_driver_code: v.defaultDriverCode,
      status_code: v.statusCode,
    })),
    [
      { key: "vehicle_code", header: "vehicle_code" },
      { key: "plate_number", header: "plate_number" },
      { key: "vendor_code", header: "vendor_code" },
      { key: "vehicle_type_code", header: "vehicle_type_code" },
      { key: "fuel_type_code", header: "fuel_type_code" },
      { key: "battery_capacity_kwh", header: "battery_capacity_kwh" },
      { key: "license_expiry_date", header: "license_expiry_date" },
      { key: "default_driver_code", header: "default_driver_code" },
      { key: "status_code", header: "status_code" },
    ],
  );

  return csvResponse(csv, `vehicles-${new Date().toISOString().slice(0, 10)}.csv`);
}
