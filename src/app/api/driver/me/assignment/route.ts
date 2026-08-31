import { NextRequest, NextResponse } from "next/server";
import { resolveDriver } from "@/lib/driver-auth";
import { resolveAssignments } from "@/lib/driver-assignment";

/**
 * Driver companion app, GPS phase. The app calls this on launch and after
 * tapping "Start Shift" to find out what today's assignment(s) look like —
 * `assignments.length` tells it which of the three states to render:
 * 0 = no shift today, 1 = ready to start, 2+ = ask the driver which shift.
 *
 * Session-authenticated (the driver's own Supabase Auth token), not the
 * shared-secret scheme /api/gps/webhook uses for provider servers — a
 * static secret baked into an APK on ~100 phones is effectively public.
 */
export async function GET(request: NextRequest) {
  const driver = await resolveDriver(request);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const assignments = await resolveAssignments(driver.id);
    return NextResponse.json({ driver, assignments });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to resolve assignment" },
      { status: 500 },
    );
  }
}
