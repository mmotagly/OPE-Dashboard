"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import type { HeadwayRow } from "./trip-queries";

type Row = HeadwayRow & { id: string };

export function HeadwayTable({ rows }: { rows: HeadwayRow[] }) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");

  const columns: Column<Row>[] = [
    {
      key: "station",
      header: t("field.station"),
      sortValue: (r) => r.stationName,
      cell: (r) => (
        <>
          <span className="tnum font-medium">{r.stationCode}</span>
          <span className="ms-2 text-[12.5px] text-ink-2">{r.stationName}</span>
        </>
      ),
    },
    {
      key: "direction",
      header: t("field.direction"),
      sortValue: (r) => r.direction,
      cell: (r) => t(`direction.${r.direction}`),
    },
    {
      key: "avgHeadway",
      header: t("field.avgHeadway"),
      numeric: true,
      sortValue: (r) => r.avgHeadwayMinutes,
      cell: (r) => (r.avgHeadwayDisplay ? <span className="tnum">{r.avgHeadwayDisplay}</span> : orDash(null)),
    },
    {
      key: "sampleCount",
      header: t("field.sampleCount"),
      numeric: true,
      sortValue: (r) => r.sampleCount,
      cell: (r) => <span className="tnum">{r.sampleCount}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows.map((r) => ({ ...r, id: `${r.stationId}:${r.direction}` }))}
      selectedId={null}
      pathname="/trips"
      empty={<Empty title={tCommon("empty")} hint={t("noHeadwayData")} />}
    />
  );
}
