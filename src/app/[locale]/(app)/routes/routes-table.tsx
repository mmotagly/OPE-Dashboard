"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { km } from "@/lib/format";
import type { RouteRow, StationRow } from "./queries";

const statusCell = (label: string | null, code: string | null) =>
  label ? <Pill tone={code === "active" ? "go" : "idle"}>{label}</Pill> : orDash(null);

export function RoutesTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: RouteRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  const columns: Column<RouteRow>[] = [
    {
      key: "code",
      header: t("field.routeCode"),
      sortValue: (r) => r.routeCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/routes/${r.id}?entity=route`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.routeCode}
        </Link>
      ),
    },
    {
      key: "name",
      header: t("field.routeName"),
      sortValue: (r) => r.routeName,
      cell: (r) => r.routeName,
    },
    {
      key: "distance",
      header: t("field.routeDistance"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.routeDistanceKm,
      cell: (r) => (r.routeDistanceKm === null ? orDash(null) : km(r.routeDistanceKm)),
    },
    {
      key: "stops",
      header: t("stopsInSequence"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.linkedStations,
      cell: (r) => (
        <Micro bar={false} tone={r.linkedStations === 0 ? "warn" : "neutral"}>
          {t("stopCount", { count: r.linkedStations })}
        </Micro>
      ),
    },
    {
      key: "legTime",
      header: t("field.legTime"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.standardLegTime,
      cell: (r) =>
        r.standardLegTime ? <span className="tnum">{r.standardLegTime}</span> : orDash(null),
    },
    {
      key: "roundTrip",
      header: t("field.roundTripTime"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.standardRoundTripTime,
      cell: (r) =>
        r.standardRoundTripTime ? (
          <span className="tnum">{r.standardRoundTripTime}</span>
        ) : (
          orDash(null)
        ),
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => r.statusLabel,
      cell: (r) => statusCell(r.statusLabel, r.statusCode),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/routes"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}

export function StationsTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: StationRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  const columns: Column<StationRow>[] = [
    {
      key: "code",
      header: t("field.stationCode"),
      sortValue: (r) => r.stationCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/routes/${r.id}?entity=station`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.stationCode}
        </Link>
      ),
    },
    {
      key: "name",
      header: t("field.stationName"),
      sortValue: (r) => r.stationName,
      cell: (r) => r.stationName,
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => r.statusLabel,
      cell: (r) => statusCell(r.statusLabel, r.statusCode),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/routes"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
