import type { FilterDef } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { LookupOption } from "@/lib/lookups";
import type { VendorRow } from "./queries";

export function buildVendorFilters(
  labels: Record<string, string>,
  options: {
    vendorTypes: LookupOption[];
    statuses: LookupOption[];
    rows: VendorRow[];
  },
): FilterDef<VendorRow>[] {
  const lookup = (list: LookupOption[]) =>
    list.map((l) => ({ value: l.id, label: l.labelEn }));

  return [
    { key: "code", label: labels.vendorCode, kind: "text", get: (r) => r.vendorCode },
    { key: "name", label: labels.vendorName, kind: "text", get: (r) => r.vendorName },
    { key: "type", label: labels.vendorType, kind: "select",
      options: lookup(options.vendorTypes), get: (r) => r.vendorTypeId },
    { key: "basis", label: labels.basis, kind: "select",
      options: [
        { value: "per_bus_day", label: labels.basisPerBusDay },
        { value: "per_avg_bus_month", label: labels.basisPerAvgBusMonth },
      ],
      get: (r) => r.billingBasis },
    { key: "rate", label: labels.rateAmount, kind: "number", get: (r) => r.rateAmount },
    { key: "kpi", label: labels.applyKpi, kind: "boolean", get: (r) => r.applyKpi },
    { key: "company", label: labels.isCompany, kind: "boolean", get: (r) => r.isCompany },
    { key: "currency", label: labels.currency, kind: "select",
      options: optionsFrom(options.rows, (r) => r.currency), get: (r) => r.currency },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}
