import { NextRequest, NextResponse } from "next/server";
import { AccessToken, type VideoGrant } from "livekit-server-sdk";
import { getRouteUser } from "@/lib/route-auth";
import { resolveDriver } from "@/lib/driver-auth";
import { resolveAssignments } from "@/lib/driver-assignment";
import { createClient } from "@/lib/supabase/server";

/**
 * Camera streaming (roadmap item 10, driver app phase 2). Mints a
 * short-lived LiveKit access token for one room per operation —
 * `op-<operationId>`, matching the same "operationId is the unit of
 * authorization" pattern /api/gps/driver/ping already established. Two
 * very different callers, two very different grants:
 *
 *   - a driver (Bearer token, same auth as the GPS routes) publishing
 *     their phone's camera — verified against today's actual assignment,
 *     exactly like a GPS ping, so a driver can only ever publish into
 *     their own shift's room, never an arbitrary one
 *   - a staff member (cookie session, same as every other staff route)
 *     watching — subscribe-only, gated by the same RLS-scoped operation
 *     lookup every other staff read already goes through
 *
 * Empty/fails closed until LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET
 * are set — same config-slot convention as GPS_WEBHOOK_SECRET/GPS_PROVIDER.
 * See STATUS.md for exactly what's needed to activate this.
 */
export async function POST(request: NextRequest) {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const operationId = body?.operationId;
  if (typeof operationId !== "string" || !operationId) {
    return NextResponse.json({ error: "operationId is required" }, { status: 400 });
  }
  const room = `op-${operationId}`;

  // Driver (publisher) — Bearer token, same as /api/gps/driver/ping.
  const driver = await resolveDriver(request);
  if (driver) {
    const assignments = await resolveAssignments(driver.id);
    const assignment = assignments.find((a) => a.operationId === operationId);
    if (!assignment) {
      return NextResponse.json(
        { error: "This assignment is no longer valid — restart your shift in the app" },
        { status: 409 },
      );
    }

    const grant: VideoGrant = { room, roomJoin: true, canPublish: true, canSubscribe: false };
    const token = new AccessToken(apiKey, apiSecret, { identity: `driver-${driver.id}` });
    token.addGrant(grant);
    return NextResponse.json({ token: await token.toJwt(), url });
  }

  // Staff (viewer) — cookie session. Any authenticated role can watch, same
  // as any role can read the operation itself; RLS on the lookup below is
  // the actual gate, not a role check here.
  const staff = await getRouteUser();
  if (staff) {
    const supabase = await createClient();
    const { data: operation } = await supabase
      .from("daily_vehicle_operations")
      .select("id")
      .eq("id", operationId)
      .maybeSingle();
    if (!operation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const grant: VideoGrant = { room, roomJoin: true, canPublish: false, canSubscribe: true };
    const token = new AccessToken(apiKey, apiSecret, { identity: `staff-${staff.id}` });
    token.addGrant(grant);
    return NextResponse.json({ token: await token.toJwt(), url });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
