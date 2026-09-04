/**
 * The filter model: a user-composed list of rows, not a fixed set of controls.
 *
 * A module declares one `FilterDef` per filterable column. Nothing is shown
 * until the user picks a field from the Fields menu, which appends a row
 * carrying its own operator and value. Row order is the order they were added
 * and is preserved through the URL.
 *
 * `FilterDef` holds an accessor so it stays on the server; `toControls` strips
 * the accessors to the serializable half the bar renders.
 */

export type FilterKind = "text" | "select" | "picker" | "number" | "boolean" | "dateRange";

export type FilterOperator =
  | "in"
  | "notIn"
  | "between"
  | "gt"
  | "lt"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Which operators each field type offers, in the order they are listed.
 * `text`/`select`/`picker`/`boolean` are in/notIn-only by design — a
 * deliberate simplification, not a gap. `number` and `dateRange` keep their
 * range operators: "in/notIn" over a continuous quantity (KM, %, a date)
 * means enumerating exact values, which isn't how anyone filters those.
 */
export const OPERATORS: Record<FilterKind, FilterOperator[]> = {
  text: ["in", "notIn"],
  select: ["in", "notIn"],
  picker: ["in", "notIn"],
  number: ["between", "gt", "lt", "isEmpty", "isNotEmpty"],
  boolean: ["in", "notIn"],
  dateRange: ["between", "isEmpty", "isNotEmpty"],
};

export const defaultOperator = (kind: FilterKind): FilterOperator => OPERATORS[kind][0];

/** Operators that carry no value — the control area stays empty. */
export const isValueless = (operator: FilterOperator) =>
  operator === "isEmpty" || operator === "isNotEmpty";

export type FilterOption = { value: string; label: string };

/** Query params as the routing layer accepts them — `f` repeats. */
export type QueryParams = Record<string, string | string[]>;

/** The half that crosses to the client. No functions. */
export type FilterControl = {
  key: string;
  label: string;
  kind: FilterKind;
  /** `select` and `picker`. A picker renders the same options behind a search box. */
  options?: FilterOption[];
};

export type FilterValue = string | number | boolean | null;

export type FilterDef<T> = FilterControl & {
  /** This row's value for the column. An array matches if any element matches. */
  get: (row: T) => FilterValue | FilterValue[];
  /** Include this column in the free-text search. */
  inSearch?: boolean;
};

/** One composed row. `value` encoding depends on the operator. */
export type FilterRow = {
  field: string;
  operator: FilterOperator;
  value: string;
};

export type FilterState = {
  /** Free-text search, permanent and separate from the composed rows. */
  q: string;
  rows: FilterRow[];
};

export const EMPTY_FILTER_STATE: FilterState = { q: "", rows: [] };

/* ---------------- encoding ---------------- */

export const encodeList = (values: string[]) => values.filter(Boolean).join(",");
export const decodeList = (raw: string) =>
  raw.split(",").map((v) => v.trim()).filter(Boolean);

export const encodeRange = (from: string, to: string) =>
  from === "" && to === "" ? "" : `${from}..${to}`;

export function decodeRange(raw: string): { from: string; to: string } {
  const [from = "", to = ""] = raw.split("..");
  return { from: from.trim(), to: to.trim() };
}

const OPERATOR_SET = new Set<string>(Object.values(OPERATORS).flat());

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Rows travel as repeated `f=field:operator:value` params. The value is
 * percent-encoded, and `:` is one of the characters that encoding escapes, so
 * splitting on it is unambiguous. Repeated params keep their order, which is
 * what preserves the order rows were added in.
 */
export function readFilterState(params: RawSearchParams): FilterState {
  const raw = params.f;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const rows: FilterRow[] = [];

  for (const entry of entries) {
    const [field = "", operator = "", ...rest] = entry.split(":");
    if (!field || !OPERATOR_SET.has(operator)) continue;

    let value = "";
    try {
      value = decodeURIComponent(rest.join(":"));
    } catch {
      // a hand-mangled URL must not take the page down
      value = "";
    }

    rows.push({ field, operator: operator as FilterOperator, value });
  }

  return { q: firstValue(params.q), rows };
}

/** Back to query params. `f` repeats, so this returns a list for it. */
export function writeFilterState(state: FilterState): {
  q?: string;
  f?: string[];
} {
  const query: { q?: string; f?: string[] } = {};

  if (state.q.trim()) query.q = state.q.trim();

  if (state.rows.length > 0) {
    query.f = state.rows.map(
      (row) => `${row.field}:${row.operator}:${encodeURIComponent(row.value)}`,
    );
  }

  return query;
}

/** True when nothing is composed — used to apply a saved default view. */
export const isFilterStateEmpty = (state: FilterState) =>
  state.q.trim() === "" && state.rows.length === 0;

export const sameFilterState = (a: FilterState, b: FilterState) =>
  a.q.trim() === b.q.trim() &&
  a.rows.length === b.rows.length &&
  a.rows.every(
    (row, i) =>
      row.field === b.rows[i].field &&
      row.operator === b.rows[i].operator &&
      row.value === b.rows[i].value,
  );

export const toControls = <T,>(defs: FilterDef<T>[]): FilterControl[] =>
  defs.map(({ key, label, kind, options }) => ({ key, label, kind, options }));

/* ---------------- matching ---------------- */

const asArray = (v: FilterValue | FilterValue[]): FilterValue[] =>
  Array.isArray(v) ? v : [v];

const asText = (v: FilterValue) => (v === null ? "" : String(v)).toLowerCase();

const isBlank = (v: FilterValue) => v === null || v === "" || v === undefined;

function matchesRow<T>(def: FilterDef<T>, row: T, filter: FilterRow): boolean {
  const values = asArray(def.get(row));

  if (filter.operator === "isEmpty") return values.every(isBlank);
  if (filter.operator === "isNotEmpty") return values.some((v) => !isBlank(v));

  // an operator with nothing typed in it yet narrows nothing
  if (filter.value === "") return true;

  switch (filter.operator) {
    case "in": {
      const wanted = new Set(decodeList(filter.value));
      if (wanted.size === 0) return true;
      return values.some((v) => v !== null && wanted.has(String(v)));
    }

    case "notIn": {
      const wanted = new Set(decodeList(filter.value));
      if (wanted.size === 0) return true;
      return !values.some((v) => v !== null && wanted.has(String(v)));
    }

    case "gt":
    case "lt": {
      const bound = Number(filter.value);
      if (!Number.isFinite(bound)) return true;
      return values.some((v) => {
        if (isBlank(v)) return false;
        const n = Number(v);
        if (!Number.isFinite(n)) return false;
        return filter.operator === "gt" ? n > bound : n < bound;
      });
    }

    case "between": {
      const { from, to } = decodeRange(filter.value);
      if (from === "" && to === "") return true;

      if (def.kind === "dateRange") {
        return values.some((v) => {
          if (isBlank(v)) return false;
          // ISO dates compare correctly as strings
          const day = String(v).slice(0, 10);
          if (from !== "" && day < from) return false;
          if (to !== "" && day > to) return false;
          return true;
        });
      }

      const min = from === "" ? null : Number(from);
      const max = to === "" ? null : Number(to);

      return values.some((v) => {
        if (isBlank(v)) return false;
        const n = Number(v);
        if (!Number.isFinite(n)) return false;
        if (min !== null && n < min) return false;
        if (max !== null && n > max) return false;
        return true;
      });
    }

    default:
      return true;
  }
}

/**
 * Narrows the fetched page. Filtering happens here rather than in PostgREST
 * because several columns come from embedded tables, which it cannot filter on.
 */
export function applyFilters<T>(
  rows: T[],
  defs: FilterDef<T>[],
  state: FilterState,
): T[] {
  const query = state.q.trim().toLowerCase();
  const searchable = defs.filter((d) => d.inSearch);

  return rows.filter((row) => {
    if (query && searchable.length > 0) {
      const haystack = searchable
        .flatMap((d) => asArray(d.get(row)))
        .map(asText)
        .join(" ");
      if (!haystack.includes(query)) return false;
    }

    for (const filter of state.rows) {
      const def = defs.find((d) => d.key === filter.field);
      // an unknown field in the URL must not silently hide everything
      if (!def) continue;
      if (!matchesRow(def, row, filter)) return false;
    }

    return true;
  });
}
