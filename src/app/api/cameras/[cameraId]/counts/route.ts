import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteUser } from "@/lib/route-auth";
import { fetchPassengerCount, BridgeUnreachableError } from "@/lib/cameras/bridge-client";

/**
 * Passenger count request (roadmap item 4) — the manual/on-demand path:
 * ask the bridge for enter/exit totals over a window right now, via the
 * same ISAPI SearchRegionTargetNumberCounting endpoint the bridge already
 * implements for playback's sibling feature. A scheduled version of this
 * (polling automatically per shift) is a straightforward follow-up once a
 * real bridge/camera exists to test the cadence against — not built yet
 * since there's nothing real to tune it on.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const user = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cameraId } = await params;
  const body = await request.json().catch(() => null);
  const start = typeof body?.start === "string" ? body.start : null;
  const end = typeof body?.end === "string" ? body.end : null;
  if (!start || !end) {
    return NextResponse.json({ error: "start and end (ISO timestamps) are required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: camera } = await db
    .from("cameras")
    .select("camera_code, vehicle_id, supports_counting, camera_bridges ( base_url )")
    .eq("id", cameraId)
    .maybeSingle();

  if (!camera) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  if (!camera.supports_counting) {
    return NextResponse.json({ error: "This camera does not support passenger counting" }, { status: 400 });
  }
  if (!camera.vehicle_id) {
    return NextResponse.json({ error: "This camera is not linked to a vehicle" }, { status: 400 });
  }

  const bridge = Array.isArray(camera.camera_bridges) ? camera.camera_bridges[0] : camera.camera_bridges;
  if (!bridge?.base_url) {
    return NextResponse.json({ error: "This camera's bridge is not configured yet" }, { status: 503 });
  }

  try {
    const result = await fetchPassengerCount(bridge.base_url, camera.camera_code, start, end);
    const { data: row } = await db
      .from("bus_passenger_counts")
      .insert({
        camera_id: cameraId,
        vehicle_id: camera.vehicle_id,
        window_start: start,
        window_end: end,
        enter_count: result.enterCount,
        exit_count: result.exitCount,
        raw_payload: result,
      })
      .select("id")
      .single();
    return NextResponse.json({ id: row?.id, ...result });
  } catch (e) {
    const message = e instanceof BridgeUnreachableError || e instanceof Error ? e.message : "Count request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
