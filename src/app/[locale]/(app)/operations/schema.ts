import { z } from "zod";

/**
 * Validation for a daily operation row.
 *
 * Messages are next-intl keys under `operations.error.*`, not prose — zod runs
 * on the server where there is no locale, so the form translates them.
 *
 * Two columns are deliberately absent from this schema:
 *   - `vendor_id`, filled by trg_dvo_vendor from the vehicle
 *   - `total_distance_km` / `battery_consumed_pct`, generated columns
 * and nothing here writes `vehicles.current_odometer_km` — trg_sync_odometer
 * owns it.
 *
 * Which of driver/startingKm/endingKm/operatingPct are required vs. forbidden
 * depends on the chosen status, mirroring fn_validate_operation_status
 * (0009/0010) exactly — as inline field errors here rather than a database
 * round trip. That mapping needs the status's *code*, not just its id, so
 * `buildOperationSchema` takes a statusCodeById map built from the
 * operation_status lookup rows (small and cheap to load whole, same pattern
 * rfr_stage uses).
 */

const REQUIRED = "required";
const NOT_A_NUMBER = "number";
const NEGATIVE = "negative";
const PERCENT = "percent";
const END_BEFORE_START = "endBeforeStart";
const NOT_ALLOWED = "notAllowedForStatus";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requiredId = z
  .string()
  .trim()
  .refine((v) => UUID.test(v), { message: REQUIRED });

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || UUID.test(v), { message: REQUIRED });

const isoDate = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
    message: REQUIRED,
  });

const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || Number.isFinite(Number(v)), {
    message: NOT_A_NUMBER,
  })
  .transform((v) => (v === null ? null : Number(v)));

const optionalNonNegative = optionalNumber.refine((n) => n === null || n >= 0, {
  message: NEGATIVE,
});

const optionalPercent = optionalNumber.refine(
  (n) => n === null || (n >= 0 && n <= 100),
  { message: PERCENT },
);

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === "" ? null : v));

const baseOperationSchema = z
  .object({
    operationDate: isoDate,
    shiftTypeId: requiredId,
    vehicleId: requiredId,
    statusId: requiredId,
    driverId: optionalId,
    routeId: optionalId,
    startingKm: optionalNonNegative,
    endingKm: optionalNonNegative,
    operatingPct: optionalPercent,
    startingBatteryPct: optionalPercent,
    endingBatteryPct: optionalPercent,
    driverTips: optionalNonNegative,
    remarks: optionalText,
  })
  // mirrors the table's own check constraint so the user sees it as a field
  // error rather than a database round trip
  .refine((v) => v.endingKm === null || v.startingKm === null || v.endingKm >= v.startingKm, {
    message: END_BEFORE_START,
    path: ["endingKm"],
  });

export function buildOperationSchema(statusCodeById: Record<string, string>) {
  return baseOperationSchema.superRefine((v, ctx) => {
    const code = statusCodeById[v.statusId];

    type ConditionalField =
      | "driverId"
      | "startingKm"
      | "endingKm"
      | "operatingPct"
      | "startingBatteryPct"
      | "endingBatteryPct";

    const need = (field: ConditionalField, value: unknown) => {
      if (value === null) ctx.addIssue({ code: "custom", path: [field], message: REQUIRED });
    };
    const forbid = (field: ConditionalField, value: unknown) => {
      if (value !== null) ctx.addIssue({ code: "custom", path: [field], message: NOT_ALLOWED });
    };

    if (code === "operating") {
      need("driverId", v.driverId);
      need("startingKm", v.startingKm);
      forbid("endingKm", v.endingKm);
      need("startingBatteryPct", v.startingBatteryPct);
      forbid("endingBatteryPct", v.endingBatteryPct);
    } else if (code === "completed") {
      need("driverId", v.driverId);
      need("startingKm", v.startingKm);
      need("endingKm", v.endingKm);
      need("startingBatteryPct", v.startingBatteryPct);
      need("endingBatteryPct", v.endingBatteryPct);
      need("operatingPct", v.operatingPct);
    } else {
      // planned / cancelled_by_* / under_maintenance
      forbid("driverId", v.driverId);
      forbid("startingKm", v.startingKm);
      forbid("endingKm", v.endingKm);
      forbid("operatingPct", v.operatingPct);
      forbid("startingBatteryPct", v.startingBatteryPct);
      forbid("endingBatteryPct", v.endingBatteryPct);
    }
  });
}

export type OperationInput = z.infer<typeof baseOperationSchema>;

/**
 * What a server action hands back to the form. Lives here rather than in
 * `actions.ts` because a `"use server"` module may only export async functions.
 */
export type OperationFormState = {
  /** next-intl key under `operations.error.*`, or null. */
  formError: string | null;
  /** field name -> next-intl key under `operations.error.*`. */
  fieldErrors: Record<string, string>;
};

export const EMPTY_FORM_STATE: OperationFormState = {
  formError: null,
  fieldErrors: {},
};

/** Field names the form renders, in the order errors should be reported. */
export const OPERATION_FIELDS = [
  "operationDate",
  "shiftTypeId",
  "vehicleId",
  "statusId",
  "driverId",
  "routeId",
  "startingKm",
  "endingKm",
  "operatingPct",
  "startingBatteryPct",
  "endingBatteryPct",
  "driverTips",
  "remarks",
] as const;

export type OperationField = (typeof OPERATION_FIELDS)[number];

export function parseOperationForm(
  formData: FormData,
  statusCodeById: Record<string, string>,
) {
  const read = (name: OperationField) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return buildOperationSchema(statusCodeById).safeParse(
    Object.fromEntries(OPERATION_FIELDS.map((f) => [f, read(f)])),
  );
}

/** First message key per field — the form only has room for one. */
export function firstFieldErrors(
  error: z.ZodError<unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in out)) out[field] = issue.message;
  }
  return out;
}

/**
 * Bulk planning (Phase 5). A Planned row is (vehicle, date, shift) only —
 * every other field is forbidden by fn_validate_operation_status for that
 * status, so there's nothing else to collect here.
 */
const bulkPlanSchema = z.object({
  operationDate: isoDate,
  shiftTypeId: requiredId,
  vehicleIds: z.array(requiredId).min(1, REQUIRED),
});

export type BulkPlanInput = z.infer<typeof bulkPlanSchema>;

export function parseBulkPlanForm(formData: FormData) {
  return bulkPlanSchema.safeParse({
    operationDate: String(formData.get("operationDate") ?? ""),
    shiftTypeId: String(formData.get("shiftTypeId") ?? ""),
    vehicleIds: formData.getAll("vehicleIds").map(String),
  });
}

/** One row's outcome. `reason` is a next-intl key under `operations.error.*`. */
export type BulkPlanResult = {
  vehicleId: string;
  vehicleCode: string;
  ok: boolean;
  reason: string | null;
};

export type BulkPlanFormState = {
  formError: string | null;
  fieldErrors: Record<string, string>;
  /** Present only when at least one row failed — the form renders the
   * report instead of redirecting. Absent on the initial/empty state. */
  results: BulkPlanResult[] | null;
};

export const EMPTY_BULK_PLAN_STATE: BulkPlanFormState = {
  formError: null,
  fieldErrors: {},
  results: null,
};
