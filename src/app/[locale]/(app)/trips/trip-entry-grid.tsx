"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { QueryParams } from "@/lib/filters";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { saveTrips } from "./trip-actions";
import { EMPTY_SAVE_TRIPS_STATE, type TripSaveResult } from "./trip-schema";
import type {
  TripEntryExistingTrip,
  TripEntryRouteOption,
  RouteStationRow,
} from "./trip-queries";

/**
 * Fast multi-trip entry: one shift can have 10+ trips, so this is a grid of
 * compact rows rather than the usual one-record-per-Drawer form — a
 * deliberate deviation from CLAUDE.md's Drawer convention, same spirit as
 * Day Board's own noted exception, because a 560px column cannot show
 * several trips' full station sequences side by side, which is the entire
 * point of reviewing them together.
 *
 * Leg/round-trip time are never computed here — only in SQL (0023's
 * computed columns), read back on the Trips list/drawer after saving.
 * Duplicating that arithmetic in the browser just to preview it isn't worth
 * the drift risk against the one real implementation.
 */

type StopTimes = Record<string, string>; // routeStationId -> "HH:MM" or ""

type GridTrip = {
  clientKey: string;
  id: string | null;
  routeId: string;
  outbound: StopTimes;
  hasReturn: boolean;
  returnTimes: StopTimes;
};

function newClientKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Date.now()}${Math.random()}`;
}

function toLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromExisting(t: TripEntryExistingTrip): GridTrip {
  const outbound: StopTimes = {};
  const returnTimes: StopTimes = {};
  for (const s of t.stops) {
    const bucket = s.direction === "outbound" ? outbound : returnTimes;
    bucket[s.routeStationId] = toLocalTime(s.departureAt);
  }
  return {
    clientKey: newClientKey(),
    id: t.id,
    routeId: t.routeId,
    outbound,
    hasReturn: Object.keys(returnTimes).length > 0,
    returnTimes,
  };
}

function blankRow(routeId: string): GridTrip {
  return {
    clientKey: newClientKey(),
    id: null,
    routeId,
    outbound: {},
    hasReturn: false,
    returnTimes: {},
  };
}

/** `<input type="time">` gives local wall-clock HH:MM with no date or zone —
 * combined with the shift's fixed date and read back as the browser's own
 * timezone, same convention `charging-form.tsx` uses for datetime-local. */
function toIso(date: string, hhmm: string): string | null {
  if (!hhmm) return null;
  const d = new Date(`${date}T${hhmm}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildDraft(operationId: string, date: string, rows: GridTrip[]) {
  return {
    operationId,
    trips: rows.map((r) => {
      const stops: { routeStationId: string; direction: "outbound" | "return"; departureAt: string }[] =
        [];

      for (const [routeStationId, hhmm] of Object.entries(r.outbound)) {
        const iso = toIso(date, hhmm);
        if (iso) stops.push({ routeStationId, direction: "outbound", departureAt: iso });
      }
      if (r.hasReturn) {
        for (const [routeStationId, hhmm] of Object.entries(r.returnTimes)) {
          const iso = toIso(date, hhmm);
          if (iso) stops.push({ routeStationId, direction: "return", departureAt: iso });
        }
      }

      return { clientKey: r.clientKey, id: r.id, routeId: r.routeId, stops };
    }),
  };
}

function StopInputs({
  stops,
  values,
  onChange,
}: {
  stops: RouteStationRow[];
  values: StopTimes;
  onChange: (routeStationId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {stops.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-3">→</span>}
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap text-[10.5px] text-ink-3">{s.stationCode}</span>
            <TextInput
              type="time"
              value={values[s.id] ?? ""}
              onChange={(e) => onChange(s.id, e.target.value)}
              className="w-[104px] py-1.5"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TripCard({
  trip,
  routes,
  routeStops,
  result,
  onChange,
  onRemove,
}: {
  trip: GridTrip;
  routes: TripEntryRouteOption[];
  routeStops: Record<string, RouteStationRow[]>;
  result: TripSaveResult | undefined;
  onChange: (next: GridTrip) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");
  const stops = routeStops[trip.routeId] ?? [];
  const reversedStops = [...stops].reverse();

  // useActionState's pending transition can leave a native <select>'s own
  // displayed option out of sync with the value React thinks it set (a
  // known class of bug for controlled <select> across a transition) —
  // reasserted on every render, unconditionally, rather than trusting
  // React's "value prop unchanged, skip the DOM write" optimization.
  const routeSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (routeSelectRef.current) routeSelectRef.current.value = trip.routeId;
  });

  return (
    <div className="rounded-[10px] border border-hairline bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          ref={routeSelectRef}
          value={trip.routeId}
          onChange={(e) => onChange({ ...trip, routeId: e.target.value })}
          className="w-auto"
          aria-label={t("field.route")}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.routeCode} · {r.routeName}
            </option>
          ))}
        </SelectInput>

        {result && (
          <Micro bar={false} tone={result.ok ? "go" : "stop"}>
            {result.ok ? tCommon("saved") : t(`error.${result.reason ?? "saveFailed"}`)}
          </Micro>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={tCommon("remove")}
          title={tCommon("remove")}
          className="ms-auto grid h-8 w-8 place-items-center rounded-control border border-hairline text-[13px] text-ink-2 transition-colors hover:bg-raise"
        >
          ×
        </button>
      </div>

      <div className="mt-2.5">
        <Micro bar={false}>{t("direction.outbound")}</Micro>
        <div className="mt-1.5">
          <StopInputs
            stops={stops}
            values={trip.outbound}
            onChange={(id, value) => onChange({ ...trip, outbound: { ...trip.outbound, [id]: value } })}
          />
        </div>
      </div>

      <label className="mt-2.5 flex items-center gap-2 text-[12.5px] text-ink-2">
        <input
          type="checkbox"
          checked={trip.hasReturn}
          onChange={(e) => onChange({ ...trip, hasReturn: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-ink)]"
        />
        {t("returnLeg")}
      </label>

      {trip.hasReturn && (
        <div className="mt-2">
          <Micro bar={false}>{t("direction.return")}</Micro>
          <div className="mt-1.5">
            <StopInputs
              stops={reversedStops}
              values={trip.returnTimes}
              onChange={(id, value) =>
                onChange({ ...trip, returnTimes: { ...trip.returnTimes, [id]: value } })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function TripEntryGrid({
  operationId,
  date,
  routes,
  routeStops,
  initialTrips,
  backTo,
}: {
  operationId: string;
  date: string;
  routes: TripEntryRouteOption[];
  routeStops: Record<string, RouteStationRow[]>;
  initialTrips: TripEntryExistingTrip[];
  backTo: QueryParams;
}) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(saveTrips, EMPTY_SAVE_TRIPS_STATE);
  const [rows, setRows] = useState<GridTrip[]>(() =>
    initialTrips.length > 0
      ? initialTrips.map(fromExisting)
      : [blankRow(routes[0]?.id ?? "")],
  );

  // Merge back the real ids a successful save assigned to brand-new rows —
  // purely a local-state merge on clientKey, never a refetch, so unsaved
  // edits to other rows in the same batch are never disturbed. Done during
  // render (React's "adjusting state when a prop changes" pattern) rather
  // than in an effect, since an effect here would just schedule a second,
  // avoidable render of the same result.
  const [handledResults, setHandledResults] = useState(state.results);
  if (state.results !== handledResults) {
    setHandledResults(state.results);
    if (state.results) {
      const results = state.results;
      setRows((prev) =>
        prev.map((r) => {
          const result = results.find((res) => res.clientKey === r.clientKey);
          return result?.ok && result.tripId ? { ...r, id: result.tripId } : r;
        }),
      );
    }
  }

  const resultFor = (clientKey: string) => state.results?.find((r) => r.clientKey === clientKey);

  const updateRow = (index: number, next: GridTrip) =>
    setRows((prev) => prev.map((r, i) => (i === index ? next : r)));

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const addRow = () =>
    setRows((prev) => [...prev, blankRow(prev[prev.length - 1]?.routeId ?? routes[0]?.id ?? "")]);

  const payload = JSON.stringify(buildDraft(operationId, date, rows));

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="draft" value={payload} />

      <div className="grid gap-2.5">
        {rows.map((trip, index) => (
          <TripCard
            key={trip.clientKey}
            trip={trip}
            routes={routes}
            routeStops={routeStops}
            result={resultFor(trip.clientKey)}
            onChange={(next) => updateRow(index, next)}
            onRemove={() => removeRow(index)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="justify-self-start rounded-control border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-raise"
      >
        {t("addTrip")}
      </button>

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 border-t border-hairline pt-3.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tCommon("loading") : t("saveTrips")}
        </Button>
        <Link
          href={{ pathname: "/trips", query: backTo }}
          className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-center text-[13px] font-medium text-ink transition-colors hover:bg-raise"
        >
          {tCommon("done")}
        </Link>
      </div>
    </form>
  );
}
