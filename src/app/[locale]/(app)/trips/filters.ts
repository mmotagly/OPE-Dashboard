import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { LookupOption } from "@/lib/lookups";
import type { RouteRow, StationRow } from "./queries";

const lookup = (list: LookupOption[]) =>
  list.map((l) => ({ value: l.id, label: l.labelEn }));

export function buildRouteFilters(
  labels: Record<string, string>,
  options: { statuses: LookupOption[]; rows: RouteRow[] },
): FilterDef<RouteRow>[] {
  return [
    { key: "code", label: labels.routeCode, kind: "text", inSearch: true, get: (r) => r.routeCode },
    { key: "name", label: labels.routeName, kind: "text", inSearch: true, get: (r) => r.routeName },
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

export function buildStationFilters(
  labels: Record<string, string>,
  options: { statuses: LookupOption[]; rows: StationRow[] },
): FilterDef<StationRow>[] {
  return [
    { key: "code", label: labels.stationCode, kind: "text", inSearch: true, get: (r) => r.stationCode },
    { key: "name", label: labels.stationName, kind: "text", inSearch: true, get: (r) => r.stationName },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}
