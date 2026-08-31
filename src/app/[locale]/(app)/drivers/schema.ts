import { z } from "zod";
import {
  checkbox,
  optionalDate,
  optionalId,
  optionalText,
  readFields,
  requiredText,
} from "@/lib/forms";

/**
 * `vendorId` is optional — a null vendor means a company driver, which is a
 * real state rather than missing data.
 */
export const driverSchema = z.object({
  driverCode: requiredText(60),
  driverName: requiredText(200),
  mobileNumber: optionalText(40),
  hiringDate: optionalDate,
  licenseNumber: optionalText(60),
  licenseGradeId: optionalId,
  licenseExpiryDate: optionalDate,
  hasTourismId: checkbox,
  tourismIdIssuingCompany: optionalText(200),
  tourismIdExpiryDate: optionalDate,
  vendorId: optionalId,
  statusId: optionalId,
});

export type DriverInput = z.infer<typeof driverSchema>;

export const DRIVER_FIELDS = [
  "driverCode",
  "driverName",
  "mobileNumber",
  "hiringDate",
  "licenseNumber",
  "licenseGradeId",
  "licenseExpiryDate",
  "hasTourismId",
  "tourismIdIssuingCompany",
  "tourismIdExpiryDate",
  "vendorId",
  "statusId",
] as const;

export const parseDriverForm = (formData: FormData) =>
  driverSchema.safeParse(readFields(formData, DRIVER_FIELDS));

/** CSV import/export columns (roadmap: CSV Import/Export). See vehicles/schema.ts. */
export const DRIVER_IMPORT_COLUMNS = [
  "driver_code",
  "driver_name",
  "mobile_number",
  "hiring_date",
  "license_number",
  "license_grade_code",
  "license_expiry_date",
  "has_tourism_id",
  "tourism_id_issuing_company",
  "tourism_id_expiry_date",
  "vendor_code",
  "status_code",
] as const;
