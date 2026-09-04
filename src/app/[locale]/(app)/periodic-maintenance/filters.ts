import type { FilterDef } from "@/lib/filters";
import type { PmRow } from "./queries";

export function buildPmFilters(labels: Record<string, string>): FilterDef<PmRow>[] {
  return [
    { key: "vehicle", label: labels.vehicle, kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber] },
    { key: "part", label: labels.part, kind: "text", get: (r) => r.partName },
    { key: "interval", label: labels.interval, kind: "number", get: (r) => r.intervalKm },
    { key: "lastService", label: labels.lastService, kind: "number",
      get: (r) => r.lastServiceKm },
    { key: "scheduled", label: labels.scheduled, kind: "number",
      get: (r) => r.scheduledKm },
    { key: "actual", label: labels.actual, kind: "number", get: (r) => r.actualKm },
    { key: "remaining", label: labels.remaining, kind: "number",
      get: (r) => r.kmRemaining },
    { key: "status", label: labels.status, kind: "select",
      options: [
        { value: "overdue", label: labels.statusOverdue },
        { value: "due_now", label: labels.statusDueNow },
        { value: "due_soon", label: labels.statusDueSoon },
        { value: "ok", label: labels.statusOk },
        { value: "never_serviced", label: labels.statusNeverServiced },
        { value: "no_km_data", label: labels.statusNoKmData },
      ],
      get: (r) => r.status },
  ];
}
