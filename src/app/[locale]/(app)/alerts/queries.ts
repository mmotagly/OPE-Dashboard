import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the alerts page. Reads v_pm_alerts and v_rfr_aging_alerts
 * (supabase/migrations/0016_alerts.sql) — both pre-filtered by the DB to
 * exactly the rows that should alert; nothing computed here.
 */

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
  const { data, error } = await supabase
    .from("v_pm_alerts")
    .select(
      "schedule_id, vehicle_id, vehicle_code, plate_number, part_name, scheduled_km, actual_km, km_remaining, maintenance_status",
    );
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.schedule_id!,
    scheduleId: r.schedule_id!,
    vehicleId: r.vehicle_id!,
    vehicleCode: r.vehicle_code!,
    plateNumber: r.plate_number!,
    partName: r.part_name!,
    scheduledKm: r.scheduled_km,
    actualKm: r.actual_km,
    kmRemaining: r.km_remaining,
    status: r.maintenance_status!,
  }));
}

/**
 * Roadmap item 5 (2026-08-30): the earlier, lower-urgency tier — parts that
 * will need service soon but aren't due_now/overdue yet. Reads
 * v_periodic_maintenance directly (already in generated types since 0001)
 * rather than v_pm_alerts, which deliberately excludes due_soon.
 */
export async function loadPmDueSoon(): Promise<PmAlertRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_periodic_maintenance")
    .select(
      "schedule_id, vehicle_id, vehicle_code, plate_number, part_name, scheduled_km, actual_km, km_remaining, maintenance_status",
    )
    .eq("maintenance_status", "due_soon")
    .order("km_remaining", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.schedule_id!,
    scheduleId: r.schedule_id!,
    vehicleId: r.vehicle_id!,
    vehicleCode: r.vehicle_code!,
    plateNumber: r.plate_number!,
    partName: r.part_name!,
    scheduledKm: r.scheduled_km,
    actualKm: r.actual_km,
    kmRemaining: r.km_remaining,
    status: r.maintenance_status ?? "due_soon",
  }));
}

/** Cheap counts for the sidebar badge — proactive surfacing (roadmap item
 * 5) beyond the /alerts page itself, so a due_now/overdue/aging condition
 * is visible from anywhere in the app, not just when a user checks the
 * board. head:true skips fetching rows, just the count. */
export async function loadAlertCounts(): Promise<number> {
  const supabase = await createClient();
  const [pm, rfr] = await Promise.all([
    supabase.from("v_pm_alerts").select("*", { count: "exact", head: true }),
    supabase.from("v_rfr_aging_alerts").select("*", { count: "exact", head: true }),
  ]);
  if (pm.error || rfr.error) return 0; // badge is a courtesy, never blocks a page load
  return (pm.count ?? 0) + (rfr.count ?? 0);
}

export async function loadRfrAgingAlerts(): Promise<RfrAgingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_rfr_aging_alerts")
    .select(
      "rfr_id, rfr_number, vehicle_id, vehicle_code, plate_number, request_at, description, access_minutes, access_display",
    );
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.rfr_id!,
    rfrId: r.rfr_id!,
    rfrNumber: r.rfr_number!,
    vehicleId: r.vehicle_id!,
    vehicleCode: r.vehicle_code!,
    plateNumber: r.plate_number!,
    requestAt: r.request_at!,
    description: r.description!,
    accessMinutes: r.access_minutes!,
    accessDisplay: r.access_display!,
  }));
}
