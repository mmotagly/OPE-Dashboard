"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { percent } from "@/lib/format";
import type { FleetUtilizationMonth } from "./queries";

export function FleetUtilizationTable({ rows }: { rows: FleetUtilizationMonth[] }) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const columns: Column<FleetUtilizationMonth & { id: string }>[] = [
    {
      key: "periodMonth",
      header: t("field.month"),
      cell: (r) => <span className="tnum">{r.periodMonth.slice(0, 7)}</span>,
    },
    {
      key: "activeVehicleCount",
      header: t("field.activeVehicles"),
      numeric: true,
      cell: (r) => `${r.activeVehicleCount} / ${r.fleetSize}`,
    },
    {
      key: "utilizationPct",
      header: t("field.utilization"),
      numeric: true,
      sortValue: (r) => r.utilizationPct,
      cell: (r) => (r.utilizationPct === null ? orDash(null) : percent(r.utilizationPct)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows.map((r) => ({ ...r, id: r.periodMonth }))}
      selectedId={null}
      pathname="/dashboard"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
