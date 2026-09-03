import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadPassengerCounts } from "./queries";
import { buildPassengerCountFilters } from "./filters";
import { PassengerCountsTable } from "./passenger-counts-table";

const MODULE = "passenger-counts";

/**
 * Passenger counts (roadmap item 4, Counter Cams). Read-only, most recent
 * 200 counting-window reports across the fleet. Empty until a counter-cam
 * camera exists and either the on-demand count endpoint
 * (POST /api/cameras/[cameraId]/counts) or a future scheduled poll has
 * been run at least once — the honest state right now.
 */
export default async function PassengerCountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  await requireUser(locale);
  const sp = await searchParams;

  const t = await getTranslations("passengerCounts");
  const tNav = await getTranslations("nav");

  const [all, { state: filterState, saved }] = await Promise.all([
    loadPassengerCounts(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildPassengerCountFilters(
    {
      vehicle: t("field.vehicle"),
      camera: t("field.camera"),
      window: t("field.window"),
      enter: t("field.enter"),
      exit: t("field.exit"),
      net: t("field.net"),
    },
    all,
  );

  const rows = applyFilters(all, filters, filterState);

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead eyebrow={tNav("gpsAndCameras")} title={t("title")} actions={<span className="tnum text-ink-3">{rows.length}</span>} />

        <FilterBar
          pathname="/passenger-counts"
          controls={toControls(filters)}
          state={filterState}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/passenger-counts"
              views={saved}
              state={filterState}
            />
          }
        />

        {all.length === 0 && (
          <p className="border-b border-hairline px-4 py-3 text-[12.5px] text-ink-3">{t("noDataHint")}</p>
        )}
        <PassengerCountsTable rows={rows} />
      </Panel>
    </div>
  );
}
