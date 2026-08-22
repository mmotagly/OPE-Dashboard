"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { money } from "@/lib/format";
import type { VendorRow } from "./queries";

export function VendorsTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: VendorRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("master");
  const tFinance = useTranslations("finance");
  const tCommon = useTranslations("common");

  const basisLabel = (r: VendorRow) =>
    r.billingBasis === "per_bus_day"
      ? t("basisPerBusDay")
      : r.billingBasis === "per_avg_bus_month"
        ? t("basisPerAvgBusMonth")
        : null;

  const columns: Column<VendorRow>[] = [
    {
      key: "code",
      header: t("field.vendorCode"),
      sortValue: (r) => r.vendorCode,
      cell: (r) => (
        <span className="tnum font-medium">
          {r.vendorCode}
          {r.isCompany && (
            <span className="ms-2">
              <Micro bar={false}>{t("companyVendor")}</Micro>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "name",
      header: t("field.vendorName"),
      sortValue: (r) => r.vendorName,
      cell: (r) => r.vendorName,
    },
    {
      key: "type",
      header: t("field.vendorType"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.vendorTypeLabel,
      cell: (r) => orDash(r.vendorTypeLabel),
    },
    {
      key: "basis",
      header: tFinance("basis"),
      className: "hidden sm:table-cell",
      sortValue: (r) => basisLabel(r),
      cell: (r) => orDash(basisLabel(r)),
    },
    {
      key: "rate",
      header: t("field.rateAmount"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.rateAmount,
      cell: (r) => (r.rateAmount === null ? orDash(null) : money(r.rateAmount, r.currency)),
    },
    {
      key: "kpi",
      header: t("field.applyKpi"),
      className: "hidden sm:table-cell",
      sortValue: (r) => (r.applyKpi ? 1 : 0),
      cell: (r) =>
        r.applyKpi ? (
          <Micro tone="go">{t("kpiApplies")}</Micro>
        ) : (
          <span className="text-ink-3">{t("kpiDoesNotApply")}</span>
        ),
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => r.statusLabel,
      cell: (r) =>
        r.statusLabel ? (
          <Pill tone={r.statusCode === "active" ? "go" : "idle"}>{r.statusLabel}</Pill>
        ) : (
          orDash(null)
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/vendors"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
