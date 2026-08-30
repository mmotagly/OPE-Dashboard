import { csvResponse, toCsv } from "@/lib/csv";
import { getRouteUser } from "@/lib/route-auth";
import { canSeeMoney } from "@/lib/roles";
import { loadInvoices } from "@/app/[locale]/(app)/invoices/queries";

/**
 * CSV export for invoices (roadmap item 7). Reuses loadInvoices() as-is —
 * every figure was written by fn_generate_invoice, nothing recalculated
 * here. Same visibility as the Invoices page (canSeeMoney).
 */
export async function GET() {
  const user = await getRouteUser();
  if (!user || !canSeeMoney(user.role)) return new Response("Unauthorized", { status: 401 });

  const rows = await loadInvoices();

  const csv = toCsv(rows, [
    { key: "vendorName", header: "Vendor" },
    { key: "vendorCode", header: "Vendor code" },
    { key: "periodMonth", header: "Period month" },
    { key: "shiftLabel", header: "Shift" },
    { key: "billingBasis", header: "Billing basis" },
    { key: "rateAmount", header: "Rate" },
    { key: "busQuantity", header: "Bus quantity" },
    { key: "grossAmount", header: "Gross amount" },
    { key: "achievedPct", header: "Achieved %" },
    { key: "netAmount", header: "Net amount" },
    { key: "currency", header: "Currency" },
    { key: "status", header: "Status" },
  ]);

  return csvResponse(csv, `invoices-${new Date().toISOString().slice(0, 10)}.csv`);
}
