import { z } from "zod";
import { checkbox, optionalText, readFields, requiredText } from "@/lib/forms";

/**
 * There is no account creation here — accounts are made in Supabase and this
 * only edits the profile that hangs off one. `id` is never editable.
 */
export const userSchema = z.object({
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  role: z.enum(["super_admin", "admin", "supervisor", "data_admin"], {
    errorMap: () => ({ message: "required" }),
  }),
  isEngineer: checkbox,
  isActive: checkbox,
});

export type UserInput = z.infer<typeof userSchema>;

export const USER_FIELDS = [
  "fullName",
  "jobTitle",
  "role",
  "isEngineer",
  "isActive",
] as const;

export const parseUserForm = (formData: FormData) =>
  userSchema.safeParse(readFields(formData, USER_FIELDS));

/** Both PM thresholds are saved together, since they are read as a pair. */
const threshold = z
  .string()
  .trim()
  .min(1, { message: "required" })
  .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, { message: "negative" })
  .transform(Number);

export const thresholdsSchema = z
  .object({ pm_due_soon_km: threshold, pm_due_now_km: threshold })
  // due_now is the tighter of the two; the view compares against both
  .refine((v) => v.pm_due_now_km <= v.pm_due_soon_km, {
    message: "dueNowAboveDueSoon",
    path: ["pm_due_now_km"],
  });

export const THRESHOLD_FIELDS = ["pm_due_soon_km", "pm_due_now_km"] as const;

export const parseThresholdsForm = (formData: FormData) =>
  thresholdsSchema.safeParse(readFields(formData, THRESHOLD_FIELDS));

/**
 * The categories Data Validation exposes — genuinely free content lists with
 * no code-level logic hanging off their entries. rfr_stage, generic_status,
 * shift_type and fuel_type are deliberately excluded: real logic (the RFR
 * transition graph, the access-time clock, status pill colour, the
 * Morning/Night domain model, the electric-vehicle charging filter) is
 * hardcoded against their specific codes, so they stay SQL-only.
 */
export const DATA_VALIDATION_CATEGORIES = [
  "issue_type",
  "skip_reason",
  "maintenance_type",
  "maintenance_category",
  "vehicle_status_after",
  "vendor_type",
  "vehicle_type",
  "license_grade",
] as const;

export type DataValidationCategory = (typeof DATA_VALIDATION_CATEGORIES)[number];

/**
 * Lookup values are added, renamed, reordered and deactivated — never deleted.
 * A value that has been used is referenced by operational rows, so `is_active`
 * is what takes it out of circulation. `category` is restricted to the
 * Data Validation set — this is the actual guard, not just the UI dropdown.
 */
export const lookupSchema = z.object({
  category: z.enum(DATA_VALIDATION_CATEGORIES, { errorMap: () => ({ message: "required" }) }),
  code: requiredText(60),
  labelEn: requiredText(200),
  labelAr: optionalText(200),
  sortOrder: z
    .string()
    .trim()
    .refine((v) => v === "" || Number.isFinite(Number(v)), { message: "number" })
    .transform((v) => (v === "" ? 0 : Math.trunc(Number(v)))),
  isActive: checkbox,
});

export type LookupInput = z.infer<typeof lookupSchema>;

export const LOOKUP_FIELDS = [
  "category",
  "code",
  "labelEn",
  "labelAr",
  "sortOrder",
  "isActive",
] as const;

export const parseLookupForm = (formData: FormData) =>
  lookupSchema.safeParse(readFields(formData, LOOKUP_FIELDS));
