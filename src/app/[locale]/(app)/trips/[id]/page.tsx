import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadRoute, loadRouteOptions, loadRouteStations, loadStation } from "../queries";
import { RouteDetailBody, StationDetailBody } from "../route-drawer";

const editButton =
  "rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90";

/**
 * Standalone full-page view — reached by clicking a route's or station's
 * code in the list, as opposed to clicking anywhere else in the row (which
 * still opens the overlay Drawer at /trips?id=...). Which entity is shown
 * follows `?entity=`, same as the Drawer follows the table's own `entity`
 * filter. Same detail content (RouteDetailBody / StationDetailBody),
 * different chrome (DetailPage vs. Drawer). See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export default async function RouteOrStationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ entity?: string }>;
}) {
  const { locale, id } = await params;
  const { entity } = await searchParams;
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");

  if (entity === "station") {
    const station = await loadStation(id);
    if (!station) notFound();

    return (
      <div className="font-inter contents">
        <DetailPage
          code={station.stationCode}
          sub={station.stationName}
          pill={
            station.statusLabel ? (
              <Pill tone={station.statusCode === "active" ? "go" : "idle"}>
                {station.statusLabel}
              </Pill>
            ) : undefined
          }
          backHref="/trips"
          backLabel={t("routesTitle")}
          actions={
            canEdit ? (
              <Link
                href={{
                  pathname: "/trips",
                  query: { entity: "stations", mode: "edit", id: station.id },
                }}
                className={editButton}
              >
                {tCommon("edit")}
              </Link>
            ) : undefined
          }
        >
          <StationDetailBody station={station} />
        </DetailPage>
      </div>
    );
  }

  const route = await loadRoute(id);
  if (!route) notFound();

  const [stops, options] = await Promise.all([
    loadRouteStations(route.id),
    loadRouteOptions(),
  ]);

  return (
    <div className="font-inter contents">
      <DetailPage
        code={route.routeCode}
        sub={route.routeName}
        pill={
          route.statusLabel ? (
            <Pill tone={route.statusCode === "active" ? "go" : "idle"}>
              {route.statusLabel}
            </Pill>
          ) : undefined
        }
        backHref="/trips"
        backLabel={t("routesTitle")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/trips", query: { mode: "edit", id: route.id } }}
              className={editButton}
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <RouteDetailBody route={route} stops={stops} options={options} canEdit={canEdit} />
      </DetailPage>
    </div>
  );
}
