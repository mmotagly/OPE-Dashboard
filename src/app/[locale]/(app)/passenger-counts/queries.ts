import { createClient } from "@/lib/supabase/server";

export type PassengerCountRow = {
  id: string;
  vehicleCode: string;
  plateNumber: string;
  cameraCode: string;
  windowStart: string;
  windowEnd: string;
  enterCount: number;
  exitCount: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadPassengerCounts(): Promise<PassengerCountRow[]> {
  const supabase = await createClient();

  // bus_passenger_counts (0020_cameras.sql) isn't in the generated types
  // yet and the migration hasn't run against the live database — a
  // missing-relation error resolves to an empty list (data is null, never
  // thrown), same as fleet-location/cameras.
  const { data } = await (supabase as any)
    .from("bus_passenger_counts")
    .select(
      "id, window_start, window_end, enter_count, exit_count, vehicles ( vehicle_code, plate_number ), cameras ( camera_code )",
    )
    .order("window_start", { ascending: false })
    .limit(200);

  return (data ?? []).map((r: any) => {
    const vehicle = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
    const camera = Array.isArray(r.cameras) ? r.cameras[0] : r.cameras;
    return {
      id: r.id,
      vehicleCode: vehicle?.vehicle_code ?? "—",
      plateNumber: vehicle?.plate_number ?? "—",
      cameraCode: camera?.camera_code ?? "—",
      windowStart: r.window_start,
      windowEnd: r.window_end,
      enterCount: r.enter_count,
      exitCount: r.exit_count,
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
