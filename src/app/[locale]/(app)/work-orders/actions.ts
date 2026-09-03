"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { canWriteOps } from "@/lib/auth";
import { deniedAction, makeActionGuard } from "@/lib/action-guard";
import { dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import { parseWorkOrderForm, readPartIds, type WorkOrderInput } from "./schema";

/**
 * Work order mutations. data_admin and above, matching can_write_ops().
 *
 * Two things this never does:
 *   - it never writes `vehicle_part_schedules`; setting `repair_end_at` fires
 *     trg_wo_advance_pm, which advances last_service_km using the odometer from
 *     the operation on the repair day
 *   - it never counts prior work orders; the repeat index is a view
 */

const guardOps = makeActionGuard(canWriteOps);
const denied = deniedAction;

const refresh = () => revalidatePath("/[locale]/work-orders", "page");

function toRow(input: WorkOrderInput) {
  return {
    assigned_engineer_id: input.assignedEngineerId,
    maintenance_type_id: input.maintenanceTypeId,
    issue_type_id: input.issueTypeId,
    maintenance_category_id: input.maintenanceCategoryId,
    maintenance_center_id: input.maintenanceCenterId,
    repair_start_at: input.repairStartAt,
    repair_end_at: input.repairEndAt,
    technician_1: input.technician1,
    technician_2: input.technician2,
    technician_3: input.technician3,
    is_skipped: input.isSkipped,
    // a reason and its notes only belong on a skipped work order
    skip_reason_id: input.isSkipped ? input.skipReasonId : null,
    skip_notes: input.isSkipped ? input.skipNotes : null,
    vehicle_status_after_id: input.vehicleStatusAfterId,
    description: input.description,
  };
}

/** Replaces the work order's parts with exactly the ticked ones. */
async function syncParts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workOrderId: string,
  partIds: string[],
) {
  const { data: existing } = await supabase
    .from("work_order_parts")
    .select("part_id")
    .eq("work_order_id", workOrderId);

  const current = (existing ?? []).map((p) => p.part_id);
  const wanted = new Set(partIds);

  const removed = current.filter((id) => !wanted.has(id));
  const added = partIds.filter((id) => !current.includes(id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("work_order_parts")
      .delete()
      .eq("work_order_id", workOrderId)
      .in("part_id", removed);
    if (error) return error;
  }

  if (added.length > 0) {
    const { error } = await supabase
      .from("work_order_parts")
      .insert(added.map((part_id) => ({ work_order_id: workOrderId, part_id })));
    if (error) return error;
  }

  return null;
}

/** A work order is always raised against an RFR, never standalone. */
export async function createWorkOrder(
  rfrId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseWorkOrderForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_orders")
    .insert({ ...toRow(parsed.data), rfr_id: rfrId })
    .select("id")
    .single();

  if (error) return dbErrorToState(error);

  const partsError = await syncParts(supabase, data.id, readPartIds(formData));
  if (partsError) return dbErrorToState(partsError);

  refresh();
  revalidatePath("/[locale]/rfrs", "page");
  return redirect({
    href: { pathname: "/work-orders", query: { id: data.id } },
    locale: gate.locale,
  });
}

export async function updateWorkOrder(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardOps();
  if (denied(gate)) return gate;

  const parsed = parseWorkOrderForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  // Writing repair_end_at here is what advances the PM schedule, via the
  // trigger. Nothing else needs doing.
  const { error } = await supabase.from("work_orders").update(toRow(parsed.data)).eq("id", id);
  if (error) return dbErrorToState(error);

  const partsError = await syncParts(supabase, id, readPartIds(formData));
  if (partsError) return dbErrorToState(partsError);

  refresh();
  revalidatePath("/[locale]/periodic-maintenance", "page");
  return redirect({
    href: { pathname: "/work-orders", query: { id } },
    locale: gate.locale,
  });
}
