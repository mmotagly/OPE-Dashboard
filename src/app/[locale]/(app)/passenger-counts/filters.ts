import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { PassengerCountRow } from "./queries";

/** No picker table backs vehicle/camera here — options are the distinct
 * values already present in the loaded rows, same pattern as
 * invoices/vendors' currency filter. */
export function buildPassengerCountFilters(
  labels: Record<string, string>,
  rows: PassengerCountRow[],
): FilterDef<PassengerCountRow>[] {
  return [
    {
      key: "vehicle",
      label: labels.vehicle,
      kind: "text",
      get: (r) => [r.vehicleCode, r.plateNumber],
    },
    {
      key: "camera",
      label: labels.camera,
      kind: "picker",
      options: optionsFrom(rows, (r) => r.cameraCode),
      get: (r) => r.cameraCode,
    },
    { key: "window", label: labels.window, kind: "dateRange", get: (r) => r.windowStart },
    { key: "enter", label: labels.enter, kind: "number", get: (r) => r.enterCount },
    { key: "exit", label: labels.exit, kind: "number", get: (r) => r.exitCount },
    { key: "net", label: labels.net, kind: "number", get: (r) => r.enterCount - r.exitCount },
  ];
}
