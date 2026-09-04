import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { FleetLocationRow } from "./queries";

export function buildFleetLocationFilters(
  labels: Record<string, string>,
  rows: FleetLocationRow[],
): FilterDef<FleetLocationRow>[] {
  return [
    {
      key: "vehicle",
      label: labels.vehicle,
      kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber],
    },
    {
      key: "vendor",
      label: labels.vendor,
      kind: "picker",
      options: optionsFrom(rows, (r) => r.vendorName),
      get: (r) => r.vendorName,
    },
    { key: "speed", label: labels.speed, kind: "number", get: (r) => r.speedKmh },
    {
      key: "ignition",
      label: labels.ignition,
      kind: "boolean",
      get: (r) => r.ignitionOn,
    },
    { key: "lastSeen", label: labels.lastSeen, kind: "dateRange", get: (r) => r.recordedAt },
  ];
}
