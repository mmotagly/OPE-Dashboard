"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { duration } from "@/lib/format";
import type { RfrResolutionMonth } from "./queries";

export function RfrResolutionTable({ rows }: { rows: RfrResolutionMonth[] }) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const columns: Column<RfrResolutionMonth & { id: string }>[] = [
    {
      key: "periodMonth",
      header: t("field.month"),
      cell: (r) => <span className="tnum">{r.periodMonth.slice(0, 7)}</span>,
    },
    {
      key: "completedCount",
      header: t("field.completedCount"),
      numeric: true,
      cell: (r) => r.completedCount,
    },
    {
      key: "avgAccessMinutes",
      header: t("field.avgResolution"),
      numeric: true,
      cell: (r) => (r.avgAccessMinutes === null ? orDash(null) : duration(r.avgAccessMinutes)),
    },
    {
      key: "medianAccessMinutes",
      header: t("field.medianResolution"),
      numeric: true,
      cell: (r) =>
        r.medianAccessMinutes === null ? orDash(null) : duration(r.medianAccessMinutes),
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
