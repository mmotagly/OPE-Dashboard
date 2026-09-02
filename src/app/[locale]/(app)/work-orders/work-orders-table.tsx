"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import type { WorkOrderRow, WorkOrderStatus } from "./queries";

const STATUS_TONE: Record<WorkOrderStatus, "go" | "warn" | "stop" | "idle"> = {
  completed: "go",
  inProgress: "warn",
  skipped: "stop",
  notStarted: "idle",
};

/** Not started → in progress → completed, with skipped off to the side. */
const STATUS_ORDER: Record<WorkOrderStatus, number> = {
  notStarted: 0,
  inProgress: 1,
  completed: 2,
  skipped: 3,
};

const stamp = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace("T", " ") : null;

export function WorkOrdersTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: WorkOrderRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("workOrder");
  const tCommon = useTranslations("common");

  const columns: Column<WorkOrderRow>[] = [
    {
      key: "number",
      header: t("field.number"),
      sortValue: (r) => r.workOrderNumber,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/work-orders/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.workOrderNumber}
        </Link>
      ),
    },
    {
      key: "rfr",
      header: t("field.rfr"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.rfrNumber,
      cell: (r) => <span className="tnum">{r.rfrNumber}</span>,
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
      key: "issue",
      header: t("field.issueType"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.issueTypeLabel,
      cell: (r) => orDash(r.issueTypeLabel),
    },
    {
      key: "engineer",
      header: t("field.engineer"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.engineerName,
      cell: (r) => orDash(r.engineerName),
    },
    {
      key: "centre",
      header: t("field.centre"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.centreName,
      cell: (r) => orDash(r.centreName),
    },
    {
      key: "window",
      header: t("field.repairWindow"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.repairStartAt,
      cell: (r) => {
        const start = stamp(r.repairStartAt);
        const end = stamp(r.repairEndAt);
        if (!start && !end) return orDash(null);
        return (
          <span className="tnum text-[12.5px]">
            {start ?? "—"}
            <span className="mx-1.5 text-ink-3">→</span>
            <span className={end ? "" : "text-ink-3"}>{end ?? "—"}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => STATUS_ORDER[r.status],
      cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Pill>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/work-orders"
      query={query}
      sort={sort}
      dir={dir}
      empty={
        <Empty
          title={tCommon("empty")}
          hint={t("emptyHint")}
          action={
            <Link
              href="/rfrs"
              className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise"
            >
              {t("goToRequests")}
            </Link>
          }
        />
      }
    />
  );
}
