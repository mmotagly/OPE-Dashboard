import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteUser } from "@/lib/route-auth";

/**
 * Live view (roadmap item 3). Proxies through the app's own backend to the
 * site's camera bridge — never the camera or bridge directly from a
 * browser, per the roadmap's explicit security instruction.
 *
 * Honest about the one real gap: the bridge returns a raw RTSP URL today,
 * which no browser can play, and doesn't yet relay it to HLS/WebRTC (see
 * bridge/README.md's "what's still a config slot" section). This route
 * reports that plainly rather than handing a browser a URL it can't use.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const user = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cameraId } = await params;
  const supabase = await createClient();

  // cameras/camera_bridges (0020_cameras.sql) aren't in the generated
  // types yet — same bridge as csv-import.ts's loadCodeMap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: camera } = await (supabase as any)
    .from("cameras")
    .select("camera_code, supports_live, camera_bridges ( base_url )")
    .eq("id", cameraId)
    .maybeSingle();

  if (!camera) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  if (!camera.supports_live) {
    return NextResponse.json({ error: "This camera does not support live view" }, { status: 400 });
  }

  const bridge = Array.isArray(camera.camera_bridges) ? camera.camera_bridges[0] : camera.camera_bridges;
  if (!bridge?.base_url) {
    return NextResponse.json(
      { available: false, reason: "This camera's bridge has no base_url configured yet." },
      { status: 200 },
    );
  }

  return NextResponse.json({
    available: false,
    reason:
      "Live browser playback needs an RTSP-to-HLS/WebRTC relay in the bridge, which isn't built yet — see bridge/README.md.",
  });
}
