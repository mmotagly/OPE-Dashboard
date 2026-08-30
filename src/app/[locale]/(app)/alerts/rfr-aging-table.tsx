"use client";

import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import type { RfrAgingRow } from "./queries";

export function RfrAgingTable({ rows }: { rows: RfrAgingRow[] }) {
  const t = useTranslations("alerts");
  const tCommon = useTranslations("common");

  const columns: Column<RfrAgingRow>[] = [
    {
      key: "rfrNumber",
      header: t("field.rfr"),
      cell: (r) => <span className="tnum font-medium">{r.rfrNumber}</span>,
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
      key: "description",
      header: t("field.description"),
      className: "hidden md:table-cell",
      cell: (r) => <span className="truncate text-ink-2">{r.description}</span>,
    },
    {
      key: "accessDisplay",
      header: t("field.accessTime"),
      numeric: true,
      sortValue: (r) => r.accessMinutes,
      cell: (r) => (
        <Micro tone="warn" bar>
          {r.accessDisplay}
        </Micro>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={null}
      pathname="/alerts"
      empty={<Empty title={t("noRfrAlerts")} hint={tCommon("emptyHint")} />}
    />
  );
}
