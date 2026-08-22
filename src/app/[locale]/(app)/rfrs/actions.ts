"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { canWriteOps, isSuper, requireUser } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import {
  parseIssueSkipForm,
  parseRfrForm,
  parseStageChangeForm,
  readIssueTypeIds,
  type RfrInput,
} from "./schema";
import { canTransition } from "./stage-rules";

/**
 * RFR mutations. Writing operations and maintenance is data_admin and above,
 * which is what can_write_ops() allows in RLS — the guard here mirrors it.
 *
 * Two things this code never does:
 *   - it never works out driver or odometer; trg_rfr_autofill does, and the
 *     row is read back afterwards to show what it chose
 *   - it never writes rfr_stage_history; trg_rfr_stage_log writes a row for
 *     every stage change, including the one at insert
 */

type Guard = { locale: string; role: AppRole } | FormState;
const denied = (g: Guard): g is FormState => "formError" in g;

async function guardOps(): Promise<Guard> {
  const locale = await getLocale();
  const user = await requireUser(locale);
  if (!canWriteOps(user.role)) return { formError: "forbidden", fieldErrors: {} };
  return { locale, role: user.role };
}

async function stageByCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
) {
  const { data } = await supabase
    .from("lookups")
    .select("id")
    .eq("category", "rfr_stage")
    .eq("code", code)
    .maybeSingle();

  return data?.id ?? null;
}

async function stageCodeById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stageId: string,
) {
  const { data } = await supabase
    .from("lookups")
    .select("code")
    .eq("id", stageId)
    .maybeSingle();

  return data?.code ?? null;
}

const refresh = () => revalidatePath("/[locale]/rfrs", "page");

/** Replaces the RFR's issue list with exactly the ticked types. */
async function syncIssues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rfrId: string,
  issueTypeIds: string[],
) {
  const { data: existing } = await supabase
    .from("rfr_issues")
    .select("id, issue_type_id")
    .eq("rfr_id", rfrId);

  const current = existing ?? [];
  const wanted = new Set(issueTypeIds);

  const removed = current.filter((i) => !wanted.has(i.issue_type_id)).map((i) => i.id);
  const added = issueTypeIds.filter(
    (id) => !current.some((i) => i.issue_type_id === id),
  );

  if (removed.length > 0) {
    const { error } = await supabase.from("rfr_issues").delete().in("id", removed);
    if (error) return error;
  }

  if (added.length > 0) {
    const { error } = await supabase
      .from("rfr_issues")
      .insert(added.map((issue_type_id) => ({ rfr_id: rfrId, issue_type_id })));
    if (error) return error;
  }

  return null;
}

function toRow(input: RfrInput) {
  return {
    request_at: input.requestAt,
    vehicle_id: input.vehicleId,
    // null on purpose when left blank — the insert trigger fills these
    driver_id: input.driverId,
    odometer_km: input.odometerKm,
    vehicle_location: input.vehicleLocation,
    description: input.description,
  };
}

export async function createRfr(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseRfrForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const pendingStageId = await stageByCode(supabase, "pending");
  if (!pendingStageId) return { formError: "noPendingStage", fieldErrors: {} };

  // driver_id and odometer_km go in as null unless the user overrode them;
  // trg_rfr_autofill fills them. The redirect below lands on the detail pane,
  // which reads the stored row back and shows whatever the trigger chose.
  const { data, error } = await supabase
    .from("rfrs")
    .insert({ ...toRow(parsed.data), stage_id: pendingStageId })
    .select("id")
    .single();

  if (error) return dbErrorToState(error);

  const issueError = await syncIssues(supabase, data.id, readIssueTypeIds(formData));
  if (issueError) return dbErrorToState(issueError);

  refresh();
  return redirect({
    href: { pathname: "/rfrs", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateRfr(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseRfrForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  // stage_id is untouched here; only the stage action moves it.
  const { error } = await supabase.from("rfrs").update(toRow(parsed.data)).eq("id", id);
  if (error) return dbErrorToState(error);

  const issueError = await syncIssues(supabase, id, readIssueTypeIds(formData));
  if (issueError) return dbErrorToState(issueError);

  refresh();
  return redirect({
    href: { pathname: "/rfrs", query: { selected: id } },
    locale: gate.locale,
  });
}

/**
 * The one place a stage moves. It writes rfrs.stage_id (plus the whole-request
 * skip reason when that is the target) and nothing else — trg_rfr_stage_log
 * records the change, and the access-time clock follows from that history.
 *
 * The transition-graph check below mirrors fn_validate_rfr_stage_transition
 * (0004_rfr_stage_transitions.sql), the authoritative gate — this exists only
 * to fail fast with a translated message instead of a raw Postgres error.
 */
export async function changeStage(
  rfrId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseStageChangeForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("lookups")
    .select("code")
    .eq("id", parsed.data.stageId)
    .eq("category", "rfr_stage")
    .maybeSingle();

  if (!stage) return { formError: null, fieldErrors: { stageId: "required" } };

  const { data: rfrRow } = await supabase
    .from("rfrs")
    .select("stage_id")
    .eq("id", rfrId)
    .maybeSingle();

  if (!rfrRow) return { formError: "saveFailed", fieldErrors: {} };

  const fromCode = await stageCodeById(supabase, rfrRow.stage_id);
  if (!fromCode) return { formError: "saveFailed", fieldErrors: {} };

  if (!canTransition(fromCode, stage.code, isSuper(gate.role))) {
    return { formError: "invalidStageTransition", fieldErrors: {} };
  }

  // "Skipped" means the whole request was dropped, and that needs a reason.
  if (stage.code === "skipped" && !parsed.data.skipReasonId) {
    return { formError: null, fieldErrors: { skipReasonId: "skipReasonRequired" } };
  }

  // "An RFR can be marked Completed once one or more work orders are done."
  if (stage.code === "completed") {
    const { count } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("rfr_id", rfrId)
      .not("repair_end_at", "is", null);

    if ((count ?? 0) === 0) {
      return { formError: "needsFinishedWorkOrder", fieldErrors: {} };
    }
  }

  const { error } = await supabase
    .from("rfrs")
    .update({
      stage_id: parsed.data.stageId,
      // a reason only belongs on a skipped request
      skip_reason_id: stage.code === "skipped" ? parsed.data.skipReasonId : null,
      // nothing in the schema stamps this, so the stage move does — and clears
      // it again if the request comes back out of Completed
      completed_at: stage.code === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", rfrId);

  if (error) return dbErrorToState(error);

  refresh();
  return { formError: null, fieldErrors: {} };
}

/**
 * Skip or un-skip one issue on the RFR. The table's own check constraint
 * refuses a skip without a reason; this reports it as a field error first.
 */
export async function editRfrIssue(
  _rfrId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseIssueSkipForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const { intent, rfrIssueId, skipReasonId } = parsed.data;

  if (intent === "skip" && !skipReasonId) {
    return { formError: null, fieldErrors: { skipReasonId: "skipReasonRequired" } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rfr_issues")
    .update(
      intent === "skip"
        ? { is_skipped: true, skip_reason_id: skipReasonId }
        : { is_skipped: false, skip_reason_id: null },
    )
    .eq("id", rfrIssueId);

  if (error) return dbErrorToState(error);

  refresh();
  return { formError: null, fieldErrors: {} };
}
