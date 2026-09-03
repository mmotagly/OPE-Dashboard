"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isSuper, requireUser } from "@/lib/auth";
import { deniedAction, makeActionGuard } from "@/lib/action-guard";
import { dbErrorToState, type DbError, type FormState } from "@/lib/forms";
import {
  parseNewTemplateForm,
  parseOpenMonthForm,
  parseStatusChange,
  parseTemplateDraft,
  readAchievedPoints,
  type TemplateDraft,
} from "./schema";

/**
 * Scorecard mutations. `super_admin` writes; admin and supervisor read, which
 * is what the RLS policies on these tables say too.
 *
 * The total achieved percentage is never written or worked out here — it is a
 * view over the lines, and `achieved_points` is capped at `metric_weight` by
 * trg_cap_achieved rather than by this code.
 */

const guardSuper = makeActionGuard(isSuper);
const denied = deniedAction;

const refresh = () => revalidatePath("/[locale]/scorecards", "page");

/** plpgsql `raise exception` lands as P0001. */
const isRaise = (e: DbError) => e.code === "P0001";

/** Copies the vendor's template into a new month. */
export async function openMonth(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseOpenMonthForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: { month: "required" } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_open_month", {
    p_vendor_id: parsed.data.vendorId,
    p_month: parsed.data.month,
  });

  if (error) {
    // The function raises when the vendor has no template to copy.
    if (isRaise(error)) return { formError: "noTemplate", fieldErrors: {} };
    if (error.code === "23505") return { formError: "monthAlreadyOpen", fieldErrors: {} };
    return dbErrorToState(error);
  }

  refresh();
  return redirect({
    href: { pathname: "/scorecards", query: { id: String(data) } },
    locale: gate.locale,
  });
}

/**
 * Writes the entered points. Values go in exactly as typed; if one exceeds its
 * KPI weight the trigger caps it and the reloaded row shows the capped figure.
 */
export async function saveAchievedPoints(
  scorecardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const entered = readAchievedPoints(formData);
  if (entered.size === 0) return { formError: null, fieldErrors: {} };

  const supabase = await createClient();

  // Upsert needs every not-null column, so the current rows are read first.
  const { data: sections } = await supabase
    .from("scorecard_sections")
    .select("id, scorecard_lines ( id, kpi_name, metric_weight, sort_order )")
    .eq("scorecard_id", scorecardId);

  const rows: {
    id: string;
    section_id: string;
    kpi_name: string;
    metric_weight: number;
    sort_order: number;
    achieved_points: number | null;
  }[] = [];

  for (const section of sections ?? []) {
    const lines = Array.isArray(section.scorecard_lines) ? section.scorecard_lines : [];
    for (const line of lines) {
      if (!entered.has(line.id)) continue;
      rows.push({
        id: line.id,
        section_id: section.id,
        kpi_name: line.kpi_name,
        metric_weight: line.metric_weight,
        sort_order: line.sort_order,
        achieved_points: entered.get(line.id) ?? null,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("scorecard_lines").upsert(rows);
    if (error) return dbErrorToState(error);
  }

  refresh();
  revalidatePath("/[locale]/invoices", "page");
  return { formError: null, fieldErrors: {} };
}

/** Approve, or reopen an approved scorecard. */
export async function setScorecardStatus(
  scorecardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseStatusChange(formData);
  if (!parsed.success) return { formError: "saveFailed", fieldErrors: {} };

  const locale = gate.locale;
  const user = await requireUser(locale);
  const approving = parsed.data.status === "approved";

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendor_scorecards")
    .update({
      status: parsed.data.status,
      approved_by: approving ? user.id : null,
      approved_at: approving ? new Date().toISOString() : null,
    })
    .eq("id", scorecardId);

  if (error) return dbErrorToState(error);

  refresh();
  return { formError: null, fieldErrors: {} };
}

/**
 * Brings a scorecard's sections and lines into line with the posted tree:
 * anything missing is removed, anything present is created or updated, and the
 * order is taken from the tree's own order.
 *
 * Shared by creating a template and saving one — a new template simply starts
 * with nothing on the database side.
 */
async function applyTemplateDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scorecardId: string,
  draft: TemplateDraft,
): Promise<DbError | null> {
  const { data: existing } = await supabase
    .from("scorecard_sections")
    .select("id, scorecard_lines ( id )")
    .eq("scorecard_id", scorecardId);

  const keptSections = new Set(
    draft.sections.map((s) => s.id).filter((id): id is string => id !== null),
  );
  const keptLines = new Set(
    draft.sections.flatMap((s) =>
      s.lines.map((l) => l.id).filter((id): id is string => id !== null),
    ),
  );

  // Removals first, so a re-used name cannot collide on the way in.
  const droppedSections = (existing ?? [])
    .map((s) => s.id as string)
    .filter((id) => !keptSections.has(id));

  if (droppedSections.length > 0) {
    // Lines cascade with their section.
    const { error } = await supabase
      .from("scorecard_sections")
      .delete()
      .in("id", droppedSections);
    if (error) return error;
  }

  const droppedLines = (existing ?? [])
    .filter((s) => !droppedSections.includes(s.id as string))
    .flatMap((s) => (Array.isArray(s.scorecard_lines) ? s.scorecard_lines : []))
    .map((l) => l.id as string)
    .filter((id) => !keptLines.has(id));

  if (droppedLines.length > 0) {
    const { error } = await supabase.from("scorecard_lines").delete().in("id", droppedLines);
    if (error) return error;
  }

  for (const [index, section] of draft.sections.entries()) {
    let sectionId = section.id;

    if (sectionId) {
      const { error } = await supabase
        .from("scorecard_sections")
        .update({
          section_name: section.sectionName,
          section_weight: section.sectionWeight,
          sort_order: index,
        })
        .eq("id", sectionId);
      if (error) return error;
    } else {
      const { data, error } = await supabase
        .from("scorecard_sections")
        .insert({
          scorecard_id: scorecardId,
          section_name: section.sectionName,
          section_weight: section.sectionWeight,
          sort_order: index,
        })
        .select("id")
        .single();
      if (error) return error;
      sectionId = data.id;
    }

    for (const [lineIndex, line] of section.lines.entries()) {
      const payload = {
        section_id: sectionId,
        kpi_name: line.kpiName,
        metric_weight: line.metricWeight,
        sort_order: lineIndex,
      };

      const { error } = line.id
        ? await supabase.from("scorecard_lines").update(payload).eq("id", line.id)
        : await supabase.from("scorecard_lines").insert(payload);

      if (error) return error;
    }
  }

  return null;
}

/**
 * Creates a vendor's KPI template — a scorecard row with no period month.
 * Without one fn_open_month has nothing to copy, so this is the first step of
 * the whole invoicing chain.
 */
export async function createTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const vendor = parseNewTemplateForm(formData);
  if (!vendor.success) {
    return { formError: null, fieldErrors: { vendorId: "required" } };
  }

  const parsed = parseTemplateDraft(formData);
  if (!parsed.success) return { formError: parsed.error, fieldErrors: {} };

  const supabase = await createClient();

  // period_month null is what makes it a template; is_template is generated
  // from it, and a partial unique index allows only one per vendor.
  const { data, error } = await supabase
    .from("vendor_scorecards")
    .insert({ vendor_id: vendor.data.vendorId, period_month: null })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { formError: "templateExists", fieldErrors: {} };
    }
    return dbErrorToState(error);
  }

  const draftError = await applyTemplateDraft(supabase, data.id, parsed.data);
  if (draftError) return dbErrorToState(draftError);

  refresh();
  return redirect({
    href: { pathname: "/scorecards", query: { kind: "templates", id: data.id } },
    locale: gate.locale,
  });
}

/**
 * Saves the vendor's KPI set whole: sections and lines are created, updated or
 * removed to match what was posted. Nothing assumes a shared list of KPIs.
 */
export async function saveTemplate(
  scorecardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseTemplateDraft(formData);
  if (!parsed.success) return { formError: parsed.error, fieldErrors: {} };

  const supabase = await createClient();
  const draftError = await applyTemplateDraft(supabase, scorecardId, parsed.data);
  if (draftError) return dbErrorToState(draftError);

  refresh();
  return { formError: null, fieldErrors: {} };
}
