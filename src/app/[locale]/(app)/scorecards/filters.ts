import type { FilterDef, FilterOption } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { ScorecardRow } from "./queries";

/**
 * Months and templates show different columns, so they get different filter
 * sets — mixing them would offer a period filter on a list that has no periods.
 */
export function buildScorecardFilters(
  labels: Record<string, string>,
  options: { kind: "months" | "templates"; vendors: FilterOption[]; rows: ScorecardRow[] },
): FilterDef<ScorecardRow>[] {
  const vendor: FilterDef<ScorecardRow> = {
    key: "vendor",
    label: labels.vendor,
    kind: "picker",
    options: options.vendors,
    get: (r) => [r.vendorId, r.vendorCode, r.vendorName],
  };

  if (options.kind === "templates") {
    return [
      vendor,
      { key: "sections", label: labels.sections, kind: "number",
        get: (r) => r.sectionCount },
      { key: "lines", label: labels.kpiLines, kind: "number", get: (r) => r.lineCount },
      { key: "weights", label: labels.sectionsWeight, kind: "number",
        get: (r) => r.sectionsWeightTotal },
    ];
  }

  return [
    vendor,
    { key: "month", label: labels.periodMonth, kind: "dateRange",
      get: (r) => r.periodMonth },
    { key: "total", label: labels.totalAchieved, kind: "number",
      get: (r) => r.totalAchievedPct },
    { key: "approvedBy", label: labels.approvedBy, kind: "picker",
      options: optionsFrom(options.rows, (r) => r.approvedBy), get: (r) => r.approvedBy },
    { key: "status", label: labels.status, kind: "select",
      options: [
        { value: "draft", label: labels.statusDraft },
        { value: "submitted", label: labels.statusSubmitted },
        { value: "approved", label: labels.statusApproved },
        { value: "reopened", label: labels.statusReopened },
      ],
      get: (r) => r.status },
  ];
}
