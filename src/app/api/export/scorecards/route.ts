import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { canSeeMoney } from "@/lib/roles";
import { loadScorecards } from "@/app/[locale]/(app)/scorecards/queries";

/**
 * CSV export for monthly scorecards (roadmap item 7) — "months" only, not
 * templates (a template has no period, exporting it as a row of history
 * would be misleading). Reuses loadScorecards() as-is; totalAchievedPct
 * comes straight from v_scorecard_totals, not recomputed here. Same
 * visibility as the Scorecards page (canSeeMoney).
 */
export async function GET() {
  const user = await getRouteUser();
  if (!user || !canSeeMoney(user.role)) return new Response("Unauthorized", { status: 401 });

  const rows = await loadScorecards("months");

  const csv = toCsv(rows, [
    { key: "vendorName", header: "Vendor" },
    { key: "vendorCode", header: "Vendor code" },
    { key: "periodMonth", header: "Period month" },
    { key: "status", header: "Status" },
    { key: "totalAchievedPct", header: "Total achieved %" },
    { key: "sectionsWeightTotal", header: "Sections weight total" },
    { key: "sectionCount", header: "Section count" },
    { key: "lineCount", header: "Line count" },
    { key: "approvedAt", header: "Approved at" },
  ]);

  return csvResponse(csv, `scorecards-${new Date().toISOString().slice(0, 10)}.csv`);
}
