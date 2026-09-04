import type { FilterDef, FilterOption } from "@/lib/filters";
import type { LookupOption } from "@/lib/lookups";
import type { VehicleRow } from "./queries";

export function buildVehicleFilters(
  labels: Record<string, string>,
  options: {
    vendors: FilterOption[];
    drivers: FilterOption[];
    vehicleTypes: LookupOption[];
    fuelTypes: LookupOption[];
    statuses: LookupOption[];
  },
): FilterDef<VehicleRow>[] {
  const lookup = (list: LookupOption[]) =>
    list.map((l) => ({ value: l.id, label: l.labelEn }));

  return [
    { key: "code", label: labels.vehicleCode, kind: "text", get: (r) => r.vehicleCode },
    { key: "plate", label: labels.plateNumber, kind: "text", get: (r) => r.plateNumber },
    { key: "vendor", label: labels.vendor, kind: "picker",
      options: options.vendors, get: (r) => [r.vendorId, r.vendorName] },
    { key: "type", label: labels.type, kind: "select",
      options: lookup(options.vehicleTypes), get: (r) => r.vehicleTypeId },
    { key: "fuel", label: labels.fuelType, kind: "select",
      options: lookup(options.fuelTypes), get: (r) => r.fuelTypeId },
    { key: "driver", label: labels.defaultDriver, kind: "picker",
      options: options.drivers, get: (r) => [r.defaultDriverId, r.defaultDriverName] },
    { key: "odometer", label: labels.odometer, kind: "number",
      get: (r) => r.currentOdometerKm },
    { key: "battery", label: labels.batteryCapacity, kind: "number",
      get: (r) => r.batteryCapacityKwh },
    { key: "licence", label: labels.licenseExpiry, kind: "dateRange",
      get: (r) => r.licenseExpiryDate },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}
