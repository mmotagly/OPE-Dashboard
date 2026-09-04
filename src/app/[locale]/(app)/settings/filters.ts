import type { FilterDef } from "@/lib/filters";
import type { LookupCategoryRow, LookupRow } from "./queries";

/** The lookup table is the only list view in settings; users has its own search. */
export function buildLookupFilters(
  labels: Record<string, string>,
  options: { categories: LookupCategoryRow[]; rows: LookupRow[] },
): FilterDef<LookupRow>[] {
  return [
    { key: "category", label: labels.category, kind: "select",
      options: options.categories.map((c) => ({ value: c.key, label: c.label })),
      get: (r) => r.category },
    { key: "code", label: labels.code, kind: "text", get: (r) => r.code },
    { key: "labelEn", label: labels.labelEn, kind: "text", get: (r) => r.labelEn },
    { key: "labelAr", label: labels.labelAr, kind: "text", get: (r) => r.labelAr },
    { key: "sortOrder", label: labels.sortOrder, kind: "number",
      get: (r) => r.sortOrder },
    { key: "active", label: labels.isActive, kind: "boolean", get: (r) => r.isActive },
  ];
}
