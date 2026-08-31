import { toCsv, csvResponse } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { VENDOR_IMPORT_COLUMNS } from "@/app/[locale]/(app)/vendors/schema";

export async function GET() {
  const user = await getRouteUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const csv = toCsv<Record<(typeof VENDOR_IMPORT_COLUMNS)[number], never>>(
    [],
    VENDOR_IMPORT_COLUMNS.map((c) => ({ key: c, header: c })),
  );
  return csvResponse(csv, "vendors-template.csv");
}
