import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { canSeeMoney, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { StatBar, Stat } from "@/components/ui/stat";
import { percent, duration } from "@/lib/format";
import {
  loadBusDaysByVendor,
  loadFleetUtilizationTrend,
  loadPmCompliance,
  loadRfrResolutionTrend,
} from "./queries";
import { VendorBusDaysTable } from "./vendor-bus-days-table";
import { RfrResolutionTable } from "./rfr-resolution-table";
import { FleetUtilizationTable } from "./fleet-utilization-table";

/**
 * Planning Manager dashboard — roadmap item 4 (2026-08-30). Same visibility
 * as Finance (canSeeMoney): super_admin, admin, supervisor — it surfaces
 * vendor bus-days, which is billing-adjacent. Every number is read from a
 * DB view (0017) or the existing v_vendor_monthly_bus_counts (0014);
 * nothing is computed in this page beyond picking "the latest month" for
 * the two trend views' headline Stat.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();

  const t = await getTranslations("dashboard");

  const today = new Date().toISOString().slice(0, 7);
  const { month = today } = await searchParams;

  const [pmCompliance, rfrTrend, utilizationTrend, busDays] = await Promise.all([
    loadPmCompliance(),
    loadRfrResolutionTrend(),
    loadFleetUtilizationTrend(),
    loadBusDaysByVendor(month),
  ]);

  const latestUtilization = utilizationTrend[0] ?? null;
  const latestResolution = rfrTrend[0] ?? null;
  const totalBusDays = busDays.reduce((sum, r) => sum + r.busDays, 0);

  return (
    <div className="grid gap-3.5">
      <Panel clip={false}>
        <PanelHead eyebrow={t("eyebrow")} title={t("title")} />
        <StatBar>
          <Stat
            label={t("stat.pmCompliance")}
            value={percent(pmCompliance.compliancePct)}
            tone={
              pmCompliance.compliancePct !== null && pmCompliance.compliancePct < 80
                ? "warn"
                : "go"
            }
          />
          <Stat
            label={t("stat.fleetUtilization")}
            value={latestUtilization ? percent(latestUtilization.utilizationPct) : "—"}
            tone="neutral"
          />
          <Stat
            label={t("stat.avgResolution")}
            value={latestResolution ? duration(latestResolution.avgAccessMinutes) : "—"}
            tone="neutral"
          />
          <Stat
            label={t("stat.totalBusDays", { month })}
            value={Math.round(totalBusDays * 100) / 100}
            tone="neutral"
          />
        </StatBar>
      </Panel>

      <Panel clip={false}>
        <PanelHead title={t("section.busDaysByVendor", { month })} />
        <VendorBusDaysTable rows={busDays} />
      </Panel>

      <Panel clip={false}>
        <PanelHead title={t("section.rfrResolution")} />
        <RfrResolutionTable rows={rfrTrend} />
      </Panel>

      <Panel clip={false}>
        <PanelHead title={t("section.fleetUtilization")} />
        <FleetUtilizationTable rows={utilizationTrend} />
      </Panel>
    </div>
  );
}
