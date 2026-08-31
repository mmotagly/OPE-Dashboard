import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteUser } from "@/lib/route-auth";
import { fetchPlayback, BridgeUnreachableError } from "@/lib/cameras/bridge-client";

/**
 * Playback request (roadmap item 3): looks up the camera's bridge, asks it
 * to search recorded footage for the given window via ISAPI, and logs the
 * attempt on `camera_clip_requests` regardless of outcome — the same
 * "record the attempt, report what actually happened" shape as everything
 * else in this app that talks to a system outside its own database.
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
    .select("camera_code, camera_bridges ( base_url )")
    .eq("id", cameraId)
    .maybeSingle();

  if (!camera) return NextResponse.json({ error: "Camera not found" }, { status: 404 });

  const bridge = Array.isArray(camera.camera_bridges) ? camera.camera_bridges[0] : camera.camera_bridges;

  const { data: requestRow } = await db
    .from("camera_clip_requests")
    .insert({ camera_id: cameraId, window_start: start, window_end: end })
    .select("id")
    .single();

  if (!bridge?.base_url) {
    await db
      .from("camera_clip_requests")
      .update({ status: "failed", error_message: "Bridge has no base_url configured" })
      .eq("id", requestRow?.id);
    return NextResponse.json({ error: "This camera's bridge is not configured yet" }, { status: 503 });
  }

  try {
    const result = await fetchPlayback(bridge.base_url, camera.camera_code, start, end);
    await db
      .from("camera_clip_requests")
      .update({ status: "ready", clip_reference: JSON.stringify(result.matches) })
      .eq("id", requestRow?.id);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof BridgeUnreachableError || e instanceof Error ? e.message : "Playback request failed";
    await db
      .from("camera_clip_requests")
      .update({ status: "failed", error_message: message })
      .eq("id", requestRow?.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
