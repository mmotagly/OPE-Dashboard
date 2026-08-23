import { createClient } from "@/lib/supabase/server";
import { loadLookupSets, loadLookups, type LookupOption } from "@/lib/lookups";

/**
 * Read side of the RFR module.
 *
 * Access time is never computed here. `access_minutes`/`access_display` are
 * PostgREST computed columns on `rfrs` (0003_rfr_access_computed_columns.sql)
 * backed by fn_rfr_access_minutes/fn_format_minutes, read straight off the
 * row — the display string is already formatted by the database.
 */

export type RfrRow = {
  id: string;
  rfrNumber: string;
  requestAt: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  driverId: string | null;
  driverName: string | null;
  driverCode: string | null;
  odometerKm: number | null;
  vehicleLocation: string;
  description: string;
  stageId: string;
  stageCode: string | null;
  stageLabel: string | null;
  skipReasonId: string | null;
  skipReasonLabel: string | null;
  completedAt: string | null;
  raisedBy: string | null;
  /** From the access_display computed column — already formatted by the database. */
  accessDisplay: string;
  accessMinutes: number;
  /**
   * The clock ticks only while the stage is Active and no work order has a
   * repair start yet. This is a display decision, not a recomputation of the
   * minutes above.
   */
  clockRunning: boolean;
};

export type RfrIssueRow = {
  id: string;
  issueTypeId: string;
  issueTypeLabel: string;
  isSkipped: boolean;
  skipReasonId: string | null;
  skipReasonLabel: string | null;
  notes: string | null;
};

export type RfrWorkOrderRow = {
  id: string;
  workOrderNumber: string;
  issueTypeLabel: string | null;
  engineerName: string | null;
  repairStartAt: string | null;
  repairEndAt: string | null;
  isSkipped: boolean;
};

export type StageVisit = { stageId: string; changedAt: string };

export type RfrFormValues = {
  requestAt: string;
  vehicleId: string;
  driverId: string;
  odometerKm: string;
  vehicleLocation: string;
  description: string;
  issueTypeIds: string[];
};

export type RfrOptions = {
  vehicles: {
    id: string;
    vehicleCode: string;
    plateNumber: string;
    currentOdometerKm: number | null;
  }[];
  drivers: { id: string; driverCode: string; driverName: string }[];
  issueTypes: LookupOption[];
  skipReasons: LookupOption[];
  stages: LookupOption[];
};

// access_minutes / access_display are PostgREST computed columns (see
// 0003_rfr_access_computed_columns.sql) — reading them here is one round
// trip, not a separate query against v_rfr_access_time afterward.
const SELECT = `
  id,
  rfr_number,
  request_at,
  vehicle_id,
  driver_id,
  odometer_km,
  vehicle_location,
  description,
  stage_id,
  skip_reason_id,
  completed_at,
  access_minutes,
  access_display,
  vehicles ( vehicle_code, plate_number ),
  drivers ( driver_code, driver_name ),
  profiles ( full_name ),
  work_orders ( repair_start_at )
`;

export async function loadStages(): Promise<LookupOption[]> {
  return loadLookups("rfr_stage");
}

async function lookupMap(): Promise<Map<string, LookupOption>> {
  // Resolving labels for whatever an existing row already points at — a
  // deactivated value should still show its real label here, not a dash.
  const sets = await loadLookupSets(["rfr_stage", "skip_reason"] as const, {
    includeInactive: true,
  });
  return new Map([...sets.rfr_stage, ...sets.skip_reason].map((l) => [l.id, l]));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(
  r: any,
  lookups: Map<string, LookupOption>,
): RfrRow {
  const vehicle = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
  const driver = Array.isArray(r.drivers) ? r.drivers[0] : r.drivers;
  const raiser = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  const stage = lookups.get(r.stage_id);
  const skipReason = r.skip_reason_id ? lookups.get(r.skip_reason_id) : undefined;

  const workOrders: { repair_start_at: string | null }[] = Array.isArray(r.work_orders)
    ? r.work_orders
    : [];
  const anyRepairStarted = workOrders.some((w) => w.repair_start_at !== null);

  return {
    id: r.id,
    rfrNumber: r.rfr_number,
    requestAt: r.request_at,
    vehicleId: r.vehicle_id,
    vehicleCode: vehicle?.vehicle_code ?? "—",
    plateNumber: vehicle?.plate_number ?? "—",
    driverId: r.driver_id,
    driverName: driver?.driver_name ?? null,
    driverCode: driver?.driver_code ?? null,
    odometerKm: r.odometer_km,
    vehicleLocation: r.vehicle_location,
    description: r.description,
    stageId: r.stage_id,
    stageCode: stage?.code ?? null,
    stageLabel: stage?.labelEn ?? null,
    skipReasonId: r.skip_reason_id,
    skipReasonLabel: skipReason?.labelEn ?? null,
    completedAt: r.completed_at,
    raisedBy: raiser?.full_name ?? null,
    accessDisplay: r.access_display ?? "—",
    accessMinutes: Number(r.access_minutes ?? 0),
    clockRunning: stage?.code === "active" && !anyRepairStarted,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadRfrs(stageCode: string): Promise<RfrRow[]> {
  const supabase = await createClient();

  const baseQuery = () =>
    supabase.from("rfrs").select(SELECT).order("request_at", { ascending: false }).limit(200);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let lookups: Map<string, LookupOption>;
  let rows: any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (stageCode) {
    // The filter needs the resolved stage id, so lookups must resolve first here.
    lookups = await lookupMap();
    const stageId = [...lookups.values()].find((l) => l.code === stageCode)?.id;
    // an unknown stage code must not silently show everything
    const { data } = await baseQuery().eq(
      "stage_id",
      stageId ?? "00000000-0000-0000-0000-000000000000",
    );
    rows = data ?? [];
  } else {
    // Nothing here depends on lookups, so fetch both at once.
    const [lookupsResult, { data }] = await Promise.all([lookupMap(), baseQuery()]);
    lookups = lookupsResult;
    rows = data ?? [];
  }

  return rows.map((r) => toRow(r, lookups));
}

export async function loadRfr(id: string): Promise<RfrRow | null> {
  const supabase = await createClient();
  const [lookups, { data }] = await Promise.all([
    lookupMap(),
    supabase.from("rfrs").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  if (!data) return null;
  return toRow(data, lookups);
}

export async function loadRfrIssues(rfrId: string): Promise<RfrIssueRow[]> {
  const supabase = await createClient();
  const [sets, { data }] = await Promise.all([
    loadLookupSets(["issue_type", "skip_reason"] as const),
    supabase
      .from("rfr_issues")
      .select("id, issue_type_id, is_skipped, skip_reason_id, notes")
      .eq("rfr_id", rfrId),
  ]);

  const lookups = new Map(
    [...sets.issue_type, ...sets.skip_reason].map((l) => [l.id, l]),
  );

  return (data ?? [])
    .map((i) => ({
      id: i.id,
      issueTypeId: i.issue_type_id,
      issueTypeLabel: lookups.get(i.issue_type_id)?.labelEn ?? "—",
      isSkipped: i.is_skipped,
      skipReasonId: i.skip_reason_id,
      skipReasonLabel: i.skip_reason_id
        ? (lookups.get(i.skip_reason_id)?.labelEn ?? null)
        : null,
      notes: i.notes,
    }))
    .sort((a, b) => a.issueTypeLabel.localeCompare(b.issueTypeLabel));
}

export async function loadRfrWorkOrders(rfrId: string): Promise<RfrWorkOrderRow[]> {
  const supabase = await createClient();
  const [issueTypes, { data }] = await Promise.all([
    loadLookups("issue_type"),
    supabase
      .from("work_orders")
      // work_orders reaches profiles twice (engineer and creator), so the
      // embed has to name which foreign key it means.
      .select(
        `id, work_order_number, issue_type_id, repair_start_at, repair_end_at,
         is_skipped, profiles!assigned_engineer_id ( full_name )`,
      )
      .eq("rfr_id", rfrId)
      .order("created_at"),
  ]);

  const byId = new Map(issueTypes.map((l) => [l.id, l]));

  return (data ?? []).map((w) => {
    const engineer = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
    return {
      id: w.id,
      workOrderNumber: w.work_order_number,
      issueTypeLabel: w.issue_type_id ? (byId.get(w.issue_type_id)?.labelEn ?? null) : null,
      engineerName: engineer?.full_name ?? null,
      repairStartAt: w.repair_start_at,
      repairEndAt: w.repair_end_at,
      isSkipped: w.is_skipped,
    };
  });
}

/** Which stages this RFR has actually been through, for the rail. */
export async function loadStageVisits(rfrId: string): Promise<StageVisit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rfr_stage_history")
    .select("stage_id, changed_at")
    .eq("rfr_id", rfrId)
    .order("changed_at");

  return (data ?? []).map((h) => ({ stageId: h.stage_id, changedAt: h.changed_at }));
}

export async function loadRfrOptions(): Promise<RfrOptions> {
  const supabase = await createClient();

  const [sets, vehicles, drivers] = await Promise.all([
    loadLookupSets(["issue_type", "skip_reason", "rfr_stage"] as const),
    supabase
      .from("vehicles")
      .select("id, vehicle_code, plate_number, current_odometer_km")
      .order("vehicle_code"),
    supabase.from("drivers").select("id, driver_code, driver_name").order("driver_code"),
  ]);

  return {
    vehicles: (vehicles.data ?? []).map((v) => ({
      id: v.id,
      vehicleCode: v.vehicle_code,
      plateNumber: v.plate_number,
      currentOdometerKm: v.current_odometer_km,
    })),
    drivers: (drivers.data ?? []).map((d) => ({
      id: d.id,
      driverCode: d.driver_code,
      driverName: d.driver_name,
    })),
    issueTypes: sets.issue_type,
    skipReasons: sets.skip_reason,
    stages: sets.rfr_stage,
  };
}

export async function toRfrFormValues(row: RfrRow): Promise<RfrFormValues> {
  const issues = await loadRfrIssues(row.id);
  return {
    requestAt: row.requestAt,
    vehicleId: row.vehicleId,
    driverId: row.driverId ?? "",
    odometerKm: row.odometerKm === null ? "" : String(row.odometerKm),
    vehicleLocation: row.vehicleLocation,
    description: row.description,
    issueTypeIds: issues.map((i) => i.issueTypeId),
  };
}

export const EMPTY_RFR_FORM: RfrFormValues = {
  requestAt: "",
  vehicleId: "",
  driverId: "",
  odometerKm: "",
  vehicleLocation: "",
  description: "",
  issueTypeIds: [],
};
