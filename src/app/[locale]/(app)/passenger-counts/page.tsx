import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { loadPassengerCounts } from "./queries";
import { PassengerCountsTable } from "./passenger-counts-table";

/**
 * Passenger counts (roadmap item 4, Counter Cams). Read-only, most recent
 * 200 counting-window reports across the fleet. Empty until a counter-cam
 * camera exists and either the on-demand count endpoint
 * (POST /api/cameras/[cameraId]/counts) or a future scheduled poll has
 * been run at least once — the honest state right now.
 */
export default async function PassengerCountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);

  const t = await getTranslations("passengerCounts");
  const tNav = await getTranslations("nav");

  const rows = await loadPassengerCounts();

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead eyebrow={tNav("operations")} title={t("title")} actions={<span className="tnum text-ink-3">{rows.length}</span>} />
        {rows.length === 0 && (
          <p className="border-b border-hairline px-4 py-3 text-[12.5px] text-ink-3">{t("noDataHint")}</p>
        )}
        <PassengerCountsTable rows={rows} />
      </Panel>
    </div>
  );
}
