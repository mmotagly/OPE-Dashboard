"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import type { AuditLogRow } from "./queries";

const ACTION_TONE: Record<string, "go" | "warn" | "stop" | "idle"> = {
  stage_change: "idle",
  status_change: "idle",
  invoice_generated: "go",
};

/** Renders the jsonb detail column generically — works for any future event
 * type without new branching, at the cost of raw (untranslated) keys/codes.
 * Acceptable for an internal admin-only audit view. */
function detailSummary(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${v === null || v === undefined ? "—" : String(v)}`)
    .join(" · ");
}

export function ActivityTable({
  rows,
  selectedId,
}: {
  rows: AuditLogRow[];
  selectedId: string | null;
}) {
  const t = useTranslations("activityLog");
  const tCommon = useTranslations("common");

  const columns: Column<AuditLogRow>[] = [
    {
      key: "createdAt",
      header: t("field.when"),
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="tnum">{r.createdAt.slice(0, 16).replace("T", " ")}</span>
      ),
    },
    {
      key: "actorName",
      header: t("field.actor"),
      sortValue: (r) => r.actorName ?? "",
      cell: (r) => orDash(r.actorName),
    },
    {
      key: "entityType",
      header: t("field.entity"),
      sortValue: (r) => r.entityType,
      cell: (r) => <span className="font-medium">{r.entityType}</span>,
    },
    {
      key: "action",
      header: t("field.action"),
      sortValue: (r) => r.action,
      cell: (r) => <Pill tone={ACTION_TONE[r.action] ?? "idle"}>{r.action}</Pill>,
    },
    {
      key: "detail",
      header: t("field.detail"),
      className: "hidden md:table-cell",
      cell: (r) => <span className="text-ink-2">{detailSummary(r.detail)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/activity-log"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
