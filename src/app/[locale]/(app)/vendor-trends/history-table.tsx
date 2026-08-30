"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { percent } from "@/lib/format";
import type { VendorKpiTrendRow } from "./queries";

export function HistoryTable({ rows }: { rows: VendorKpiTrendRow[] }) {
  const t = useTranslations("vendorTrends");
  const tCommon = useTranslations("common");

  const columns: Column<VendorKpiTrendRow>[] = [
    {
      key: "periodMonth",
      header: t("field.month"),
      sortValue: (r) => r.periodMonth,
      cell: (r) => <span className="tnum">{r.periodMonth.slice(0, 7)}</span>,
    },
    {
      key: "totalAchievedPct",
      header: t("field.totalPct"),
      numeric: true,
      cell: (r) => (r.totalAchievedPct === null ? orDash(null) : percent(r.totalAchievedPct)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={[...rows].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))}
      selectedId={null}
      pathname="/vendor-trends"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
