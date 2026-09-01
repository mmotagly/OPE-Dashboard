import { NextRequest, NextResponse } from "next/server";
import { resolveDriver } from "@/lib/driver-auth";
import { resolveAssignments } from "@/lib/driver-assignment";
import { ingestPings } from "@/lib/gps/ingest";

/**
 * Driver companion app, GPS phase. One ping per call — the app's background
 * location task posts here every ~20s while a shift is active.
 *
 * `operationId` in the body is the assignment the driver started (chosen
 * explicitly up front when today had two rows, i.e. both shifts). It is
 * never trusted at face value: every call re-resolves this driver's actual
 * assignments for today and only accepts a ping whose operationId still
 * appears in that fresh list, so a dispatch correction to the operation row
 * — or a shift that's simply over — takes effect on the very next ping,
 * not just at the start of the shift.
 *
 * Not `provider: "driver_app"` on the shared GpsProvider union in
 * lib/gps/types.ts — that type is specifically "providers the webhook/poll
 * adapters know how to call" (see adapters/index.ts's
 * Record<GpsProvider, GpsAdapter>), and this route never goes through an
 * adapter. ingestPings() takes provider as a plain string for exactly this
 * reason, so the label is passed straight through instead.
 */

const DRIVER_APP_PROVIDER = "driver_app";

type PingBody = {
  operationId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh?: number | null;
  headingDeg?: number | null;
  /** Diagnostic only — not read here, just stored verbatim below in
   * raw_payload for later inspection (see driver-app/lib/location-task.ts). */
  accuracy?: number | null;
};

function isValidPing(body: unknown): body is PingBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.operationId === "string" &&
    b.operationId.length > 0 &&
    typeof b.latitude === "number" &&
    typeof b.longitude === "number" &&
    typeof b.recordedAt === "string"
  );
}

export async function POST(request: NextRequest) {
  const driver = await resolveDriver(request);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPing(body)) {
    return NextResponse.json({ error: "Invalid ping payload" }, { status: 400 });
  }

  const assignments = await resolveAssignments(driver.id);
  const assignment = assignments.find((a) => a.operationId === body.operationId);
  if (!assignment) {
    return NextResponse.json(
      { error: "This assignment is no longer valid — restart your shift in the app" },
      { status: 409 },
    );
  }

  const inserted = await ingestPings(DRIVER_APP_PROVIDER, [
    {
      vehicleId: assignment.vehicleId,
      recordedAt: body.recordedAt,
      latitude: body.latitude,
      longitude: body.longitude,
      speedKmh: body.speedKmh ?? null,
      headingDeg: body.headingDeg ?? null,
      odometerKm: null,
      ignitionOn: null,
      rawPayload: body,
    },
  ]);

  return NextResponse.json({ inserted });
}
