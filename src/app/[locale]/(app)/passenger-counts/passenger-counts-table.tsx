"use client";

import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { dateTime, time } from "@/lib/format";
import type { PassengerCountRow } from "./queries";

export function PassengerCountsTable({ rows }: { rows: PassengerCountRow[] }) {
  const t = useTranslations("passengerCounts");
  const tCommon = useTranslations("common");

  const columns: Column<PassengerCountRow>[] = [
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
    { key: "camera", header: t("field.camera"), cell: (r) => r.cameraCode },
    {
      key: "window",
      header: t("field.window"),
      sortValue: (r) => r.windowStart,
      cell: (r) => (
        <span className="tnum">
          {dateTime(r.windowStart)} → {time(r.windowEnd)}
        </span>
      ),
    },
    {
      key: "enter",
      header: t("field.enter"),
      numeric: true,
      cell: (r) => <span className="tnum">{r.enterCount}</span>,
    },
    {
      key: "exit",
      header: t("field.exit"),
      numeric: true,
      cell: (r) => <span className="tnum">{r.exitCount}</span>,
    },
    {
      key: "net",
      header: t("field.net"),
      numeric: true,
      cell: (r) => <span className="tnum">{r.enterCount - r.exitCount}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={null}
      pathname="/passenger-counts"
      empty={<Empty title={t("noCounts")} hint={tCommon("emptyHint")} />}
    />
  );
}
