import type { FilterDef, FilterOption } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { LookupOption } from "@/lib/lookups";
import type { RfrRow } from "./queries";

export function buildRfrFilters(
  labels: Record<string, string>,
  options: {
    stages: LookupOption[];
    vehicles: FilterOption[];
    drivers: FilterOption[];
    rows: RfrRow[];
  },
): FilterDef<RfrRow>[] {
  return [
    { key: "number", label: labels.number, kind: "text", get: (r) => r.rfrNumber },
    { key: "requested", label: labels.requested, kind: "dateRange",
      get: (r) => r.requestAt },
    { key: "vehicle", label: labels.vehicle, kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber] },
    { key: "driver", label: labels.driver, kind: "picker",
      options: options.drivers, get: (r) => [r.driverId, r.driverName] },
    { key: "km", label: labels.kmRecord, kind: "number", get: (r) => r.odometerKm },
    { key: "location", label: labels.location, kind: "text", get: (r) => r.vehicleLocation },
    { key: "access", label: labels.accessTime, kind: "number",
      get: (r) => r.accessMinutes },
    { key: "running", label: labels.clockRunning, kind: "boolean",
      get: (r) => r.clockRunning },
    { key: "stage", label: labels.stage, kind: "select",
      options: options.stages.map((s) => ({ value: s.code, label: s.labelEn })),
      get: (r) => r.stageCode },
    { key: "raisedBy", label: labels.raisedBy, kind: "picker",
      options: optionsFrom(options.rows, (r) => r.raisedBy), get: (r) => r.raisedBy },
  ];
}
