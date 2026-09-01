import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/route-auth";
import { loadFleetLocations } from "@/app/[locale]/(app)/fleet-location/queries";

/**
 * Read-only polling endpoint for the live fleet map
 * (`fleet-location-map.tsx`) — a Client Component can't call a Server
 * Component's data loader directly, and this isn't a mutation so it's a
 * `GET` route rather than a Server Action, matching the other routes
 * under `src/app/api/gps/`. Same auth gate as the export routes
 * (`getRouteUser`); RLS on the underlying tables still applies regardless.
 */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await loadFleetLocations();
  return NextResponse.json(rows);
}
