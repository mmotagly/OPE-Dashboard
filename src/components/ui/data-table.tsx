"use client";
import type { QueryParams } from "@/lib/filters";

import { type ReactNode, useMemo, useOptimistic, useTransition } from "react";
import { useRouter } from "@/lib/i18n/routing";

/**
 * The one table. Every list page is a dense table filling the content width,
 * one row per record; clicking a row puts `?id=` in the URL, which is what
 * opens the drawer.
 *
 * Columns carry render functions, so this is a Client Component and each
 * module's own table component defines its columns. Only plain rows cross the
 * server boundary.
 */

export type Column<T> = {
  key: string;
  header: string;
  /** Tabular figures and alignment to the inline-end edge. */
  numeric?: boolean;
  /** Extra classes on the cell — usually a responsive hide. */
  className?: string;
  /** Providing this makes the header clickable. */
  sortValue?: (row: T) => string | number | null;
  cell: (row: T) => ReactNode;
};

/** A missing value is an em dash, never an empty cell. */
export function Dash() {
  return <span className="text-ink-3">—</span>;
}

export function orDash(value: ReactNode): ReactNode {
  if (value === null || value === undefined || value === "") return <Dash />;
  return value;
}

const compare = (a: string | number | null, b: string | number | null) => {
  if (a === null && b === null) return 0;
  // nulls sort last whichever way the column is pointing
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectedId,
  pathname,
  query = {},
  sort = "",
  dir = "asc",
  empty,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  selectedId: string | null;
  pathname: string;
  /** Filters to preserve when selecting a row or re-sorting. */
  query?: QueryParams;
  sort?: string;
  dir?: string;
  empty: ReactNode;
  /**
   * Distinct key per row, when `id` is not one. Periodic maintenance lists
   * several part rows per vehicle and `id` is the vehicle they all open.
   */
  rowKey?: (row: T) => string;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  // Both the selection and the sort settle on whatever the URL says, but move
  // straight away so a click does not wait for the round trip.
  const [active, setActive] = useOptimistic(selectedId);
  const [order, setOrder] = useOptimistic({
    key: sort,
    dir: dir === "desc" ? "desc" : "asc",
  });

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === order.key && c.sortValue);
    if (!column?.sortValue) return rows;

    const read = column.sortValue;
    const factor = order.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => compare(read(a), read(b)) * factor);
  }, [columns, rows, order]);

  const select = (id: string) =>
    start(() => {
      setActive(id);
      router.replace({ pathname, query: { ...query, id } });
    });

  const toggleSort = (key: string) => {
    const next =
      order.key === key && order.dir === "asc" ? ("desc" as const) : ("asc" as const);

    start(() => {
      setOrder({ key, dir: next });
      router.replace({ pathname, query: { ...query, sort: key, dir: next } });
    });
  };

  return (
    // The one scrollable region: bounded by whatever height the parent gives
    // it (Panel's `fill` mode hands it exactly the remaining space below
    // PanelHead/filters; a non-fill Panel leaves this at its natural content
    // height, where it's a harmless no-op). `th`'s sticky is relative to
    // *this* div specifically, not the page — the only way to make a sticky
    // header actually reliable, since the scrolling ancestor is now
    // unambiguous.
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* border-separate, not border-collapse: Chrome has a known rendering
          bug where a collapsed-border table with a sticky <th> lets a
          scrolled-past row's paint bleed through the header during scroll.
          Only bottom borders are used (no top borders anywhere), so
          border-spacing-0 renders identically to collapse — just without
          the bug. */}
      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = order.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    isSorted
                      ? order.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={`sticky top-0 z-10 border-b border-hairline bg-surface px-3 py-2.5 text-table-header font-medium uppercase tracking-[0.04em] text-ink-3 ${
                    column.numeric ? "text-end" : "text-start"
                  } ${column.className ?? ""}`}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
                        isSorted ? "text-ink" : ""
                      }`}
                    >
                      <span className="truncate">{column.header}</span>
                      <span aria-hidden className="text-[9px]">
                        {isSorted ? (order.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span className="truncate">{column.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4">
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const isActive = active === row.id;
              return (
                <tr
                  key={rowKey ? rowKey(row) : row.id}
                  onClick={() => select(row.id)}
                  aria-selected={isActive}
                  className={`cursor-pointer border-b border-hairline transition-colors last:border-b-0 ${
                    isActive ? "bg-elev" : "hover:bg-raise"
                  }`}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`${index === 0 ? "relative" : ""} px-3 py-2.5 text-body ${
                        column.numeric ? "tnum text-end" : "text-start"
                      } ${column.className ?? ""}`}
                    >
                      {index === 0 && isActive && (
                        <span
                          aria-hidden
                          className="absolute bottom-0 start-0 top-0 w-[2px] bg-ink"
                        />
                      )}
                      <div className="truncate">{column.cell(row)}</div>
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
