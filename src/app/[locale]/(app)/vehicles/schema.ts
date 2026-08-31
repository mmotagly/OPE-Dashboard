import { z } from "zod";
import {
  optionalDate,
  optionalId,
  optionalNonNegative,
  readFields,
  requiredId,
  requiredText,
} from "@/lib/forms";

/**
 * `vendor_id` is required and never null — every bus belongs to a vendor, and
 * company-owned buses point at the company's own vendor row.
 *
 * `current_odometer_km` / `current_odometer_date` are absent on purpose:
 * trg_sync_odometer maintains them from the latest operation row.
 */
export const vehicleSchema = z.object({
  vehicleCode: requiredText(60),
  plateNumber: requiredText(60),
  vendorId: requiredId,
  vehicleTypeId: optionalId,
  fuelTypeId: optionalId,
  batteryCapacityKwh: optionalNonNegative,
  licenseExpiryDate: optionalDate,
  defaultDriverId: optionalId,
  statusId: optionalId,
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const VEHICLE_FIELDS = [
  "vehicleCode",
  "plateNumber",
  "vendorId",
  "vehicleTypeId",
  "fuelTypeId",
  "batteryCapacityKwh",
  "licenseExpiryDate",
  "defaultDriverId",
  "statusId",
] as const;

export const parseVehicleForm = (formData: FormData) =>
  vehicleSchema.safeParse(readFields(formData, VEHICLE_FIELDS));

/**
 * CSV import/export columns (roadmap: CSV Import/Export). `_code` columns
 * are the human-readable FK references a spreadsheet can actually contain —
 * resolved to ids by the import action before validation, and reused
 * verbatim as the export header order so a downloaded file re-imports.
 */
export const VEHICLE_IMPORT_COLUMNS = [
  "vehicle_code",
  "plate_number",
  "vendor_code",
  "vehicle_type_code",
  "fuel_type_code",
  "battery_capacity_kwh",
  "license_expiry_date",
  "default_driver_code",
  "status_code",
] as const;
