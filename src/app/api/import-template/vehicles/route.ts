import { toCsv, csvResponse } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { VEHICLE_IMPORT_COLUMNS } from "@/app/[locale]/(app)/vehicles/schema";

/** Blank CSV template: header row only, columns straight from the schema's
 * own import column list so the template can never drift from what the
 * import action actually reads. */
export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const csv = toCsv<Record<(typeof VEHICLE_IMPORT_COLUMNS)[number], never>>(
    [],
    VEHICLE_IMPORT_COLUMNS.map((c) => ({ key: c, header: c })),
  );
  return csvResponse(csv, "vehicles-template.csv");
}
