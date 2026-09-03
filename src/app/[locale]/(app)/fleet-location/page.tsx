import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { FleetLocationLive } from "@/components/ui/fleet-location-live";
import { loadFleetLocations } from "./queries";
import { buildFleetLocationFilters } from "./filters";

const MODULE = "fleet-location";

/**
 * Fleet location (roadmap: GPS Integration, item 2). Read-only — no drawer,
 * no write path; a vehicle's position comes only from a GPS ping, never
 * manual entry. Shows every vehicle regardless of whether it has a ping
 * yet, since "no GPS data" is the real, expected state for the whole fleet
 * until a provider is wired in (src/lib/gps/adapters/*.ts).
 *
 * Filtering narrows the row set handed to `FleetLocationLive` before it ever
 * mounts — its realtime subscription only ever updates positions of rows
 * already in its state, never adds new ones, so a filtered-out vehicle
 * simply never enters the live set rather than needing to be hidden again
 * on every ping.
 */
export default async function FleetLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  await requireUser(locale);
  const sp = await searchParams;

  const t = await getTranslations("fleetLocation");
  const tNav = await getTranslations("nav");

  const [all, { state: filterState, saved }] = await Promise.all([
    loadFleetLocations(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildFleetLocationFilters(
    {
      vehicle: t("field.vehicle"),
      vendor: t("field.vendor"),
      speed: t("field.speed"),
      ignition: t("field.ignition"),
      lastSeen: t("field.lastSeen"),
    },
    all,
  );

  const rows = applyFilters(all, filters, filterState);
  const withPosition = rows.filter((r) => r.latitude !== null).length;

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("gpsAndCameras")}
          title={t("title")}
          actions={
            <span className="tnum text-ink-3">
              {t("reporting", { count: withPosition, total: rows.length })}
            </span>
          }
        />

        <FilterBar
          pathname="/fleet-location"
          controls={toControls(filters)}
          state={filterState}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/fleet-location"
              views={saved}
              state={filterState}
            />
          }
        />

        {withPosition === 0 && (
          <p className="border-b border-hairline px-4 py-3 text-[12.5px] text-ink-3">
            {t("noProviderHint")}
          </p>
        )}
        <FleetLocationLive initialRows={rows} />
      </Panel>
    </div>
  );
}
