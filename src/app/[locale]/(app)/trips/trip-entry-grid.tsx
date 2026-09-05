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
 * Fast multi-trip entry: one shift can have 10+ trips, so this is a table of
 * compact rows — grouped by route, since each route has its own station
 * sequence and a shared header row can't show meaningful station names for
 * rows belonging to different routes. Not a Drawer, same deviation as
 * before: a 560px column can't show several trips' full station sequences
 * side by side, which is the entire point of reviewing them together.
 *
 * Route is a per-group property, not a per-row dropdown — moving one trip
 * to a different route means removing it from one group and adding it to
 * another, rather than switching a value in place. A deliberate trade for
 * density at the volume this screen is built for (10+ trips, usually on the
 * same one or two routes per shift).
 *
 * A trip's return leg is inferred from its return cells being non-blank,
 * not a separate checkbox — leaving every return cell empty is exactly
 * "no return leg," matching what the server already does with blank time
 * inputs.
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
  return { clientKey: newClientKey(), id: t.id, routeId: t.routeId, outbound, returnTimes };
}

function blankRow(routeId: string): GridTrip {
  return { clientKey: newClientKey(), id: null, routeId, outbound: {}, returnTimes: {} };
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
      for (const [routeStationId, hhmm] of Object.entries(r.returnTimes)) {
        const iso = toIso(date, hhmm);
        if (iso) stops.push({ routeStationId, direction: "return", departureAt: iso });
      }

      return { clientKey: r.clientKey, id: r.id, routeId: r.routeId, stops };
    }),
  };
}

type RouteGroup = {
  routeId: string;
  route: TripEntryRouteOption | undefined;
  items: { trip: GridTrip; index: number }[];
};

/** Groups preserve the order their route first appears in `rows` — stable
 * across edits, since it's derived fresh from `rows` every render rather
 * than tracked separately. */
function groupByRoute(rows: GridTrip[], routes: TripEntryRouteOption[]): RouteGroup[] {
  const order: string[] = [];
  const byRoute = new Map<string, { trip: GridTrip; index: number }[]>();

  rows.forEach((trip, index) => {
    if (!byRoute.has(trip.routeId)) {
      byRoute.set(trip.routeId, []);
      order.push(trip.routeId);
    }
    byRoute.get(trip.routeId)!.push({ trip, index });
  });

  return order.map((routeId) => ({
    routeId,
    route: routes.find((r) => r.id === routeId),
    items: byRoute.get(routeId)!,
  }));
}

function RouteTable({
  group,
  stops,
  resultFor,
  onUpdate,
  onRemove,
  onAddTrip,
}: {
  group: RouteGroup;
  stops: RouteStationRow[];
  resultFor: (clientKey: string) => TripSaveResult | undefined;
  onUpdate: (index: number, next: GridTrip) => void;
  onRemove: (index: number) => void;
  onAddTrip: () => void;
}) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");
  const returnStops = [...stops].reverse();

  const cell = "px-2 py-1.5 whitespace-nowrap";
  const headCell = `${cell} text-[10.5px] font-medium uppercase tracking-[0.03em] text-ink-3 text-start`;

  return (
    <div className="overflow-hidden rounded-[10px] border border-hairline bg-canvas">
      <div className="flex items-center justify-between border-b border-hairline bg-surface px-3 py-2">
        <span className="text-[13px]">
          <span className="tnum font-medium">{group.route?.routeCode ?? "—"}</span>
          <span className="ms-2 text-ink-2">{group.route?.routeName}</span>
        </span>
        <button
          type="button"
          onClick={onAddTrip}
          className="rounded-control border border-hairline bg-canvas px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-raise"
        >
          + {t("addTrip")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-hairline">
              <th className={headCell} />
              <th className={`${headCell} border-s border-hairline`} colSpan={stops.length}>
                {t("direction.outbound")}
              </th>
              <th className={`${headCell} border-s border-hairline`} colSpan={returnStops.length}>
                {t("direction.return")}
              </th>
              <th className={`${headCell} border-s border-hairline`} colSpan={2} />
            </tr>
            <tr className="border-b border-hairline">
              <th className={headCell}>#</th>
              {stops.map((s, i) => (
                <th key={s.id} className={`${headCell} ${i === 0 ? "border-s border-hairline" : ""}`}>
                  {s.stationCode}
                </th>
              ))}
              {returnStops.map((s, i) => (
                <th
                  key={`r-${s.id}`}
                  className={`${headCell} ${i === 0 ? "border-s border-hairline" : ""}`}
                >
                  {s.stationCode}
                </th>
              ))}
              <th className={`${headCell} border-s border-hairline`} />
              <th className={headCell} />
            </tr>
          </thead>
          <tbody>
            {group.items.map(({ trip, index }, rowIdx) => {
              const result = resultFor(trip.clientKey);
              return (
                <tr key={trip.clientKey} className="border-b border-hairline last:border-b-0">
                  <td className={`${cell} tnum text-ink-3`}>{rowIdx + 1}</td>
                  {stops.map((s, i) => (
                    <td key={s.id} className={`${cell} ${i === 0 ? "border-s border-hairline" : ""}`}>
                      <TextInput
                        type="time"
                        value={trip.outbound[s.id] ?? ""}
                        onChange={(e) =>
                          onUpdate(index, {
                            ...trip,
                            outbound: { ...trip.outbound, [s.id]: e.target.value },
                          })
                        }
                        className="w-[104px] py-1"
                      />
                    </td>
                  ))}
                  {returnStops.map((s, i) => (
                    <td
                      key={`r-${s.id}`}
                      className={`${cell} ${i === 0 ? "border-s border-hairline" : ""}`}
                    >
                      <TextInput
                        type="time"
                        value={trip.returnTimes[s.id] ?? ""}
                        onChange={(e) =>
                          onUpdate(index, {
                            ...trip,
                            returnTimes: { ...trip.returnTimes, [s.id]: e.target.value },
                          })
                        }
                        className="w-[104px] py-1"
                      />
                    </td>
                  ))}
                  <td className={`${cell} border-s border-hairline`}>
                    {result && (
                      <Micro bar={false} tone={result.ok ? "go" : "stop"}>
                        {result.ok ? tCommon("saved") : t(`error.${result.reason ?? "saveFailed"}`)}
                      </Micro>
                    )}
                  </td>
                  <td className={cell}>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      aria-label={tCommon("remove")}
                      title={tCommon("remove")}
                      className="grid h-7 w-7 place-items-center rounded-control border border-hairline text-[13px] text-ink-2 transition-colors hover:bg-raise"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddRouteControl({
  routes,
  onAdd,
}: {
  routes: TripEntryRouteOption[];
  onAdd: (routeId: string) => void;
}) {
  const t = useTranslations("trips");
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");

  // Same controlled-<select> desync guard as the rest of this form — see
  // the header comment for why this reasserts every render.
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = routeId;
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectInput
        ref={ref}
        value={routeId}
        onChange={(e) => setRouteId(e.target.value)}
        className="w-auto"
        aria-label={t("field.route")}
      >
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.routeCode} · {r.routeName}
          </option>
        ))}
      </SelectInput>
      <button
        type="button"
        onClick={() => routeId && onAdd(routeId)}
        disabled={!routeId}
        className="rounded-control border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-raise disabled:opacity-50"
      >
        + {t("addRoute")}
      </button>
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

  const addTripToRoute = (routeId: string) => setRows((prev) => [...prev, blankRow(routeId)]);

  const groups = groupByRoute(rows, routes);
  const payload = JSON.stringify(buildDraft(operationId, date, rows));

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="draft" value={payload} />

      <div className="grid gap-2.5">
        {groups.map((group) => (
          <RouteTable
            key={group.routeId}
            group={group}
            stops={routeStops[group.routeId] ?? []}
            resultFor={resultFor}
            onUpdate={updateRow}
            onRemove={removeRow}
            onAddTrip={() => addTripToRoute(group.routeId)}
          />
        ))}
      </div>

      <AddRouteControl routes={routes} onAdd={addTripToRoute} />

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
