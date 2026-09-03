"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { canWriteOps } from "@/lib/auth";
import { deniedAction, makeActionGuard } from "@/lib/action-guard";
import {
  dbErrorToState,
  firstFieldErrors,
  UNIQUE_VIOLATION,
  type DbError,
  type FormState,
} from "@/lib/forms";
import { parseChargingForm, type ChargingInput } from "./schema";

/**
 * Charging session mutations. data_admin and above, matching can_write_ops().
 *
 * The overlapping-plug rule is never pre-checked. fn_charging_no_plug_clash
 * raises on insert and update, and the rejection is translated below — with one
 * read afterwards, purely to name the session that conflicts.
 */

const guardOps = makeActionGuard(canWriteOps);
const denied = deniedAction;

const refresh = () => revalidatePath("/[locale]/charging", "page");

/** plpgsql `raise exception` lands as P0001; the message identifies which one. */
const RAISE_EXCEPTION = "P0001";

const isPlugClash = (e: DbError) =>
  e.code === RAISE_EXCEPTION &&
  `${e.message ?? ""} ${e.details ?? ""}`.includes("Plug conflict");

function toRow(input: ChargingInput) {
  return {
    vehicle_id: input.vehicleId,
    charger_id: input.chargerId,
    plugs_used: input.plugsUsed,
    battery_start_pct: input.batteryStartPct,
    battery_end_pct: input.batteryEndPct,
    charging_start_time: input.chargingStartTime,
    charging_end_time: input.chargingEndTime,
    energy_consumed_kwh: input.energyConsumedKwh,
    notes: input.notes,
  };
}

/**
 * Finds the session the database just refused to sit alongside, so the message
 * can name it. This runs only after the rejection — it is not a pre-check, and
 * if it comes up empty the generic clash message still stands.
 */
async function describeClash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ChargingInput,
  exceptId?: string,
): Promise<string | null> {
  let query = supabase
    .from("charging_sessions")
    .select("charging_session_code, plugs_used, charging_start_time, charging_end_time")
    .eq("charger_id", input.chargerId);

  if (exceptId) query = query.neq("id", exceptId);

  const { data } = await query;

  const start = input.chargingStartTime ? Date.parse(input.chargingStartTime) : null;
  const end = input.chargingEndTime ? Date.parse(input.chargingEndTime) : Infinity;

  const clash = (data ?? []).find((s) => {
    const sharesPlug =
      s.plugs_used === "A+B" || input.plugsUsed === "A+B" || s.plugs_used === input.plugsUsed;
    if (!sharesPlug) return false;

    const otherStart = s.charging_start_time ? Date.parse(s.charging_start_time) : null;
    const otherEnd = s.charging_end_time ? Date.parse(s.charging_end_time) : Infinity;
    if (start === null || otherStart === null) return false;

    return otherStart <= end && otherEnd >= start;
  });

  return clash?.charging_session_code ?? null;
}

/**
 * `charging_session_code` is `not null unique` with no default and no trigger,
 * so the application supplies it. Numbered per day; a collision on the code
 * alone is retried with the next number.
 */
async function nextSessionCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  day: string,
  attempt: number,
) {
  const { count } = await supabase
    .from("charging_sessions")
    .select("id", { count: "exact", head: true })
    .gte("charging_start_time", `${day}T00:00:00Z`)
    .lt("charging_start_time", `${day}T23:59:59.999Z`);

  const sequence = (count ?? 0) + 1 + attempt;
  return `CH-${day.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

const isCodeCollision = (e: DbError) =>
  e.code === UNIQUE_VIOLATION &&
  `${e.message ?? ""} ${e.details ?? ""}`.includes("charging_session_code");

export async function createChargingSession(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseChargingForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const day = (parsed.data.chargingStartTime ?? new Date().toISOString()).slice(0, 10);
  const row = toRow(parsed.data);

  let created: { id: string } | null = null;
  let lastError: DbError | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const charging_session_code = await nextSessionCode(supabase, day, attempt);

    const { data, error } = await supabase
      .from("charging_sessions")
      .insert({ ...row, charging_session_code })
      .select("id")
      .single();

    if (!error) {
      created = { id: data.id };
      break;
    }

    lastError = error;
    if (!isCodeCollision(error)) break;
  }

  if (!created) {
    const error = lastError ?? {};
    if (isPlugClash(error)) {
      const conflicting = await describeClash(supabase, parsed.data);
      return conflicting
        ? {
            formError: "plugClashWith",
            fieldErrors: {},
            formErrorValues: { session: conflicting },
          }
        : { formError: "plugClash", fieldErrors: {} };
    }
    return dbErrorToState(error);
  }

  refresh();
  return redirect({
    href: { pathname: "/charging", query: { id: created.id } },
    locale: gate.locale,
  });
}

export async function updateChargingSession(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseChargingForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("charging_sessions")
    .update(toRow(parsed.data))
    .eq("id", id);

  if (error) {
    if (isPlugClash(error)) {
      const conflicting = await describeClash(supabase, parsed.data, id);
      return conflicting
        ? {
            formError: "plugClashWith",
            fieldErrors: {},
            formErrorValues: { session: conflicting },
          }
        : { formError: "plugClash", fieldErrors: {} };
    }
    return dbErrorToState(error);
  }

  refresh();
  return redirect({
    href: { pathname: "/charging", query: { id } },
    locale: gate.locale,
  });
}
