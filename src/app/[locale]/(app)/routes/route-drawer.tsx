import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { CsvImportForm } from "@/components/ui/csv-import-form";
import { km } from "@/lib/format";
import { confirmImportRoutes, previewImportRoutes } from "./actions";
import {
  EMPTY_ROUTE_FORM,
  EMPTY_STATION_FORM,
  loadRoute,
  loadRouteOptions,
  loadRouteStations,
  loadStation,
  toRouteFormValues,
  toStationFormValues,
  type RouteEntity,
} from "./queries";
import { RouteForm, StationForm } from "./route-form";
import { RouteStationsEditor } from "./route-stations-editor";

const editButton =
  "rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90";

/**
 * Routes and stations share the page, so they share the drawer. Which entity is
 * open follows the `entity` filter the table is showing.
 */
export async function RouteDrawer({
  entity,
  mode,
  id,
  closeHref,
  canEdit,
}: {
  entity: RouteEntity;
  mode: "view" | "new" | "edit" | "import";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");

  const isStations = entity === "stations";

  if (mode === "import") {
    return (
      <Drawer
        code={`${tCommon("importCsv")} · ${t("routesTitle")}`}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <div className="p-4">
          <CsvImportForm
            previewAction={previewImportRoutes}
            confirmAction={confirmImportRoutes}
            templateHref="/api/import-template/routes"
            extraColumns={[{ key: "route_name", header: t("field.routeName") }]}
          />
        </div>
      </Drawer>
    );
  }

  const options = await loadRouteOptions();

  if (mode === "new" || mode === "edit") {
    const record =
      mode === "edit" && id
        ? isStations
          ? await loadStation(id)
          : await loadRoute(id)
        : null;

    if (mode === "edit" && !record) {
      return (
        <Drawer
          code={isStations ? t("editStation") : t("editRoute")}
          closeHref={closeHref}
          closeLabel={tCommon("cancel")}
        >
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    if (isStations) {
      const station = record as Awaited<ReturnType<typeof loadStation>>;
      return (
        <Drawer
          code={station ? `${t("editStation")} · ${station.stationCode}` : t("newStation")}
          sub={station?.stationName}
          closeHref={closeHref}
          closeLabel={tCommon("cancel")}
        >
          <StationForm
            mode={station ? "edit" : "create"}
            stationId={station?.id}
            options={options}
            initial={station ? toStationFormValues(station) : EMPTY_STATION_FORM}
            backTo={closeHref.query}
          />
        </Drawer>
      );
    }

    const route = record as Awaited<ReturnType<typeof loadRoute>>;
    return (
      <Drawer
        code={route ? `${t("editRoute")} · ${route.routeCode}` : t("newRoute")}
        sub={route?.routeName}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <RouteForm
          mode={route ? "edit" : "create"}
          routeId={route?.id}
          options={options}
          initial={route ? toRouteFormValues(route) : EMPTY_ROUTE_FORM}
          backTo={closeHref.query}
          linkedStations={route?.linkedStations}
        />
      </Drawer>
    );
  }

  /* ---- view ---- */

  if (isStations) {
    const station = id ? await loadStation(id) : null;

    if (!station) {
      return (
        <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={station.stationCode}
        sub={station.stationName}
        pill={
          station.statusLabel ? (
            <Pill tone={station.statusCode === "active" ? "go" : "idle"}>
              {station.statusLabel}
            </Pill>
          ) : undefined
        }
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
        footer={
          canEdit ? (
            <Link
              href={{
                pathname: "/routes",
                query: { entity: "stations", mode: "edit", id: station.id },
              }}
              className={editButton}
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <Section title={t("record")}>
          <KeyValue>
            <Row label={t("field.stationName")}>{station.stationName}</Row>
            <Row label={t("field.stationCode")} muted>
              <span className="tnum">{station.stationCode}</span>
            </Row>
          </KeyValue>
        </Section>
      </Drawer>
    );
  }

  const route = id ? await loadRoute(id) : null;

  if (!route) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const stops = await loadRouteStations(route.id);

  return (
    <Drawer
      code={route.routeCode}
      sub={route.routeName}
      pill={
        route.statusLabel ? (
          <Pill tone={route.statusCode === "active" ? "go" : "idle"}>
            {route.statusLabel}
          </Pill>
        ) : undefined
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{ pathname: "/routes", query: { mode: "edit", id: route.id } }}
            className={editButton}
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.routeName")}>{route.routeName}</Row>
          <Row label={t("field.routeDistance")}>
            {route.routeDistanceKm === null ? (
              "—"
            ) : (
              <span className="tnum">{km(route.routeDistanceKm)} km</span>
            )}
          </Row>
          <Row label={t("field.numberOfStations")} muted>
            {route.numberOfStations === null ? (
              "—"
            ) : (
              <span className="tnum">{route.numberOfStations}</span>
            )}
          </Row>
          <Row label={t("field.legTime")} muted>
            {route.standardLegTime ? (
              <span className="tnum">{route.standardLegTime}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.roundTripTime")} muted>
            {route.standardRoundTripTime ? (
              <span className="tnum">{route.standardRoundTripTime}</span>
            ) : (
              "—"
            )}
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("stopsInSequence")}>
        <RouteStationsEditor
          routeId={route.id}
          stops={stops}
          options={options}
          canEdit={canEdit}
        />
      </Section>
    </Drawer>
  );
}
