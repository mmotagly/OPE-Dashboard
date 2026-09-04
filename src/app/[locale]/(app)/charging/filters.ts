import type { FilterDef, FilterOption } from "@/lib/filters";
import { PLUG_OPTIONS } from "./plugs";
import type { ChargingRow } from "./queries";

export function buildChargingFilters(
  labels: Record<string, string>,
  options: { vehicles: FilterOption[]; chargers: FilterOption[]; rows: ChargingRow[] },
): FilterDef<ChargingRow>[] {
  return [
    { key: "code", label: labels.sessionCode, kind: "text", get: (r) => r.sessionCode },
    { key: "vehicle", label: labels.vehicle, kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber] },
    { key: "charger", label: labels.charger, kind: "picker",
      options: options.chargers, get: (r) => [r.chargerId, r.chargerCode] },
    { key: "plugs", label: labels.plugs, kind: "select",
      options: PLUG_OPTIONS.map((p) => ({ value: p, label: p })),
      get: (r) => r.plugsUsed },
    { key: "batteryStart", label: labels.batteryStart, kind: "number",
      get: (r) => r.batteryStartPct },
    { key: "batteryEnd", label: labels.batteryEnd, kind: "number",
      get: (r) => r.batteryEndPct },
    { key: "start", label: labels.startTime, kind: "dateRange", get: (r) => r.startTime },
    { key: "end", label: labels.endTime, kind: "dateRange", get: (r) => r.endTime },
    { key: "energy", label: labels.energy, kind: "number", get: (r) => r.energyKwh },
    { key: "finished", label: labels.finished, kind: "boolean",
      get: (r) => r.endTime !== null },
  ];
}
