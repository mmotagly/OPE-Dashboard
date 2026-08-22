"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import { money, percent } from "@/lib/format";
import type { InvoiceRow, InvoiceStatus } from "./queries";

const STATUS_TONE: Record<InvoiceStatus, "go" | "warn" | "stop" | "idle"> = {
  paid: "go",
  approved: "go",
  submitted: "warn",
  draft: "idle",
};

export function InvoicesTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: InvoiceRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("invoice");
  const tCommon = useTranslations("common");

  const basisLabel = (basis: string | null) =>
    basis === "per_bus_day"
      ? t("basisPerBusDay")
      : basis === "per_avg_bus_month"
        ? t("basisPerAvgBusMonth")
        : null;

  const columns: Column<InvoiceRow>[] = [
    {
      key: "vendor",
      header: t("field.vendor"),
      sortValue: (r) => r.vendorCode,
      cell: (r) => (
        <span className="font-medium">
          <span className="tnum">{r.vendorCode}</span>
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.vendorName}</span>
        </span>
      ),
    },
    {
      key: "month",
      header: t("field.periodMonth"),
      sortValue: (r) => r.periodMonth,
      cell: (r) => <span className="tnum">{r.periodMonth.slice(0, 7)}</span>,
    },
    {
      key: "basis",
      header: t("field.basis"),
      className: "hidden md:table-cell",
      sortValue: (r) => basisLabel(r.billingBasis),
      cell: (r) => orDash(basisLabel(r.billingBasis)),
    },
    {
      key: "quantity",
      header: t("field.busQuantity"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.busQuantity,
      cell: (r) => (r.busQuantity === null ? orDash(null) : r.busQuantity),
    },
    {
      key: "gross",
      header: t("field.gross"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.grossAmount,
      cell: (r) =>
        r.grossAmount === null ? orDash(null) : money(r.grossAmount, r.currency),
    },
    {
      key: "achieved",
      header: t("field.achievedPct"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.achievedPct,
      cell: (r) => (r.achievedPct === null ? orDash(null) : percent(r.achievedPct)),
    },
    {
      key: "net",
      header: t("field.net"),
      numeric: true,
      sortValue: (r) => r.netAmount,
      cell: (r) =>
        r.netAmount === null ? (
          orDash(null)
        ) : (
          <span className="font-medium">{money(r.netAmount, r.currency)}</span>
        ),
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => r.status,
      cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Pill>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/invoices"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={t("emptyHint")} />}
    />
  );
}
