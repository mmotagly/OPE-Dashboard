"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import { percent } from "@/lib/format";
import type { VendorKpiSummaryRow } from "./queries";

const TONE = {
  improving: "go",
  declining: "stop",
  stable: "idle",
  new: "idle",
} as const;

export function SummaryTable({ rows }: { rows: VendorKpiSummaryRow[] }) {
  const t = useTranslations("vendorTrends");
  const tCommon = useTranslations("common");

  const columns: Column<VendorKpiSummaryRow & { id: string }>[] = [
    {
      key: "vendor",
      header: t("field.vendor"),
      cell: (r) => (
        <Link
          href={{ pathname: "/vendor-trends", query: { vendor: r.vendorId } }}
          className="font-medium hover:underline"
        >
          {r.vendorName}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.vendorCode}</span>
        </Link>
      ),
    },
    {
      key: "latestMonth",
      header: t("field.latestMonth"),
      cell: (r) => <span className="tnum">{r.latestMonth.slice(0, 7)}</span>,
    },
    {
      key: "latestPct",
      header: t("field.latestPct"),
      numeric: true,
      cell: (r) => (r.latestPct === null ? orDash(null) : percent(r.latestPct)),
    },
    {
      key: "deltaPct",
      header: t("field.delta"),
      numeric: true,
      sortValue: (r) => r.deltaPct,
      cell: (r) =>
        r.deltaPct === null ? orDash(null) : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%`,
    },
    {
      key: "direction",
      header: t("field.trend"),
      cell: (r) => <Pill tone={TONE[r.direction]}>{t(`direction.${r.direction}`)}</Pill>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows.map((r) => ({ ...r, id: r.vendorId }))}
      selectedId={null}
      pathname="/vendor-trends"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
