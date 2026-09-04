import type { FilterDef, FilterOption } from "@/lib/filters";
import type { OperationRow, ShiftOption } from "./queries";

/** One def per table column — every column on the board is filterable.
 * `statuses` arrives pre-translated (label resolved via statusLabel in
 * page.tsx) since this module has no translator to call itself. */
export function buildOperationFilters(
  labels: Record<string, string>,
  options: {
    shifts: ShiftOption[];
    statuses: FilterOption[];
    vehicles: FilterOption[];
    drivers: FilterOption[];
    routes: FilterOption[];
  },
): FilterDef<OperationRow>[] {
  return [
    { key: "code", label: labels.code, kind: "text", get: (r) => r.code },
    { key: "date", label: labels.date, kind: "dateRange", get: (r) => r.date },
    { key: "shift", label: labels.shift, kind: "select",
      options: options.shifts.map((s) => ({ value: s.id, label: s.labelEn })),
      get: (r) => r.shiftId },
    { key: "vehicle", label: labels.vehicle, kind: "text",
      get: (r) => [r.vehicleCode, r.plate] },
    { key: "driver", label: labels.driver, kind: "picker",
      options: options.drivers, get: (r) => [r.driverId, r.driverName] },
    { key: "route", label: labels.route, kind: "picker",
      options: options.routes, get: (r) => r.routeId },
    { key: "vendor", label: labels.vendor, kind: "text", get: (r) => r.vendorName },
    { key: "startKm", label: labels.startingKm, kind: "number", get: (r) => r.startKm },
    { key: "endKm", label: labels.endingKm, kind: "number", get: (r) => r.endKm },
    { key: "distance", label: labels.distance, kind: "number", get: (r) => r.distanceKm },
    { key: "operatingPct", label: labels.operatingPct, kind: "number",
      get: (r) => r.operatingPct },
    { key: "status", label: labels.status, kind: "select",
      options: options.statuses,
      get: (r) => r.statusCode },
  ];
}
