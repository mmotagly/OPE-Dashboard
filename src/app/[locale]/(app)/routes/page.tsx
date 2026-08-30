import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadLookups } from "@/lib/lookups";
import { loadRoutes, loadStations, type RouteEntity } from "./queries";
import { buildRouteFilters, buildStationFilters } from "./filters";
import { RoutesTable, StationsTable } from "./routes-table";
import { RouteDrawer } from "./route-drawer";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/**
 * Routes and stations on one page. Each entity carries its own filter set and
 * its own saved filters — a route filter is meaningless on a station list.
 */
export default async function RoutesPage({
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
  const entity: RouteEntity = one("entity") === "stations" ? "stations" : "routes";
  const isStations = entity === "stations";
  const moduleKey = isStations ? "routes:stations" : "routes";

  const t = await getTranslations("master");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [routes, stations, statuses, { state: filterState, saved }] = await Promise.all([
    loadRoutes(""),
    loadStations(""),
    loadLookups("generic_status"),
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

  const routeFilters = buildRouteFilters(labels, { statuses, rows: routes });
  const stationFilters = buildStationFilters(labels, { statuses, rows: stations });

  const visibleRoutes = isStations ? routes : applyFilters(routes, routeFilters, filterState);
  const visibleStations = isStations
    ? applyFilters(stations, stationFilters, filterState)
    : stations;

  const chips: Chip[] = [
    { value: "", label: t("routesTab"), count: visibleRoutes.length },
    { value: "stations", label: t("stationsTab"), count: visibleStations.length },
  ];

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (isStations) baseQuery.entity = "stations";
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...filterQuery };

  const drawerMode =
    canEdit && mode === "new"
      ? "new"
      : canEdit && mode === "edit" && id
        ? "edit"
        : id
          ? "view"
          : null;

  const newLabel = isStations ? t("newStation") : t("newRoute");

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead
          eyebrow={tNav("fleet")}
          title={isStations ? t("stationsTitle") : t("routesTitle")}
          actions={
            canEdit ? (
              <Link
                href={{ pathname: "/routes", query: { ...query, mode: "new" } }}
                className={newButton}
              >
                {newLabel}
              </Link>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/routes"
          controls={
            isStations ? toControls(stationFilters) : toControls(routeFilters)
          }
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={isStations ? t("searchStations") : t("searchRoutes")}
          savedViews={
            <SavedViewsTabs
              module={moduleKey}
              pathname="/routes"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={isStations ? "stations" : ""}
          param="entity"
          pathname="/routes"
          extraQuery={filterQuery}
        />

        {isStations ? (
          <StationsTable
            rows={visibleStations}
            selectedId={id ?? null}
            query={query}
            sort={sort}
            dir={dir}
          />
        ) : (
          <RoutesTable
            rows={visibleRoutes}
            selectedId={id ?? null}
            query={query}
            sort={sort}
            dir={dir}
          />
        )}
      </Panel>

      {drawerMode && (
        <RouteDrawer
          entity={entity}
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/routes", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
