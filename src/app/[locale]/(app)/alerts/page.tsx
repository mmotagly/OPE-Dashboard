import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { loadPmAlerts, loadPmDueSoon, loadRfrAgingAlerts } from "./queries";
import { PmAlertsTable } from "./pm-alerts-table";
import { RfrAgingTable } from "./rfr-aging-table";

/**
 * Alerts — roadmap item 3 (2026-08-30). In-app, not email: no email
 * provider is configured in this project. PM-overdue and RFR-aging, both
 * pre-filtered and pre-sorted by the DB (v_pm_alerts / v_rfr_aging_alerts,
 * 0016). Visible to every authenticated role — RLS on the underlying
 * tables already governs what each role can see; this page adds no new
 * visibility beyond what RFRs/Periodic maintenance already grant.
 */
export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);

  const t = await getTranslations("alerts");

  const [pmAlerts, pmDueSoon, rfrAlerts] = await Promise.all([
    loadPmAlerts(),
    loadPmDueSoon(),
    loadRfrAgingAlerts(),
  ]);

  return (
    <div className="grid gap-3.5">
      <Panel clip={false}>
        <PanelHead
          eyebrow={t("eyebrow")}
          title={t("pmTitle")}
          actions={<span className="tnum">{pmAlerts.length}</span>}
        />
        <PmAlertsTable rows={pmAlerts} />
      </Panel>

      <Panel clip={false}>
        <PanelHead
          eyebrow={t("eyebrow")}
          title={t("rfrTitle")}
          actions={<span className="tnum">{rfrAlerts.length}</span>}
        />
        <RfrAgingTable rows={rfrAlerts} />
      </Panel>

      <Panel clip={false}>
        <PanelHead
          eyebrow={t("eyebrow")}
          title={t("pmUpcomingTitle")}
          actions={<span className="tnum">{pmDueSoon.length}</span>}
        />
        <PmAlertsTable rows={pmDueSoon} />
      </Panel>
    </div>
  );
}
