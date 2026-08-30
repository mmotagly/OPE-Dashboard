"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { percent } from "@/lib/format";
import type { VendorKpiSectionTrendRow } from "./queries";

export function SectionTable({ rows }: { rows: VendorKpiSectionTrendRow[] }) {
  const t = useTranslations("vendorTrends");
  const tCommon = useTranslations("common");

  const columns: Column<VendorKpiSectionTrendRow>[] = [
    {
      key: "periodMonth",
      header: t("field.month"),
      sortValue: (r) => r.periodMonth,
      cell: (r) => <span className="tnum">{r.periodMonth.slice(0, 7)}</span>,
    },
    {
      key: "sectionName",
      header: t("field.section"),
      sortValue: (r) => r.sectionName,
      cell: (r) => r.sectionName,
    },
    {
      key: "sectionScorePct",
      header: t("field.sectionScore"),
      numeric: true,
      cell: (r) => (r.sectionScorePct === null ? orDash(null) : percent(r.sectionScorePct)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={[...rows].sort(
        (a, b) => b.periodMonth.localeCompare(a.periodMonth) || a.sectionName.localeCompare(b.sectionName),
      )}
      selectedId={null}
      pathname="/vendor-trends"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
