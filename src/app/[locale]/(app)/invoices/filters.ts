import type { FilterDef, FilterOption } from "@/lib/filters";
import { optionsFrom } from "@/lib/filter-page";
import type { InvoiceRow } from "./queries";

export function buildInvoiceFilters(
  labels: Record<string, string>,
  options: { vendors: FilterOption[]; rows: InvoiceRow[] },
): FilterDef<InvoiceRow>[] {
  return [
    { key: "vendor", label: labels.vendor, kind: "picker",
      options: options.vendors, get: (r) => [r.vendorId, r.vendorCode, r.vendorName] },
    { key: "month", label: labels.periodMonth, kind: "dateRange",
      get: (r) => r.periodMonth },
    { key: "basis", label: labels.basis, kind: "select",
      options: [
        { value: "per_bus_day", label: labels.basisPerBusDay },
        { value: "per_avg_bus_month", label: labels.basisPerAvgBusMonth },
      ],
      get: (r) => r.billingBasis },
    { key: "quantity", label: labels.busQuantity, kind: "number",
      get: (r) => r.busQuantity },
    { key: "gross", label: labels.gross, kind: "number", get: (r) => r.grossAmount },
    { key: "achieved", label: labels.achievedPct, kind: "number",
      get: (r) => r.achievedPct },
    { key: "net", label: labels.net, kind: "number", get: (r) => r.netAmount },
    { key: "currency", label: labels.currency, kind: "select",
      options: optionsFrom(options.rows, (r) => r.currency), get: (r) => r.currency },
    { key: "status", label: labels.status, kind: "select",
      options: [
        { value: "draft", label: labels.statusDraft },
        { value: "submitted", label: labels.statusSubmitted },
        { value: "approved", label: labels.statusApproved },
        { value: "paid", label: labels.statusPaid },
      ],
      get: (r) => r.status },
  ];
}
