import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the vendor KPI trend page. Reads v_vendor_kpi_trend and
 * v_vendor_kpi_section_trend (supabase/migrations/0018_vendor_kpi_trend.sql)
 * — the per-vendor summary (latest %, delta, direction) is derived here by
 * sorting/comparing already-computed DB rows, not by recomputing any KPI
 * math; total_achieved_pct and section_score_pct both come straight from
 * the DB exactly as CLAUDE.md's formulas define them.
 *
 * Neither view is in the checked-in generated types yet — same one-line
 * `as any` bridge as v_audit_log / v_pm_alerts / saved_filters. Removable
 * once 0018 runs and types are regenerated.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type VendorKpiTrendRow = {
  id: string;
  scorecardId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  periodMonth: string;
  totalAchievedPct: number | null;
};

export type VendorKpiSummaryRow = {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  latestMonth: string;
  latestPct: number | null;
  previousMonth: string | null;
  previousPct: number | null;
  deltaPct: number | null;
  direction: "improving" | "declining" | "stable" | "new";
};

export type VendorKpiSectionTrendRow = {
  id: string;
  vendorId: string;
  periodMonth: string;
  sectionName: string;
  sectionWeight: number;
  sectionScorePct: number | null;
};

async function vendorLookup() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendors").select("id, vendor_name, vendor_code");
  if (error) throw error;
  return new Map((data ?? []).map((v) => [v.id, { name: v.vendor_name, code: v.vendor_code }]));
}

export async function loadVendorKpiTrend(): Promise<VendorKpiTrendRow[]> {
  const supabase = await createClient();
  const [{ data, error }, vendors] = await Promise.all([
    (supabase as any)
      .from("v_vendor_kpi_trend")
      .select("scorecard_id, vendor_id, period_month, total_achieved_pct"),
    vendorLookup(),
  ]);
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const vendorId = r.vendor_id as string;
    return {
      id: r.scorecard_id as string,
      scorecardId: r.scorecard_id as string,
      vendorId,
      vendorName: vendors.get(vendorId)?.name ?? vendorId,
      vendorCode: vendors.get(vendorId)?.code ?? "",
      periodMonth: r.period_month as string,
      totalAchievedPct: (r.total_achieved_pct ?? null) as number | null,
    };
  });
}

/** One row per vendor: latest two months compared, so a declining vendor is
 * visible without opening every month individually — sorted worst-delta
 * first, the most actionable ordering for a Planning Manager. */
export function summarizeVendorTrend(rows: VendorKpiTrendRow[]): VendorKpiSummaryRow[] {
  const byVendor = new Map<string, VendorKpiTrendRow[]>();
  for (const row of rows) {
    const list = byVendor.get(row.vendorId) ?? [];
    list.push(row);
    byVendor.set(row.vendorId, list);
  }

  const summaries: VendorKpiSummaryRow[] = [];
  for (const [vendorId, list] of byVendor) {
    const sorted = [...list].sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const deltaPct =
      previous && latest.totalAchievedPct !== null && previous.totalAchievedPct !== null
        ? Math.round((latest.totalAchievedPct - previous.totalAchievedPct) * 100) / 100
        : null;

    summaries.push({
      vendorId,
      vendorName: latest.vendorName,
      vendorCode: latest.vendorCode,
      latestMonth: latest.periodMonth,
      latestPct: latest.totalAchievedPct,
      previousMonth: previous?.periodMonth ?? null,
      previousPct: previous?.totalAchievedPct ?? null,
      deltaPct,
      direction:
        deltaPct === null ? "new" : deltaPct > 0.5 ? "improving" : deltaPct < -0.5 ? "declining" : "stable",
    });
  }

  return summaries.sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0));
}

export async function loadVendorKpiSectionTrend(
  vendorId: string,
): Promise<VendorKpiSectionTrendRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("v_vendor_kpi_section_trend")
    .select("vendor_id, period_month, section_name, section_weight, section_score_pct")
    .eq("vendor_id", vendorId);
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r, i) => ({
    id: `${r.section_name}-${r.period_month}-${i}`,
    vendorId: r.vendor_id as string,
    periodMonth: r.period_month as string,
    sectionName: r.section_name as string,
    sectionWeight: r.section_weight as number,
    sectionScorePct: (r.section_score_pct ?? null) as number | null,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
