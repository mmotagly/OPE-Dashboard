import { z } from "zod";
import {
  checkbox,
  optionalEmail,
  optionalId,
  optionalNonNegative,
  optionalText,
  readFields,
  requiredText,
} from "@/lib/forms";

/**
 * The invoicing agreement lives on the vendor: which basis it bills on, the
 * rate, whether a KPI scorecard applies, and in what currency. The maths stays
 * in fn_generate_invoice — this only records the terms.
 */
export const vendorSchema = z
  .object({
    vendorCode: requiredText(60),
    vendorName: requiredText(200),
    vendorTypeId: optionalId,
    isCompany: checkbox,
    contactPerson: optionalText(200),
    mobileNumber: optionalText(40),
    emailAddress: optionalEmail,
    billingBasis: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || v === "per_bus_day" || v === "per_avg_bus_month", {
        message: "billingBasis",
      }),
    rateAmount: optionalNonNegative,
    applyKpi: checkbox,
    currency: requiredText(8),
    billingNotes: optionalText(2000),
    statusId: optionalId,
  })
  // a basis without a rate produces an invoice of nothing
  .refine((v) => v.billingBasis === null || v.rateAmount !== null, {
    message: "rateRequired",
    path: ["rateAmount"],
  });

export type VendorInput = z.infer<typeof vendorSchema>;

export const VENDOR_FIELDS = [
  "vendorCode",
  "vendorName",
  "vendorTypeId",
  "isCompany",
  "contactPerson",
  "mobileNumber",
  "emailAddress",
  "billingBasis",
  "rateAmount",
  "applyKpi",
  "currency",
  "billingNotes",
  "statusId",
] as const;

export const parseVendorForm = (formData: FormData) =>
  vendorSchema.safeParse(readFields(formData, VENDOR_FIELDS));

/** CSV import/export columns (roadmap: CSV Import/Export). See vehicles/schema.ts.
 * Invoicing terms are included since they're vendor master data, not derived. */
export const VENDOR_IMPORT_COLUMNS = [
  "vendor_code",
  "vendor_name",
  "vendor_type_code",
  "is_company",
  "contact_person",
  "mobile_number",
  "email_address",
  "billing_basis",
  "rate_amount",
  "apply_kpi",
  "currency",
  "billing_notes",
  "status_code",
] as const;
