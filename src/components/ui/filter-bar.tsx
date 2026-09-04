"use client";

import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  decodeList,
  decodeRange,
  defaultOperator,
  encodeList,
  encodeRange,
  isValueless,
  OPERATORS,
  writeFilterState,
  type FilterControl,
  type FilterRow,
  type FilterState,
  type QueryParams,
} from "@/lib/filters";
import { DateRangePicker, matchPreset } from "./date-range-picker";
import { useHydrated } from "./use-hydrated";

/**
 * The bar starts empty. Fields are added from the menu at its inline-end edge,
 * and each becomes one compact button showing the field and its value —
 * "Vehicle: BUS-001, BUS-014". Clicking a button opens a popover holding only
 * the value control.
 *
 * Operators are not shown. Each kind has one default that covers the normal
 * case, and the popover carries a quiet "more" control that reveals the rest
 * for the rare "not in" or "is empty". A non-default operator shows up in the
 * button label instead — "Vehicle: not BUS-001".
 *
 * Only the open popover and the in-flight search text are held locally; the
 * composition lives in the URL, so a filtered view is a link.
 */

const control =
  "rounded-[8px] border border-hairline bg-canvas px-2.5 py-1.5 text-[13px] text-ink";

const panel =
  "absolute top-full z-30 mt-1.5 rounded-[12px] border border-hairline bg-surface p-3 shadow-[0_18px_44px_rgb(0_0_0/0.55)]";

/** A boolean field has no lookup table to draw options from — this is the
 * one place its two possible values are named, shared by the value control
 * and the button's own summary so they can't drift apart. */
const booleanOptions = (t: (key: string) => string) => [
  { value: "true", label: t("yes") },
  { value: "false", label: t("no") },
];

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={onClose}
      className="fixed bottom-0 start-0 end-0 top-0 z-20 cursor-default"
    />
  );
}

/** The Fields menu: every filterable column, searchable, ticked to compose. */
function FieldsMenu({
  controls,
  active,
  onToggle,
}: {
  controls: FilterControl[];
  active: Set<string>;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("filters");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = query.trim()
    ? controls.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    : controls;

  return (
    <div className="relative ms-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-[10px] border border-hairline px-3 py-2 text-[12.5px] font-medium whitespace-nowrap text-ink-2 transition-colors hover:bg-raise hover:text-ink"
      >
        {t("fields")}
        {active.size > 0 && <span className="tnum text-ink-3">{active.size}</span>}
        <span aria-hidden className="text-[9px] text-ink-3">
          ▾
        </span>
      </button>

      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className={`${panel} end-0 w-[min(320px,92vw)]`}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchFields")}
              aria-label={t("searchFields")}
              className={`${control} mb-2 w-full`}
            />

            <div className="grid max-h-72 gap-0.5 overflow-y-auto">
              {matches.length === 0 && (
                <p className="px-1 py-2 text-[12.5px] text-ink-3">{t("noFields")}</p>
              )}

              {matches.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] transition-colors hover:bg-raise"
                >
                  <input
                    type="checkbox"
                    checked={active.has(c.key)}
                    onChange={() => onToggle(c.key)}
                    className="h-4 w-4 accent-[var(--color-ink)]"
                  />
                  <span className="min-w-0 truncate">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The value control for one filter. Lives inside the popover, full width. */
function ValueControl({
  field,
  row,
  onChange,
  onCommit,
}: {
  field: FilterControl;
  row: FilterRow;
  onChange: (next: string) => void;
  /** Called when the interaction is finished, so the popover can close. */
  onCommit: () => void;
}) {
  const t = useTranslations("filters");
  const [query, setQuery] = useState("");

  if (isValueless(row.operator)) {
    return <p className="text-[12.5px] text-ink-3">{t("noValueNeeded")}</p>;
  }

  if ((row.operator === "in" || row.operator === "notIn") && field.kind === "text") {
    return (
      <input
        type="text"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("typeValues")}
        aria-label={field.label}
        className={`${control} w-full`}
      />
    );
  }

  if (row.operator === "in" || row.operator === "notIn") {
    const selected = new Set(decodeList(row.value));
    const options = field.kind === "boolean" ? booleanOptions(t) : (field.options ?? []);
    const matches =
      field.kind === "picker" && query.trim()
        ? options.filter((o) =>
            o.label.toLowerCase().includes(query.trim().toLowerCase()),
          )
        : options;

    const toggle = (v: string) => {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange(encodeList([...next]));
    };

    return (
      <div className="grid gap-2">
        {field.kind === "picker" && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchOptions")}
            aria-label={t("searchOptions")}
            className={`${control} w-full`}
          />
        )}

        {/* Ticking builds a set, so this one stays open until dismissed. */}
        <div className="grid max-h-56 gap-0.5 overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-1 py-2 text-[12.5px] text-ink-3">{t("noOptions")}</p>
          )}

          {matches.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] transition-colors hover:bg-raise"
            >
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
                className="h-4 w-4 accent-[var(--color-ink)]"
              />
              <span className="min-w-0 truncate">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (row.operator === "between" && field.kind === "dateRange") {
    return (
      <DateRangePicker
        value={row.value}
        label={field.label}
        onChange={(next) => {
          onChange(next);
          // a complete range ends the interaction; a half-open one does not
          const { from, to } = decodeRange(next);
          if (from && to) onCommit();
        }}
      />
    );
  }

  if (row.operator === "between") {
    const { from, to } = decodeRange(row.value);
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={from}
          onChange={(e) => onChange(encodeRange(e.target.value, to))}
          placeholder={t("min")}
          aria-label={`${field.label} ${t("min")}`}
          className={`${control} tnum w-full`}
        />
        <span className="text-[12px] text-ink-3">→</span>
        <input
          type="number"
          value={to}
          onChange={(e) => onChange(encodeRange(from, e.target.value))}
          placeholder={t("max")}
          aria-label={`${field.label} ${t("max")}`}
          className={`${control} tnum w-full`}
        />
      </div>
    );
  }

  if (row.operator === "gt" || row.operator === "lt") {
    return (
      <input
        type="number"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
        className={`${control} tnum w-full`}
      />
    );
  }

  return (
    <input
      type="text"
      value={row.value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={field.label}
      className={`${control} w-full`}
    />
  );
}

/** One composed filter, as a compact button that opens its value control. */
function FilterButton({
  field,
  row,
  onPatch,
  onRemove,
}: {
  field: FilterControl;
  row: FilterRow;
  onPatch: (patch: Partial<FilterRow>) => void;
  /** Omitted for a module's default-visible fields — always shown, so
   * there's nothing to remove, only to change the value of. */
  onRemove?: () => void;
}) {
  const t = useTranslations("filters");
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [showOperators, setShowOperators] = useState(false);

  const operators = OPERATORS[field.kind];
  const options = field.kind === "boolean" ? booleanOptions(t) : field.options;
  const optionLabel = (v: string) => options?.find((o) => o.value === v)?.label ?? v;

  /** What the button shows after the field name. */
  function summarise(): string {
    if (isValueless(row.operator)) return t(`operator.${row.operator}`);
    if (row.value === "") return "";

    switch (row.operator) {
      case "in":
        return decodeList(row.value).map(optionLabel).join(", ");
      case "notIn":
        return `${t("shortNot")} ${decodeList(row.value).map(optionLabel).join(", ")}`;
      case "gt":
        return `> ${row.value}`;
      case "lt":
        return `< ${row.value}`;
      case "between": {
        const { from, to } = decodeRange(row.value);
        if (field.kind === "dateRange") {
          // Preset names depend on today, so only after hydration.
          const preset = hydrated ? matchPreset(from, to) : null;
          if (preset) return t(`preset.${preset}`);
        }
        if (from && to) return `${from} → ${to}`;
        if (from) return `≥ ${from}`;
        if (to) return `≤ ${to}`;
        return "";
      }
      default:
        return row.value;
    }
  }

  const summary = summarise();
  const isDefaultOperator = row.operator === defaultOperator(field.kind);

  return (
    <div className="relative">
      <div
        className={`flex items-center rounded-full border transition-colors ${
          summary ? "border-white/10 bg-elev" : "border-hairline bg-canvas"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex max-w-[260px] items-center gap-1 py-1.5 pe-1.5 ps-3 text-[12.5px]"
        >
          <span className="whitespace-nowrap text-ink-3">{field.label}</span>
          {summary && (
            <>
              <span className="text-ink-3">:</span>
              <span className="min-w-0 truncate font-medium text-ink">{summary}</span>
            </>
          )}
          <span aria-hidden className="text-[9px] text-ink-3">
            ▾
          </span>
        </button>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${t("removeFilter")}: ${field.label}`}
            title={t("removeFilter")}
            className="pe-2.5 ps-0.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <>
          <Backdrop
            onClose={() => {
              setOpen(false);
              setShowOperators(false);
            }}
          />
          <div
            className={`${panel} start-0 ${
              field.kind === "dateRange" && row.operator === "between"
                ? "w-[min(560px,92vw)]"
                : "w-[min(300px,90vw)]"
            }`}
          >
            <ValueControl
              field={field}
              row={row}
              onChange={(value) => onPatch({ value })}
              onCommit={() => setOpen(false)}
            />

            {/* Quiet by design: most people never need another operator. */}
            {operators.length > 1 && (
              <div className="mt-2.5 border-t border-hairline pt-2.5">
                {showOperators ? (
                  <div className="grid gap-0.5">
                    {operators.map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => {
                          // the old value rarely means the same thing
                          onPatch({ operator: op, value: "" });
                          setShowOperators(false);
                        }}
                        aria-pressed={row.operator === op}
                        className={`rounded-[7px] px-2 py-1.5 text-start text-[12.5px] transition-colors hover:bg-raise ${
                          row.operator === op ? "text-ink" : "text-ink-2"
                        }`}
                      >
                        {t(`operator.${op}`)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOperators(true)}
                    className="text-[11.5px] text-ink-3 transition-colors hover:text-ink"
                  >
                    {isDefaultOperator
                      ? t("moreOperators")
                      : `${t(`operator.${row.operator}`)} · ${t("changeOperator")}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A default-visible text field, always open — no popover, since its value
 * control is already just a plain input with nowhere useful to collapse to.
 * Picker/select/number/dateRange/boolean defaults stay on `FilterButton`
 * instead (a locked, unremovable pill): their value controls are a checkbox
 * list, a date-range picker, or similar — genuinely too tall to sit
 * permanently open in the bar without pushing everything below it down.
 */
function InlineTextRow({
  field,
  row,
  onPatch,
}: {
  field: FilterControl;
  row: FilterRow;
  onPatch: (patch: Partial<FilterRow>) => void;
}) {
  const t = useTranslations("filters");
  const other = row.operator === "in" ? "notIn" : "in";

  // Local + debounced, same reason FilterBar's own search box is: writing
  // straight to the URL on every keystroke races the next keystroke against
  // the URL→props round trip, so rapid typing loses characters.
  const [value, setValue] = useState(row.value);
  const committed = useRef(row.value);

  // The row's own value changes from outside typing too — a saved view
  // being applied, or "Clear all" — and the input needs to pick that up.
  useEffect(() => {
    if (row.value !== committed.current) {
      committed.current = row.value;
      setValue(row.value);
    }
  }, [row.value]);

  useEffect(() => {
    if (value === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = value;
      onPatch({ value });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex w-[260px] min-w-[220px] items-center gap-2 rounded-[8px] border border-hairline bg-canvas px-2.5 py-1.5">
      <span className="whitespace-nowrap text-[12.5px] text-ink-3">{field.label}</span>
      <button
        type="button"
        onClick={() => onPatch({ operator: other })}
        title={t("changeOperator")}
        className="whitespace-nowrap rounded-[5px] bg-elev px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        {t(`operator.${row.operator}`)}
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("typeValues")}
        aria-label={field.label}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

/**
 * A default-visible categorical field — select/picker/boolean, a genuinely
 * bounded set of values, unlike the free-text identifier fields above. Same
 * box treatment and operator toggle as InlineTextRow, but the value area
 * opens a checklist popover instead of taking typed text, since there's a
 * real (if sometimes long) list of valid values to pick from.
 */
function InlineDropdownRow({
  field,
  row,
  onPatch,
}: {
  field: FilterControl;
  row: FilterRow;
  onPatch: (patch: Partial<FilterRow>) => void;
}) {
  const t = useTranslations("filters");
  const [open, setOpen] = useState(false);
  const other = row.operator === "in" ? "notIn" : "in";

  const options = field.kind === "boolean" ? booleanOptions(t) : (field.options ?? []);
  const summary = decodeList(row.value)
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .join(", ");

  return (
    <div className="relative flex w-[260px] min-w-[220px] items-center gap-2 rounded-[8px] border border-hairline bg-canvas px-2.5 py-1.5">
      <span className="whitespace-nowrap text-[12.5px] text-ink-3">{field.label}</span>
      <button
        type="button"
        onClick={() => onPatch({ operator: other })}
        title={t("changeOperator")}
        className="whitespace-nowrap rounded-[5px] bg-elev px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        {t(`operator.${row.operator}`)}
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1 text-start text-[13px]"
      >
        <span className="min-w-0 flex-1 truncate text-ink">
          {summary || <span className="text-ink-3">{t("choose")}</span>}
        </span>
        <span aria-hidden className="text-[9px] text-ink-3">
          ▾
        </span>
      </button>

      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className={`${panel} start-0 w-[min(300px,90vw)]`}>
            <ValueControl
              field={field}
              row={row}
              onChange={(value) => onPatch({ value })}
              onCommit={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function FilterBar({
  pathname,
  controls,
  state,
  /** Params that are not filters — the entity tab, the open record, the sort. */
  baseQuery = {},
  savedViews,
  defaultFieldKeys = [],
}: {
  pathname: string;
  controls: FilterControl[];
  state: FilterState;
  baseQuery?: QueryParams;
  /** Slot for the saved-view tabs, rendered above the bar. */
  savedViews?: ReactNode;
  /** A module's 1-2 most commonly-used fields — always visible, not tucked
   * behind "+", and excluded from the Fields menu (there's nothing to add,
   * they're already there). Everything else keeps today's pill-plus-popover
   * pattern unchanged. */
  defaultFieldKeys?: string[];
}) {
  const t = useTranslations("filters");
  const router = useRouter();
  const [pending, start] = useTransition();

  const push = (next: FilterState) =>
    start(() =>
      router.replace({
        pathname,
        query: { ...baseQuery, ...writeFilterState(next) },
      }),
    );

  const setRows = (rows: FilterRow[]) => push({ ...state, rows });

  /** Update a field's row, appending one if it doesn't exist in `state.rows`
   * yet — the case for a default field's first value, since default fields
   * render even when they have no row of their own. */
  const patchField = (key: string, patch: Partial<FilterRow>) => {
    const existing = state.rows.findIndex((r) => r.field === key);
    if (existing >= 0) {
      setRows(state.rows.map((r, i) => (i === existing ? { ...r, ...patch } : r)));
      return;
    }
    const field = controls.find((c) => c.key === key);
    if (!field) return;
    setRows([...state.rows, { field: key, operator: defaultOperator(field.kind), value: "", ...patch }]);
  };

  const toggleField = (key: string) => {
    const existing = state.rows.findIndex((r) => r.field === key);
    if (existing >= 0) {
      setRows(state.rows.filter((_, i) => i !== existing));
      return;
    }

    const field = controls.find((c) => c.key === key);
    if (!field) return;

    // Appended, so the order rows were added in is the order they appear.
    setRows([
      ...state.rows,
      { field: key, operator: defaultOperator(field.kind), value: "" },
    ]);
  };

  const activeFields = new Set(state.rows.map((r) => r.field));

  const defaultRows = defaultFieldKeys
    .map((key) => controls.find((c) => c.key === key))
    .filter((f): f is FilterControl => f !== undefined)
    .map((field) => ({
      field,
      row: state.rows.find((r) => r.field === field.key) ?? {
        field: field.key,
        operator: defaultOperator(field.kind),
        value: "",
      },
    }));

  const extraRows = state.rows
    .map((row, index) => ({ row, index, field: controls.find((c) => c.key === row.field) }))
    .filter(
      (r): r is { row: FilterRow; index: number; field: FilterControl } =>
        r.field !== undefined && !defaultFieldKeys.includes(r.row.field),
    );

  const addableControls = controls.filter((c) => !defaultFieldKeys.includes(c.key));

  return (
    <div
      className={`border-b border-hairline transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      {savedViews}

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
        {defaultRows.map(({ field, row }) =>
          field.kind === "text" ? (
            <InlineTextRow
              key={field.key}
              field={field}
              row={row}
              onPatch={(patch) => patchField(field.key, patch)}
            />
          ) : (
            <InlineDropdownRow
              key={field.key}
              field={field}
              row={row}
              onPatch={(patch) => patchField(field.key, patch)}
            />
          ),
        )}

        {extraRows.map(({ field, row, index }) => (
          <FilterButton
            key={`${row.field}-${index}`}
            field={field}
            row={row}
            onPatch={(patch) =>
              setRows(state.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
            }
            onRemove={() => setRows(state.rows.filter((_, i) => i !== index))}
          />
        ))}

        <FieldsMenu controls={addableControls} active={activeFields} onToggle={toggleField} />

        {/* Available whenever anything is composed — a default field's own
            value included — alongside each pill's individual "×" above,
            not instead of it. */}
        {state.rows.length > 0 && (
          <button
            type="button"
            onClick={() =>
              // `clear` stops a default view from immediately reapplying.
              start(() => router.replace({ pathname, query: { ...baseQuery, clear: "1" } }))
            }
            className="px-1.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
          >
            {t("clearAll")}
          </button>
        )}
      </div>
    </div>
  );
}
