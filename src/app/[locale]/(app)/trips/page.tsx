import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, canWriteOps, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { ExportCsvLink } from "@/components/ui/export-csv-link";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadLookups } from "@/lib/lookups";
import { loadRoutes, loadStations, type RouteEntity } from "./queries";
import { loadTripEntryOptions, loadTrips } from "./trip-queries";
import { buildRouteFilters, buildStationFilters, buildTripFilters } from "./filters";
import { RoutesTable, StationsTable } from "./routes-table";
import { TripsTable } from "./trips-table";
import { RouteDrawer } from "./route-drawer";
import { TripDrawer } from "./trip-drawer";
import { TripEntryPanel } from "./trip-entry-panel";

type PageEntity = "trips" | RouteEntity;

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/**
 * Trips, routes and stations on one page. Trips (real, timestamped runs —
 * see 0023_trips.sql) is the default landing tab; routes/stations are still
 * the fixed reference data they always were, just one tab over. Each entity
 * carries its own filter set and its own saved filters.
 */
export default async function TripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const one = (key: string) => {
    const value = sp[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const id = one("id") || undefined;
  const mode = one("mode");
  const sort = one("sort");
  const dir = one("dir") || "asc";

  const rawEntity = one("entity");
  const entity: PageEntity =
    rawEntity === "stations" ? "stations" : rawEntity === "routes" ? "routes" : "trips";
  const isTrips = entity === "trips";
  const isStations = entity === "stations";
  const moduleKey = isTrips ? "trips" : isStations ? "routes:stations" : "routes";

  const t = await getTranslations("master");
  const tTrips = await getTranslations("trips");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  const user = await requireUser(locale);
  const canEditReference = canWriteMaster(user.role);
  const canEditTrips = canWriteOps(user.role);

  const [routes, stations, statuses, trips, tripOptions, { state: filterState, saved }] =
    await Promise.all([
      loadRoutes(""),
      loadStations(""),
      loadLookups("generic_status"),
      loadTrips({}),
      loadTripEntryOptions(),
      resolveFilters(moduleKey, sp),
    ]);

  const labels = {
    routeCode: t("field.routeCode"),
    routeName: t("field.routeName"),
    routeDistance: t("field.routeDistance"),
    stopsInSequence: t("stopsInSequence"),
    numberOfStations: t("field.numberOfStations"),
    legTime: t("field.legTime"),
    roundTripTime: t("field.roundTripTime"),
    stationCode: t("field.stationCode"),
    stationName: t("field.stationName"),
    status: t("field.status"),
  };

  const tripLabels = {
    vehicle: tTrips("field.vehicle"),
    route: tTrips("field.route"),
    date: tTrips("field.date"),
    hasReturn: tTrips("field.hasReturn"),
  };

  const routeFilters = buildRouteFilters(labels, { statuses, rows: routes });
  const stationFilters = buildStationFilters(labels, { statuses, rows: stations });
  const tripFilters = buildTripFilters(tripLabels, { routes: tripOptions.routes });

  const visibleRoutes = isTrips || isStations ? routes : applyFilters(routes, routeFilters, filterState);
  const visibleStations = isStations
    ? applyFilters(stations, stationFilters, filterState)
    : stations;
  const visibleTrips = isTrips ? applyFilters(trips, tripFilters, filterState) : trips;

  const chips: Chip[] = [
    { value: "", label: tTrips("tripsTab"), count: visibleTrips.length },
    { value: "routes", label: t("routesTab"), count: visibleRoutes.length },
    { value: "stations", label: t("stationsTab"), count: visibleStations.length },
  ];

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (entity !== "trips") baseQuery.entity = entity;
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...filterQuery };

  if (isTrips && mode === "entry") {
    return (
      <div className="font-inter contents">
        <TripEntryPanel
          operationId={one("operationId") || undefined}
          date={one("date") || undefined}
          vehicleId={one("vehicleId") || undefined}
          shiftId={one("shiftId") || undefined}
          backTo={query}
        />
      </div>
    );
  }

  const drawerMode = isTrips
    ? id
      ? "view"
      : null
    : canEditReference && mode === "new"
      ? "new"
      : canEditReference && mode === "edit" && id
        ? "edit"
        : canEditReference && mode === "import" && !isStations
          ? "import"
          : id
            ? "view"
            : null;

  const newLabel = isTrips ? tTrips("newTrips") : isStations ? t("newStation") : t("newRoute");
  const newHref = isTrips
    ? { pathname: "/trips", query: { ...query, entity: "trips", mode: "entry" } }
    : { pathname: "/trips", query: { ...query, mode: "new" } };
  const showNew = isTrips ? canEditTrips : canEditReference;

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("operations")}
          title={isTrips ? tTrips("tripsTitle") : isStations ? t("stationsTitle") : t("routesTitle")}
          actions={
            <>
              {canEditReference && !isTrips && !isStations && (
                <>
                  <ExportCsvLink href="/api/export/routes" label={tCommon("exportCsv")} />
                  <Link
                    href={{ pathname: "/trips", query: { ...query, mode: "import" } }}
                    className="rounded-control border border-hairline bg-surface px-3 py-1.5 text-button font-medium text-ink transition-colors hover:bg-raise"
                  >
                    {tCommon("importCsv")}
                  </Link>
                </>
              )}
              {showNew && (
                <Link href={newHref} className={newButton}>
                  {newLabel}
                </Link>
              )}
            </>
          }
        />

        <FilterBar
          pathname="/trips"
          controls={
            isTrips ? toControls(tripFilters) : isStations ? toControls(stationFilters) : toControls(routeFilters)
          }
          defaultFieldKeys={isTrips ? ["vehicle", "date"] : ["code", "name"]}
          state={filterState}
          baseQuery={baseQuery}
          savedViews={
            <SavedViewsTabs
              module={moduleKey}
              pathname="/trips"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={isTrips ? "" : entity}
          param="entity"
          pathname="/trips"
          extraQuery={filterQuery}
        />

        {isTrips ? (
          <TripsTable rows={visibleTrips} selectedId={id ?? null} query={query} sort={sort} dir={dir} />
        ) : isStations ? (
          <StationsTable
            rows={visibleStations}
            selectedId={id ?? null}
            query={query}
            sort={sort}
            dir={dir}
          />
        ) : (
          <RoutesTable rows={visibleRoutes} selectedId={id ?? null} query={query} sort={sort} dir={dir} />
        )}
      </Panel>

      {drawerMode && isTrips && (
        <TripDrawer id={id} closeHref={{ pathname: "/trips", query }} canEdit={canEditTrips} />
      )}

      {drawerMode && !isTrips && (
        <RouteDrawer
          entity={isStations ? "stations" : "routes"}
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/trips", query }}
          canEdit={canEditReference}
        />
      )}
    </div>
  );
}
