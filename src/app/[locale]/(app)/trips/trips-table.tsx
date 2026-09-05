"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { time } from "@/lib/format";
import type { TripSummaryRow } from "./trip-queries";

export function TripsTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: TripSummaryRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");

  const columns: Column<TripSummaryRow>[] = [
    {
      key: "code",
      header: t("field.tripCode"),
      sortValue: (r) => r.tripCode,
      // Same code-link-vs-row-click convention as every other module — this
      // cell alone navigates to the standalone page instead of opening the
      // Drawer. See CLAUDE.md's row-click-vs-code-link convention.
      cell: (r) => (
        <Link
          href={`/trips/${r.id}?entity=trip`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.tripCode}
        </Link>
      ),
    },
    {
      key: "vehicle",
      header: t("field.vehicle"),
      sortValue: (r) => r.vehicleCode,
      cell: (r) => (
        <>
          <span className="tnum font-medium">{r.vehicleCode}</span>
          <span className="ms-2 text-[12px] text-ink-3">{r.plateNumber}</span>
        </>
      ),
    },
    {
      key: "route",
      header: t("field.route"),
      sortValue: (r) => r.routeName,
      cell: (r) => (
        <>
          <span className="tnum">{r.routeCode}</span>
          <span className="ms-2 text-[12.5px] text-ink-2">{r.routeName}</span>
        </>
      ),
    },
    {
      key: "date",
      header: t("field.date"),
      sortValue: (r) => r.tripDate,
      className: "hidden sm:table-cell",
      cell: (r) => <span className="tnum">{r.tripDate}</span>,
    },
    {
      key: "start",
      header: t("field.outboundStart"),
      numeric: true,
      sortValue: (r) => r.outboundStartAt,
      cell: (r) => (r.outboundStartAt ? <span className="tnum">{time(r.outboundStartAt)}</span> : orDash(null)),
    },
    {
      key: "direction",
      header: t("field.direction"),
      className: "hidden md:table-cell",
      cell: (r) => (
        <Micro bar={false} tone="neutral">
          {r.hasReturn ? t("direction.roundTrip") : t("direction.outboundOnly")}
        </Micro>
      ),
    },
    {
      key: "legTime",
      header: t("field.legTime"),
      numeric: true,
      className: "hidden lg:table-cell",
      sortValue: (r) => r.outboundLegMinutes,
      cell: (r) => (r.outboundLegDisplay ? <span className="tnum">{r.outboundLegDisplay}</span> : orDash(null)),
    },
    {
      key: "roundTrip",
      header: t("field.roundTripTime"),
      numeric: true,
      className: "hidden lg:table-cell",
      sortValue: (r) => r.roundTripMinutes,
      cell: (r) => (r.roundTripDisplay ? <span className="tnum">{r.roundTripDisplay}</span> : orDash(null)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/trips"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
