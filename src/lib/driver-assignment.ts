import { createServiceClient } from "./supabase/service";

/**
 * "Which vehicle is this driver on right now" — shared by both driver-app
 * routes (GET .../assignment reads it for the app to show/choose from, POST
 * .../ping re-resolves it on every single ping) so the two can never
 * disagree about what counts as today's assignment.
 *
 * Matches driver_id + operation_date + shift_type_id on
 * daily_vehicle_operations, exactly as CLAUDE.md section 2 describes the
 * one-row-per-vehicle-per-shift-per-date model. There is no clock-derived
 * "current shift" anywhere in this schema (app_settings only holds PM
 * thresholds) — a driver with two rows today (both shifts assigned) picks
 * explicitly in the app rather than the server guessing a boundary hour
 * this project has never defined.
 */

export type DriverAssignment = {
  operationId: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  shiftCode: string;
  shiftLabel: string;
};

/** `YYYY-MM-DD` for "now" in Africa/Cairo, independent of server TZ — the
 * same calendar day a person in Giza would call "today", not the server's
 * or the phone's own local date if either ever ran on a different clock. */
export function todayInCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function resolveAssignments(driverId: string): Promise<DriverAssignment[]> {
  const supabase = createServiceClient();
  const today = todayInCairo();

  const [{ data: shiftLookups, error: shiftError }, { data: rows, error: rowsError }] =
    await Promise.all([
      (supabase as any).from("lookups").select("id, code, label_en").eq("category", "shift_type"),
      (supabase as any)
        .from("daily_vehicle_operations")
        .select("id, vehicle_id, shift_type_id, vehicles ( vehicle_code, plate_number )")
        .eq("driver_id", driverId)
        .eq("operation_date", today),
    ]);
  if (shiftError) throw shiftError;
  if (rowsError) throw rowsError;

  const shiftMap = new Map(
    (shiftLookups ?? []).map((l: Record<string, string>) => [
      l.id,
      { code: l.code, labelEn: l.label_en },
    ]),
  );

  return (rows ?? []).map((r: Record<string, any>) => {
    const shift = shiftMap.get(r.shift_type_id) as { code: string; labelEn: string } | undefined;
    return {
      operationId: r.id,
      vehicleId: r.vehicle_id,
      vehicleCode: r.vehicles?.vehicle_code ?? "",
      plateNumber: r.vehicles?.plate_number ?? "",
      shiftCode: shift?.code ?? "",
      shiftLabel: shift?.labelEn ?? "",
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
