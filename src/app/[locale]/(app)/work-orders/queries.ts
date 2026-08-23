import { createClient } from "@/lib/supabase/server";
import { loadLookupSets, type LookupOption } from "@/lib/lookups";

/**
 * Read side of work orders.
 *
 * The repeat index comes from `v_work_order_repeat_index` and nothing here
 * counts prior work orders. `vehicle_part_schedules` is never read or written
 * from this module either — trg_wo_advance_pm owns it.
 */

export type WorkOrderStatus = "skipped" | "completed" | "inProgress" | "notStarted";

export type WorkOrderRow = {
  id: string;
  workOrderNumber: string;
  rfrId: string;
  rfrNumber: string;
  vehicleCode: string;
  plateNumber: string;
  issueTypeId: string | null;
  issueTypeLabel: string | null;
  maintenanceTypeId: string | null;
  maintenanceTypeLabel: string | null;
  maintenanceCategoryId: string | null;
  maintenanceCategoryLabel: string | null;
  vehicleStatusAfterId: string | null;
  vehicleStatusAfterLabel: string | null;
  engineerId: string | null;
  engineerName: string | null;
  centreId: string | null;
  centreName: string | null;
  repairStartAt: string | null;
  repairEndAt: string | null;
  technicians: string[];
  isSkipped: boolean;
  skipReasonId: string | null;
  skipReasonLabel: string | null;
  skipNotes: string | null;
  description: string | null;
  partIds: string[];
  status: WorkOrderStatus;
};

/** Everything the form needs about the RFR it hangs off, all read-only. */
export type RfrContext = {
  rfrId: string;
  rfrNumber: string;
  vehicleCode: string;
  plateNumber: string;
  driverName: string | null;
  odometerKm: number | null;
  description: string;
};

export type PartOption = {
  id: string;
  partCode: string;
  partName: string;
  /** A part is a PM item when the catalogue gives it an interval. */
  isPmItem: boolean;
};

export type WorkOrderOptions = {
  engineers: { id: string; fullName: string }[];
  centres: { id: string; centreCode: string; centreName: string }[];
  parts: PartOption[];
  maintenanceTypes: LookupOption[];
  issueTypes: LookupOption[];
  maintenanceCategories: LookupOption[];
  vehicleStatusAfter: LookupOption[];
  skipReasons: LookupOption[];
};

export type RepeatIndex = {
  d10: number;
  d20: number;
  d30: number;
  d50: number;
};

export type WorkOrderFormValues = {
  assignedEngineerId: string;
  maintenanceTypeId: string;
  issueTypeId: string;
  maintenanceCategoryId: string;
  maintenanceCenterId: string;
  repairStartAt: string;
  repairEndAt: string;
  technician1: string;
  technician2: string;
  technician3: string;
  isSkipped: boolean;
  skipReasonId: string;
  skipNotes: string;
  vehicleStatusAfterId: string;
  description: string;
  partIds: string[];
};

// work_orders reaches profiles twice (engineer and creator), so the embed names
// the foreign key it means.
const SELECT = `
  id,
  work_order_number,
  rfr_id,
  assigned_engineer_id,
  maintenance_type_id,
  issue_type_id,
  maintenance_category_id,
  maintenance_center_id,
  vehicle_status_after_id,
  repair_start_at,
  repair_end_at,
  technician_1,
  technician_2,
  technician_3,
  is_skipped,
  skip_reason_id,
  skip_notes,
  description,
  rfrs (
    rfr_number, odometer_km, description,
    vehicles ( vehicle_code, plate_number ),
    drivers ( driver_name )
  ),
  profiles!assigned_engineer_id ( full_name ),
  maintenance_centers ( center_code, center_name ),
  work_order_parts ( part_id )
`;

/** The rule the list, the drawer and the status chips all share. */
export function workOrderStatus(row: {
  isSkipped: boolean;
  repairStartAt: string | null;
  repairEndAt: string | null;
}): WorkOrderStatus {
  if (row.isSkipped) return "skipped";
  if (row.repairEndAt) return "completed";
  if (row.repairStartAt) return "inProgress";
  return "notStarted";
}

// Resolving labels for whatever an existing row already points at — a
// deactivated value should still show its real label here, not a dash.
async function lookupMap(): Promise<Map<string, LookupOption>> {
  const sets = await loadLookupSets(
    [
      "maintenance_type",
      "issue_type",
      "maintenance_category",
      "vehicle_status_after",
      "skip_reason",
    ] as const,
    { includeInactive: true },
  );

  return new Map(
    [
      ...sets.maintenance_type,
      ...sets.issue_type,
      ...sets.maintenance_category,
      ...sets.vehicle_status_after,
      ...sets.skip_reason,
    ].map((l) => [l.id, l]),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

function toRow(w: any, lookups: Map<string, LookupOption>): WorkOrderRow {
  const rfr = one<any>(w.rfrs);
  const vehicle = one<any>(rfr?.vehicles);
  const engineer = one<any>(w.profiles);
  const centre = one<any>(w.maintenance_centers);
  const label = (id: string | null) => (id ? (lookups.get(id)?.labelEn ?? null) : null);

  const base = {
    isSkipped: Boolean(w.is_skipped),
    repairStartAt: w.repair_start_at,
    repairEndAt: w.repair_end_at,
  };

  return {
    id: w.id,
    workOrderNumber: w.work_order_number,
    rfrId: w.rfr_id,
    rfrNumber: rfr?.rfr_number ?? "—",
    vehicleCode: vehicle?.vehicle_code ?? "—",
    plateNumber: vehicle?.plate_number ?? "—",
    issueTypeId: w.issue_type_id,
    issueTypeLabel: label(w.issue_type_id),
    maintenanceTypeId: w.maintenance_type_id,
    maintenanceTypeLabel: label(w.maintenance_type_id),
    maintenanceCategoryId: w.maintenance_category_id,
    maintenanceCategoryLabel: label(w.maintenance_category_id),
    vehicleStatusAfterId: w.vehicle_status_after_id,
    vehicleStatusAfterLabel: label(w.vehicle_status_after_id),
    engineerId: w.assigned_engineer_id,
    engineerName: engineer?.full_name ?? null,
    centreId: w.maintenance_center_id,
    centreName: centre?.center_name ?? null,
    repairStartAt: w.repair_start_at,
    repairEndAt: w.repair_end_at,
    technicians: [w.technician_1, w.technician_2, w.technician_3].filter(
      (t): t is string => typeof t === "string" && t.trim() !== "",
    ),
    isSkipped: base.isSkipped,
    skipReasonId: w.skip_reason_id,
    skipReasonLabel: label(w.skip_reason_id),
    skipNotes: w.skip_notes,
    description: w.description,
    partIds: Array.isArray(w.work_order_parts)
      ? w.work_order_parts.map((p: any) => p.part_id as string)
      : [],
    status: workOrderStatus(base),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadWorkOrders(search: string): Promise<WorkOrderRow[]> {
  const supabase = await createClient();

  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("work_orders").select(SELECT).order("created_at", { ascending: false }).limit(200),
  ]);

  const rows = (data ?? []).map((w) => toRow(w, lookups));
  const q = search.trim().toLowerCase();
  if (!q) return rows;

  // The searchable text spans an embedded table, which PostgREST cannot filter
  // on, so the narrowing happens here over the fetched page.
  return rows.filter((r) =>
    [r.workOrderNumber, r.rfrNumber, r.vehicleCode, r.plateNumber]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export async function loadWorkOrder(id: string): Promise<WorkOrderRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("work_orders").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  return data ? toRow(data, lookups) : null;
}

export async function loadRfrContext(rfrId: string): Promise<RfrContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rfrs")
    .select(
      `id, rfr_number, odometer_km, description,
       vehicles ( vehicle_code, plate_number ),
       drivers ( driver_name )`,
    )
    .eq("id", rfrId)
    .maybeSingle();

  if (!data) return null;

  const vehicle = Array.isArray(data.vehicles) ? data.vehicles[0] : data.vehicles;
  const driver = Array.isArray(data.drivers) ? data.drivers[0] : data.drivers;

  return {
    rfrId: data.id,
    rfrNumber: data.rfr_number,
    vehicleCode: vehicle?.vehicle_code ?? "—",
    plateNumber: vehicle?.plate_number ?? "—",
    driverName: driver?.driver_name ?? null,
    odometerKm: data.odometer_km,
    description: data.description,
  };
}

export async function loadWorkOrderOptions(): Promise<WorkOrderOptions> {
  const supabase = await createClient();

  const [sets, engineers, centres, parts] = await Promise.all([
    loadLookupSets([
      "maintenance_type",
      "issue_type",
      "maintenance_category",
      "vehicle_status_after",
      "skip_reason",
    ] as const),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_engineer", true)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("maintenance_centers")
      .select("id, center_code, center_name")
      .eq("is_active", true)
      .order("center_code"),
    supabase
      .from("parts")
      .select("id, part_code, part_name, pm_interval_km")
      .eq("is_active", true)
      .order("part_name"),
  ]);

  return {
    engineers: (engineers.data ?? []).map((p) => ({ id: p.id, fullName: p.full_name })),
    centres: (centres.data ?? []).map((c) => ({
      id: c.id,
      centreCode: c.center_code,
      centreName: c.center_name,
    })),
    parts: (parts.data ?? []).map((p) => ({
      id: p.id,
      partCode: p.part_code,
      partName: p.part_name,
      isPmItem: p.pm_interval_km !== null,
    })),
    maintenanceTypes: sets.maintenance_type,
    issueTypes: sets.issue_type,
    maintenanceCategories: sets.maintenance_category,
    vehicleStatusAfter: sets.vehicle_status_after,
    skipReasons: sets.skip_reason,
  };
}

/** Straight from the view. Nothing here counts anything. */
export async function loadRepeatIndex(workOrderId: string): Promise<RepeatIndex | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_work_order_repeat_index")
    .select("repeat_10d, repeat_20d, repeat_30d, repeat_50d")
    .eq("work_order_id", workOrderId)
    .maybeSingle();

  if (!data) return null;
  return {
    d10: data.repeat_10d ?? 0,
    d20: data.repeat_20d ?? 0,
    d30: data.repeat_30d ?? 0,
    d50: data.repeat_50d ?? 0,
  };
}

export function toWorkOrderFormValues(row: WorkOrderRow): WorkOrderFormValues {
  return {
    assignedEngineerId: row.engineerId ?? "",
    maintenanceTypeId: row.maintenanceTypeId ?? "",
    issueTypeId: row.issueTypeId ?? "",
    maintenanceCategoryId: row.maintenanceCategoryId ?? "",
    maintenanceCenterId: row.centreId ?? "",
    repairStartAt: row.repairStartAt ?? "",
    repairEndAt: row.repairEndAt ?? "",
    technician1: row.technicians[0] ?? "",
    technician2: row.technicians[1] ?? "",
    technician3: row.technicians[2] ?? "",
    isSkipped: row.isSkipped,
    skipReasonId: row.skipReasonId ?? "",
    skipNotes: row.skipNotes ?? "",
    vehicleStatusAfterId: row.vehicleStatusAfterId ?? "",
    description: row.description ?? "",
    partIds: row.partIds,
  };
}

export const EMPTY_WORK_ORDER_FORM: WorkOrderFormValues = {
  assignedEngineerId: "",
  maintenanceTypeId: "",
  issueTypeId: "",
  maintenanceCategoryId: "",
  maintenanceCenterId: "",
  repairStartAt: "",
  repairEndAt: "",
  technician1: "",
  technician2: "",
  technician3: "",
  isSkipped: false,
  skipReasonId: "",
  skipNotes: "",
  vehicleStatusAfterId: "",
  description: "",
  partIds: [],
};
