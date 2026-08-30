import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the alerts page. Reads v_pm_alerts and v_rfr_aging_alerts
 * (supabase/migrations/0016_alerts.sql) — both pre-filtered by the DB to
 * exactly the rows that should alert; nothing computed here.
 *
 * Neither view is in the checked-in generated types yet — same one-line
 * `as any` bridge as v_audit_log (activity-log/queries.ts) and saved_filters
 * (src/lib/saved-filters-db.ts). Removable once 0016 runs and types are
 * regenerated.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type PmAlertRow = {
  /** = scheduleId — DataTable requires an `id` field. */
  id: string;
  scheduleId: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  partName: string;
  scheduledKm: number | null;
  actualKm: number | null;
  kmRemaining: number | null;
  status: "due_now" | "overdue" | string;
};

export type RfrAgingRow = {
  /** = rfrId — DataTable requires an `id` field. */
  id: string;
  rfrId: string;
  rfrNumber: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  requestAt: string;
  description: string;
  accessMinutes: number;
  accessDisplay: string;
};

export async function loadPmAlerts(): Promise<PmAlertRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_pm_alerts")
    .select(
      "schedule_id, vehicle_id, vehicle_code, plate_number, part_name, scheduled_km, actual_km, km_remaining, maintenance_status",
    );
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.schedule_id as string,
    scheduleId: r.schedule_id as string,
    vehicleId: r.vehicle_id as string,
    vehicleCode: r.vehicle_code as string,
    plateNumber: r.plate_number as string,
    partName: r.part_name as string,
    scheduledKm: (r.scheduled_km ?? null) as number | null,
    actualKm: (r.actual_km ?? null) as number | null,
    kmRemaining: (r.km_remaining ?? null) as number | null,
    status: r.maintenance_status as string,
  }));
}

export async function loadRfrAgingAlerts(): Promise<RfrAgingRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_rfr_aging_alerts")
    .select(
      "rfr_id, rfr_number, vehicle_id, vehicle_code, plate_number, request_at, description, access_minutes, access_display",
    );
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.rfr_id as string,
    rfrId: r.rfr_id as string,
    rfrNumber: r.rfr_number as string,
    vehicleId: r.vehicle_id as string,
    vehicleCode: r.vehicle_code as string,
    plateNumber: r.plate_number as string,
    requestAt: r.request_at as string,
    description: r.description as string,
    accessMinutes: r.access_minutes as number,
    accessDisplay: r.access_display as string,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
