import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { canSeeMoney, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import {
  loadVendorKpiSectionTrend,
  loadVendorKpiTrend,
  summarizeVendorTrend,
} from "./queries";
import { SummaryTable } from "./summary-table";
import { HistoryTable } from "./history-table";
import { SectionTable } from "./section-table";

/**
 * Vendor KPI trend — roadmap item 6 (2026-08-30). Scoped to vendors, not
 * drivers: this schema has no per-driver scorecard concept, only
 * vendor-level ones (see 0018's header comment). Same visibility as
 * Scorecards/Invoices (canSeeMoney).
 */
export default async function VendorTrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vendor?: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();

  const t = await getTranslations("vendorTrends");
  const { vendor: vendorId } = await searchParams;

  const allTrend = await loadVendorKpiTrend();
  const summary = summarizeVendorTrend(allTrend);

  const selected = vendorId ? summary.find((s) => s.vendorId === vendorId) : undefined;
  const vendorRows = vendorId ? allTrend.filter((r) => r.vendorId === vendorId) : [];
  const sectionRows = vendorId ? await loadVendorKpiSectionTrend(vendorId) : [];

  return (
    <div className="grid gap-3.5">
      <Panel clip={false}>
        <PanelHead eyebrow={t("eyebrow")} title={t("summaryTitle")} />
        <SummaryTable rows={summary} />
      </Panel>

      {vendorId && (
        <>
          <Panel clip={false}>
            <PanelHead
              title={
                selected
                  ? t("historyTitle", { vendor: selected.vendorName })
                  : t("historyTitleFallback")
              }
            />
            <HistoryTable rows={vendorRows} />
          </Panel>

          <Panel clip={false}>
            <PanelHead title={t("sectionTitle")} />
            <SectionTable rows={sectionRows} />
          </Panel>
        </>
      )}
    </div>
  );
}
