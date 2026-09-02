import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { loadRoutes } from "@/app/[locale]/(app)/trips/queries";

/** CSV export for route master data (roadmap item 1) — routes only, not the
 * stop list (see routes/schema.ts). Columns match ROUTE_IMPORT_COLUMNS. */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await loadRoutes("");

  const csv = toCsv(
    rows.map((r) => ({
      route_code: r.routeCode,
      route_name: r.routeName,
      route_distance_km: r.routeDistanceKm,
      number_of_stations: r.numberOfStations,
      standard_leg_time: r.standardLegTime,
      standard_round_trip_time: r.standardRoundTripTime,
      status_code: r.statusCode,
    })),
    [
      { key: "route_code", header: "route_code" },
      { key: "route_name", header: "route_name" },
      { key: "route_distance_km", header: "route_distance_km" },
      { key: "number_of_stations", header: "number_of_stations" },
      { key: "standard_leg_time", header: "standard_leg_time" },
      { key: "standard_round_trip_time", header: "standard_round_trip_time" },
      { key: "status_code", header: "status_code" },
    ],
  );

  return csvResponse(csv, `routes-${new Date().toISOString().slice(0, 10)}.csv`);
}
