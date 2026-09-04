import { savedFiltersTable } from "@/lib/saved-filters-db";
import { EMPTY_FILTER_STATE, OPERATORS, type FilterRow, type FilterState } from "@/lib/filters";

/**
 * Saved views: per user, per module. A view stores the chosen fields, their
 * operators and their values, so reopening one restores the whole composition
 * rather than a set of loose values.
 *
 * RLS scopes every row to its owner, so these queries never filter by user.
 */

export type SavedView = {
  id: string;
  name: string;
  isDefault: boolean;
  state: FilterState;
};

const OPERATOR_SET = new Set<string>(Object.values(OPERATORS).flat());

/** `filter_state` is written by us but read back as untrusted json. */
function toState(raw: unknown): FilterState {
  if (!raw || typeof raw !== "object") return EMPTY_FILTER_STATE;

  const record = raw as { rows?: unknown };
  const rows: FilterRow[] = [];

  if (Array.isArray(record.rows)) {
    for (const entry of record.rows) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as { field?: unknown; operator?: unknown; value?: unknown };
      if (typeof row.field !== "string" || typeof row.operator !== "string") continue;
      if (!OPERATOR_SET.has(row.operator)) continue;

      rows.push({
        field: row.field,
        operator: row.operator as FilterRow["operator"],
        value: typeof row.value === "string" ? row.value : "",
      });
    }
  }

  return { rows };
}

export async function loadSavedViews(module: string): Promise<SavedView[]> {
  const table = await savedFiltersTable();
  const { data, error } = await table
    .select("id, name, is_default, filter_state")
    .eq("module", module)
    .order("created_at");

  // Degrading to an empty list is the right call for a convenience feature —
  // no error banner on every list page over this — but silently swallowing
  // it entirely is what let saved_filters not existing at all go unnoticed.
  // This at least leaves a trace in server logs.
  if (error) {
    console.error(`loadSavedViews(${module}) failed:`, error);
  }

  return (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    isDefault: v.is_default,
    state: toState(v.filter_state),
  }));
}

export const defaultSavedView = (views: SavedView[]) =>
  views.find((v) => v.isDefault) ?? null;
