"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { expiryState, expiryTone, type ExpiryState } from "@/lib/format";
import type { DriverRow } from "./queries";

export function DriversTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: DriverRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  /** Amber inside 30 days, red once past — the date itself otherwise. */
  const expiryCell = (
    date: string | null,
    state: ExpiryState,
    expired: string,
    expiring: string,
  ) => {
    if (!date) return orDash(null);
    if (state === "ok" || state === "unknown") {
      return <span className="tnum">{date}</span>;
    }
    return <Micro tone={expiryTone(state)}>{state === "expired" ? expired : expiring}</Micro>;
  };

  const columns: Column<DriverRow>[] = [
    {
      key: "code",
      header: t("field.driverCode"),
      sortValue: (r) => r.driverCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/drivers/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.driverCode}
        </Link>
      ),
    },
    {
      key: "name",
      header: t("field.driverName"),
      sortValue: (r) => r.driverName,
      cell: (r) => r.driverName,
    },
    {
      key: "vendor",
      header: t("field.vendor"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.vendorName ?? "",
      cell: (r) => r.vendorName ?? <span className="text-ink-3">{t("companyDriver")}</span>,
    },
    {
      key: "mobile",
      header: t("field.mobile"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.mobileNumber,
      cell: (r) =>
        r.mobileNumber ? (
          <span className="tnum" dir="ltr">
            {r.mobileNumber}
          </span>
        ) : (
          orDash(null)
        ),
    },
    {
      key: "grade",
      header: t("field.licenseGrade"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.licenseGradeLabel,
      cell: (r) => orDash(r.licenseGradeLabel),
    },
    {
      key: "licence",
      header: t("field.licenseExpiry"),
      sortValue: (r) => r.licenseExpiryDate,
      cell: (r) =>
        expiryCell(
          r.licenseExpiryDate,
          expiryState(r.licenseExpiryDate),
          t("licenceExpired"),
          t("licenceExpiring"),
        ),
    },
    {
      key: "tourism",
      header: t("field.tourismExpiry"),
      className: "hidden sm:table-cell",
      sortValue: (r) => (r.hasTourismId ? r.tourismIdExpiryDate : null),
      cell: (r) =>
        r.hasTourismId
          ? expiryCell(
              r.tourismIdExpiryDate,
              expiryState(r.tourismIdExpiryDate),
              t("tourismExpired"),
              t("tourismExpiring"),
            )
          : orDash(null),
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
      pathname="/drivers"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
