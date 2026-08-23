"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { canWriteOps, requireUser } from "@/lib/auth";
import {
  firstFieldErrors,
  parseOperationForm,
  type OperationFormState,
  type OperationInput,
} from "./schema";

/**
 * Mutations for daily operations.
 *
 * What this code deliberately does not do:
 *   - it never sends `vendor_id`; trg_dvo_vendor copies it from the vehicle
 *   - it never touches `vehicles.current_odometer_km`; trg_sync_odometer owns it
 *   - it never checks for a duplicate before writing; the unique constraint on
 *     (vehicle_id, operation_date, shift_type_id) is the authority, and its
 *     rejection is translated into a field-level message
 *
 * Phase 1 compatibility shim (0009_operation_status.sql): this form still only
 * knows Operating/Completed, derived from whether endingKm was entered — the
 * same thing the UI used to derive from endKm alone. status_id now has to be
 * set explicitly because the DB default ('planned') requires driver/KM to be
 * null, which this form never satisfies. The real status picker (Planned, the
 * Cancelled variants, Under Maintenance) is a later phase; this only keeps
 * today's form working against the new schema, unchanged.
 */

type DbError = { code?: string; message?: string; details?: string | null };

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const RLS_VIOLATION = "42501";

const errorText = (e: DbError) => `${e.message ?? ""} ${e.details ?? ""}`;

/** The operation_code unique index, as opposed to the one-row-per-shift one. */
const isCodeCollision = (e: DbError) =>
  e.code === UNIQUE_VIOLATION && errorText(e).includes("operation_code");

function toFormState(e: DbError): OperationFormState {
  if (e.code === UNIQUE_VIOLATION) {
    // (vehicle_id, operation_date, shift_type_id) — one row per bus per shift
    return { formError: "duplicate", fieldErrors: {} };
  }
  if (e.code === CHECK_VIOLATION && errorText(e).includes("ending_odometer_km")) {
    return { formError: null, fieldErrors: { endingKm: "endBeforeStart" } };
  }
  if (e.code === RLS_VIOLATION) {
    return { formError: "forbidden", fieldErrors: {} };
  }
  return { formError: "saveFailed", fieldErrors: {} };
}

/** Columns the form owns. Everything else on the row is the database's job. */
function toRow(input: OperationInput) {
  return {
    operation_date: input.operationDate,
    shift_type_id: input.shiftTypeId,
    vehicle_id: input.vehicleId,
    driver_id: input.driverId,
    route_id: input.routeId,
    starting_odometer_km: input.startingKm,
    ending_odometer_km: input.endingKm,
    operating_percentage: input.operatingPct,
    starting_battery_pct: input.startingBatteryPct,
    ending_battery_pct: input.endingBatteryPct,
    driver_tips: input.driverTips,
    remarks: input.remarks,
  };
}

/**
 * Phase 1 shim — see the module doc comment. Resolves the operation_status
 * lookup id for whichever of the two codes this old form can produce.
 */
async function resolveStatusId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  endingKm: number | null,
) {
  const { data } = await supabase
    .from("lookups")
    .select("id")
    .eq("category", "operation_status")
    .eq("code", endingKm === null ? "operating" : "completed")
    .single();

  return data?.id ?? null;
}

/**
 * `operation_code` is `not null unique` with no default and no trigger, so the
 * application has to supply it. Numbered per day; collisions on the code alone
 * are retried with the next number.
 */
async function nextOperationCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
  attempt: number,
) {
  const { count } = await supabase
    .from("daily_vehicle_operations")
    .select("id", { count: "exact", head: true })
    .eq("operation_date", date);

  const sequence = (count ?? 0) + 1 + attempt;
  return `OP-${date.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

async function guard(): Promise<{ locale: string } | OperationFormState> {
  const locale = await getLocale();
  const user = await requireUser(locale);
  if (!canWriteOps(user.role)) {
    return { formError: "forbidden", fieldErrors: {} };
  }
  return { locale };
}

const isState = (v: { locale: string } | OperationFormState): v is OperationFormState =>
  "formError" in v;

export async function createOperation(
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const gate = await guard();
  if (isState(gate)) return gate;

  const parsed = parseOperationForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const status_id = await resolveStatusId(supabase, parsed.data.endingKm);
  const row = { ...toRow(parsed.data), status_id };

  let created: { id: string } | null = null;
  let lastError: DbError | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const operation_code = await nextOperationCode(
      supabase,
      parsed.data.operationDate,
      attempt,
    );

    // status_id (migration 0009) is newer than the checked-in generated
    // types, so the typed client doesn't know this column exists yet — same
    // gap saved-filters-db.ts documents for a whole missing table, here it's
    // one column on an existing one. Removable once types are regenerated.
    const { data, error } = await supabase
      .from("daily_vehicle_operations")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ ...row, operation_code } as any)
      .select("id")
      .single();

    if (!error) {
      created = { id: String(data.id) };
      break;
    }

    lastError = error;
    if (!isCodeCollision(error)) break;
  }

  if (!created) {
    return toFormState(lastError ?? { code: undefined });
  }

  revalidatePath("/[locale]/operations", "page");
  return redirect({
    href: {
      pathname: "/operations",
      query: { date: parsed.data.operationDate, selected: created.id },
    },
    locale: gate.locale,
  });
}

export async function updateOperation(
  id: string,
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const gate = await guard();
  if (isState(gate)) return gate;

  const parsed = parseOperationForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const status_id = await resolveStatusId(supabase, parsed.data.endingKm);

  // operation_code is left alone on purpose — a record's identifier should not
  // churn when its vehicle or date is corrected. status_id: see the same
  // stale-generated-types note above resolveStatusId's call in createOperation.
  const { error } = await supabase
    .from("daily_vehicle_operations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...toRow(parsed.data), status_id } as any)
    .eq("id", id);

  if (error) return toFormState(error);

  revalidatePath("/[locale]/operations", "page");
  return redirect({
    href: {
      pathname: "/operations",
      query: { date: parsed.data.operationDate, selected: id },
    },
    locale: gate.locale,
  });
}
