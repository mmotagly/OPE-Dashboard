"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import type { ChargingRow } from "./queries";

export function ChargingTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: ChargingRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("charging");
  const tCommon = useTranslations("common");

  const columns: Column<ChargingRow>[] = [
    {
      key: "code",
      header: t("field.sessionCode"),
      sortValue: (r) => r.sessionCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/charging/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.sessionCode}
        </Link>
      ),
    },
    {
      key: "vehicle",
      header: t("field.vehicle"),
      sortValue: (r) => r.vehicleCode,
      cell: (r) => (
        <span className="tnum font-medium">
          {r.vehicleCode}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.plateNumber}</span>
        </span>
      ),
    },
    {
      key: "charger",
      header: t("field.charger"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.chargerCode,
      cell: (r) => <span className="tnum">{r.chargerCode}</span>,
    },
    {
      key: "plugs",
      header: t("field.plugs"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.plugsUsed,
      cell: (r) => <Pill tone="idle">{r.plugsUsed}</Pill>,
    },
    {
      key: "battery",
      header: t("field.battery"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.batteryStartPct,
      cell: (r) =>
        r.batteryStartPct === null && r.batteryEndPct === null
          ? orDash(null)
          : t("batteryRange", {
              from: r.batteryStartPct ?? "—",
              to: r.batteryEndPct ?? "—",
            }),
    },
    {
      key: "duration",
      header: t("field.duration"),
      numeric: true,
      className: "hidden md:table-cell",
      sortValue: (r) => r.duration,
      cell: (r) =>
        // The generated column, rendered as the database reports it.
        r.duration ? <Micro bar={false}>{r.duration}</Micro> : orDash(null),
    },
    {
      key: "energy",
      header: t("field.energy"),
      numeric: true,
      sortValue: (r) => r.energyKwh,
      cell: (r) => (r.energyKwh === null ? orDash(null) : `${r.energyKwh} kWh`),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/charging"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
