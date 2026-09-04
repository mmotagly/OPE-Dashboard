import type { FilterDef, FilterOption } from "@/lib/filters";
import type { LookupOption } from "@/lib/lookups";
import type { DriverRow } from "./queries";

export function buildDriverFilters(
  labels: Record<string, string>,
  options: {
    vendors: FilterOption[];
    licenseGrades: LookupOption[];
    statuses: LookupOption[];
  },
): FilterDef<DriverRow>[] {
  const lookup = (list: LookupOption[]) =>
    list.map((l) => ({ value: l.id, label: l.labelEn }));

  return [
    { key: "code", label: labels.driverCode, kind: "text", get: (r) => r.driverCode },
    { key: "name", label: labels.driverName, kind: "text", get: (r) => r.driverName },
    { key: "vendor", label: labels.vendor, kind: "picker",
      options: options.vendors, get: (r) => [r.vendorId, r.vendorName] },
    { key: "mobile", label: labels.mobile, kind: "text", get: (r) => r.mobileNumber },
    { key: "grade", label: labels.licenseGrade, kind: "select",
      options: lookup(options.licenseGrades), get: (r) => r.licenseGradeId },
    { key: "hiring", label: labels.hiringDate, kind: "dateRange",
      get: (r) => r.hiringDate },
    { key: "licence", label: labels.licenseExpiry, kind: "dateRange",
      get: (r) => r.licenseExpiryDate },
    { key: "tourism", label: labels.tourismExpiry, kind: "dateRange",
      get: (r) => r.tourismIdExpiryDate },
    { key: "hasTourism", label: labels.hasTourismId, kind: "boolean",
      get: (r) => r.hasTourismId },
    { key: "status", label: labels.status, kind: "select",
      options: lookup(options.statuses), get: (r) => r.statusId },
  ];
}
