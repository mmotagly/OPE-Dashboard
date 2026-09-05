import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { LookupOption } from "@/lib/lookups";
import type { RouteRow, StationRow } from "./queries";
import type { TripEntryRouteOption, TripSummaryRow } from "./trip-queries";

const lookup = (list: LookupOption[]) =>
  list.map((l) => ({ value: l.id, label: l.labelEn }));

export function buildRouteFilters(
  labels: Record<string, string>,
  options: { statuses: LookupOption[]; rows: RouteRow[] },
): FilterDef<RouteRow>[] {
  return [
    { key: "code", label: labels.routeCode, kind: "text", get: (r) => r.routeCode },
    { key: "name", label: labels.routeName, kind: "text", get: (r) => r.routeName },
    { key: "distance", label: labels.routeDistance, kind: "number",
      get: (r) => r.routeDistanceKm },
    { key: "stops", label: labels.stopsInSequence, kind: "number",
      get: (r) => r.linkedStations },
    { key: "declared", label: labels.numberOfStations, kind: "number",
      get: (r) => r.numberOfStations },
    { key: "legTime", label: labels.legTime, kind: "picker",
      options: optionsFrom(options.rows, (r) => r.standardLegTime),
      get: (r) => r.standardLegTime },
    { key: "roundTrip", label: labels.roundTripTime, kind: "picker",
      options: optionsFrom(options.rows, (r) => r.standardRoundTripTime),
      get: (r) => r.standardRoundTripTime },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}

export function buildTripFilters(
  labels: Record<string, string>,
  options: { routes: TripEntryRouteOption[] },
): FilterDef<TripSummaryRow>[] {
  return [
    { key: "vehicle", label: labels.vehicle, kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber] },
    { key: "route", label: labels.route, kind: "select",
      options: options.routes.map((r) => ({ value: r.id, label: `${r.routeCode} · ${r.routeName}` })),
      get: (r) => r.routeId },
    { key: "date", label: labels.date, kind: "dateRange", get: (r) => r.tripDate },
    { key: "hasReturn", label: labels.hasReturn, kind: "boolean", get: (r) => r.hasReturn },
  ];
}

export function buildStationFilters(
  labels: Record<string, string>,
  options: { statuses: LookupOption[]; rows: StationRow[] },
): FilterDef<StationRow>[] {
  return [
    { key: "code", label: labels.stationCode, kind: "text", get: (r) => r.stationCode },
    { key: "name", label: labels.stationName, kind: "text", get: (r) => r.stationName },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}
