import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { loadOperations } from "@/app/[locale]/(app)/operations/queries";

/**
 * CSV export for the operations log (roadmap item 7). Reuses the same
 * loadOperations() the Operations page itself calls — no separate query,
 * no separate shape. Capped higher than the page's own 200-row UI cap
 * (HANDOVER.md's own flagged risk) since an export is meant to cover more
 * than one screenful, but still bounded rather than unbounded.
 */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await loadOperations({ limit: 5000 });

  const csv = toCsv(rows, [
    { key: "code", header: "Code" },
    { key: "date", header: "Date" },
    { key: "vehicleCode", header: "Vehicle" },
    { key: "plate", header: "Plate" },
    { key: "vendorName", header: "Vendor" },
    { key: "driverName", header: "Driver" },
    { key: "routeName", header: "Route" },
    { key: "statusLabel", header: "Status" },
    { key: "startKm", header: "Starting KM" },
    { key: "endKm", header: "Ending KM" },
    { key: "distanceKm", header: "Distance KM" },
    { key: "operatingPct", header: "Operating %" },
    { key: "batteryStart", header: "Battery start %" },
    { key: "batteryEnd", header: "Battery end %" },
    { key: "driverTips", header: "Driver tips" },
  ]);

  return csvResponse(csv, `operations-${new Date().toISOString().slice(0, 10)}.csv`);
}
