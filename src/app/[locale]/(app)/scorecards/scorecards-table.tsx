"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { percent } from "@/lib/format";
import type { ScorecardRow, ScorecardStatus } from "./queries";

const STATUS_TONE: Record<ScorecardStatus, "go" | "warn" | "stop" | "idle"> = {
  approved: "go",
  submitted: "warn",
  reopened: "warn",
  draft: "idle",
};

export function ScorecardsTable({
  rows,
  kind,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: ScorecardRow[];
  kind: "months" | "templates";
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("scorecard");
  const tCommon = useTranslations("common");

  const vendorColumn: Column<ScorecardRow> = {
    key: "vendor",
    header: t("field.vendor"),
    sortValue: (r) => r.vendorCode,
    // The code link is the one cell that opens the standalone full-page
    // view instead of the row's usual drawer — stopPropagation keeps the
    // row's own click handler (which also opens the drawer) from firing
    // at the same time. Not a unique-looking code (repeats per vendor
    // across months/templates), but the link targets the row's own id, so
    // each still opens the correct record.
    cell: (r) => (
      <span className="font-medium">
        <Link
          href={`/scorecards/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="tnum text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.vendorCode}
        </Link>
        <span className="ms-2 text-[12px] font-normal text-ink-3">{r.vendorName}</span>
      </span>
    ),
  };

  const columns: Column<ScorecardRow>[] =
    kind === "templates"
      ? [
          vendorColumn,
          {
            key: "sections",
            header: t("field.sections"),
            numeric: true,
            className: "hidden sm:table-cell",
            sortValue: (r) => r.sectionCount,
            cell: (r) => r.sectionCount,
          },
          {
            key: "lines",
            header: t("field.kpiLines"),
            numeric: true,
            className: "hidden sm:table-cell",
            sortValue: (r) => r.lineCount,
            cell: (r) => r.lineCount,
          },
          {
            key: "weight",
            header: t("field.sectionsWeight"),
            numeric: true,
            sortValue: (r) => r.sectionsWeightTotal,
            cell: (r) =>
              r.sectionsWeightTotal === null ? (
                orDash(null)
              ) : (
                <Micro
                  bar={false}
                  tone={Math.abs(r.sectionsWeightTotal - 100) > 0.001 ? "warn" : "neutral"}
                >
                  {percent(r.sectionsWeightTotal, 0)}
                </Micro>
              ),
          },
        ]
      : [
          vendorColumn,
          {
            key: "month",
            header: t("field.periodMonth"),
            sortValue: (r) => r.periodMonth,
            cell: (r) =>
              r.periodMonth ? (
                <span className="tnum">{r.periodMonth.slice(0, 7)}</span>
              ) : (
                orDash(null)
              ),
          },
          {
            key: "total",
            header: t("field.totalAchieved"),
            numeric: true,
            className: "hidden sm:table-cell",
            sortValue: (r) => r.totalAchievedPct,
            cell: (r) =>
              // Straight from v_scorecard_totals.
              r.totalAchievedPct === null ? orDash(null) : percent(r.totalAchievedPct),
          },
          {
            key: "approvedBy",
            header: t("field.approvedBy"),
            className: "hidden lg:table-cell",
            sortValue: (r) => r.approvedBy,
            cell: (r) => orDash(r.approvedBy),
          },
          {
            key: "status",
            header: t("field.status"),
            sortValue: (r) => r.status,
            cell: (r) => (
              <Pill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Pill>
            ),
          },
        ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/scorecards"
      query={query}
      sort={sort}
      dir={dir}
      empty={
        <Empty
          title={tCommon("empty")}
          hint={kind === "templates" ? t("noTemplatesHint") : t("noMonthsHint")}
        />
      }
    />
  );
}
