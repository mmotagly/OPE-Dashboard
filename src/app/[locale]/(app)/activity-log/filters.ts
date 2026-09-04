import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { AuditLogRow } from "./queries";

/** Entity type keeps its own chip row (page.tsx) rather than duplicating it
 * here as a field — one control per concept, not two. */
export function buildActivityLogFilters(
  labels: Record<string, string>,
  rows: AuditLogRow[],
): FilterDef<AuditLogRow>[] {
  return [
    {
      key: "actor",
      label: labels.actor,
      kind: "picker",
      options: optionsFrom(rows, (r) => r.actorName),
      get: (r) => r.actorName,
    },
    {
      key: "action",
      label: labels.action,
      kind: "select",
      options: optionsFrom(rows, (r) => r.action),
      get: (r) => r.action,
    },
    { key: "when", label: labels.when, kind: "dateRange", get: (r) => r.createdAt },
  ];
}
