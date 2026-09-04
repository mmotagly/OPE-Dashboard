import type { FilterDef, FilterOption } from "@/lib/filters";
import type { LookupOption } from "@/lib/lookups";
import type { WorkOrderRow } from "./queries";

export function buildWorkOrderFilters(
  labels: Record<string, string>,
  options: {
    issueTypes: LookupOption[];
    maintenanceTypes: LookupOption[];
    categories: LookupOption[];
    engineers: FilterOption[];
    centres: FilterOption[];
  },
): FilterDef<WorkOrderRow>[] {
  const lookup = (list: LookupOption[]) =>
    list.map((l) => ({ value: l.id, label: l.labelEn }));

  return [
    { key: "number", label: labels.number, kind: "text", get: (r) => r.workOrderNumber },
    { key: "rfr", label: labels.rfr, kind: "text", get: (r) => r.rfrNumber },
    { key: "vehicle", label: labels.vehicle, kind: "text", get: (r) => [r.vehicleCode, r.plateNumber] },
    { key: "issue", label: labels.issueType, kind: "select",
      options: lookup(options.issueTypes), get: (r) => r.issueTypeId },
    { key: "maintenanceType", label: labels.maintenanceType, kind: "select",
      options: lookup(options.maintenanceTypes), get: (r) => r.maintenanceTypeId },
    { key: "category", label: labels.category, kind: "select",
      options: lookup(options.categories), get: (r) => r.maintenanceCategoryId },
    { key: "engineer", label: labels.engineer, kind: "picker",
      options: options.engineers, get: (r) => [r.engineerId, r.engineerName] },
    { key: "centre", label: labels.centre, kind: "select",
      options: options.centres, get: (r) => r.centreId },
    { key: "repairStart", label: labels.repairStart, kind: "dateRange",
      get: (r) => r.repairStartAt },
    { key: "repairEnd", label: labels.repairEnd, kind: "dateRange",
      get: (r) => r.repairEndAt },
    { key: "status", label: labels.status, kind: "select",
      options: [
        { value: "notStarted", label: labels.statusNotStarted },
        { value: "inProgress", label: labels.statusInProgress },
        { value: "completed", label: labels.statusCompleted },
        { value: "skipped", label: labels.statusSkipped },
      ],
      get: (r) => r.status },
  ];
}
