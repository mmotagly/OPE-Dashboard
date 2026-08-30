import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the Planning Manager dashboard. Every number is read from a
 * DB view (supabase/migrations/0017_dashboard.sql) or, for bus-days per
 * vendor, the existing v_vendor_monthly_bus_counts (0014) — nothing is
 * recomputed here beyond summing the three views' rows into shapes the page
 * can render and joining vendor names in memory (reference data, not domain
 * logic, same pattern operations/queries.ts already uses for status/shift
 * lookups).
 *
 * v_pm_compliance_summary, v_rfr_resolution_summary and
 * v_fleet_utilization_monthly aren't in the checked-in generated types yet —
 * same one-line `as any` bridge as v_audit_log / v_pm_alerts /
 * saved_filters. Removable once 0017 runs and types are regenerated.
 * v_vendor_monthly_bus_counts predates this session and IS already typed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type PmCompliance = {
  okCount: number;
  totalCount: number;
  compliancePct: number | null;
};

export type RfrResolutionMonth = {
  periodMonth: string;
  completedCount: number;
  avgAccessMinutes: number | null;
  medianAccessMinutes: number | null;
};

export type FleetUtilizationMonth = {
  periodMonth: string;
  activeVehicleCount: number;
  fleetSize: number;
  utilizationPct: number | null;
};

export type VendorBusDays = {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  busDays: number;
};

export async function loadPmCompliance(): Promise<PmCompliance> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_pm_compliance_summary")
    .select("ok_count, total_count, compliance_pct")
    .maybeSingle();
  if (error) throw error;

  return {
    okCount: (data?.ok_count ?? 0) as number,
    totalCount: (data?.total_count ?? 0) as number,
    compliancePct: (data?.compliance_pct ?? null) as number | null,
  };
}

export async function loadRfrResolutionTrend(months = 12): Promise<RfrResolutionMonth[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_rfr_resolution_summary")
    .select("period_month, completed_count, avg_access_minutes, median_access_minutes")
    .limit(months);
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    periodMonth: r.period_month as string,
    completedCount: r.completed_count as number,
    avgAccessMinutes: (r.avg_access_minutes ?? null) as number | null,
    medianAccessMinutes: (r.median_access_minutes ?? null) as number | null,
  }));
}

export async function loadFleetUtilizationTrend(months = 12): Promise<FleetUtilizationMonth[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_fleet_utilization_monthly")
    .select("period_month, active_vehicle_count, fleet_size, utilization_pct")
    .limit(months);
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    periodMonth: r.period_month as string,
    activeVehicleCount: r.active_vehicle_count as number,
    fleetSize: r.fleet_size as number,
    utilizationPct: (r.utilization_pct ?? null) as number | null,
  }));
}

/** Sums bus_days across shifts per vendor for one month. `month` is any
 * date within the target month — DB-side date_trunc already normalizes it. */
export async function loadBusDaysByVendor(month: string): Promise<VendorBusDays[]> {
  const supabase = await createClient();

  const periodMonth = `${month.slice(0, 7)}-01`;

  const [{ data: counts, error: countsError }, { data: vendors, error: vendorsError }] =
    await Promise.all([
      supabase
        .from("v_vendor_monthly_bus_counts")
        .select("vendor_id, bus_days")
        .eq("period_month", periodMonth),
      supabase.from("vendors").select("id, vendor_name, vendor_code"),
    ]);
  if (countsError) throw countsError;
  if (vendorsError) throw vendorsError;

  const vendorById = new Map(
    (vendors ?? []).map((v) => [v.id, { name: v.vendor_name, code: v.vendor_code }]),
  );

  const totals = new Map<string, number>();
  for (const row of counts ?? []) {
    const vendorId = row.vendor_id as string | null;
    if (!vendorId) continue;
    totals.set(vendorId, (totals.get(vendorId) ?? 0) + Number(row.bus_days ?? 0));
  }

  return [...totals.entries()]
    .map(([vendorId, busDays]) => ({
      vendorId,
      vendorName: vendorById.get(vendorId)?.name ?? vendorId,
      vendorCode: vendorById.get(vendorId)?.code ?? "",
      busDays: Math.round(busDays * 100) / 100,
    }))
    .sort((a, b) => b.busDays - a.busDays);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
