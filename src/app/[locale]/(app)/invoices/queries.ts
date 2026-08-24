import { createClient } from "@/lib/supabase/server";
import { loadLookups, lookupLabel, type LookupOption } from "@/lib/lookups";

/**
 * Read side of invoicing. Every figure on an invoice was written by
 * fn_generate_invoice; nothing here recalculates any of it.
 *
 * Bus counts come from `v_vendor_monthly_bus_counts`, derived from actual
 * operations, and are never hand-entered. Invoicing is per shift as of
 * migration 0014 — one legacy row predates that and has a null
 * `shiftTypeId`, shown as a dash rather than treated as an error.
 */

export type InvoiceStatus = "draft" | "submitted" | "approved" | "paid";

export type InvoiceRow = {
  id: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  periodMonth: string;
  shiftTypeId: string | null;
  shiftLabel: string | null;
  billingBasis: string | null;
  rateAmount: number | null;
  busQuantity: number | null;
  grossAmount: number | null;
  achievedPct: number | null;
  netAmount: number | null;
  currency: string;
  status: InvoiceStatus;
  notes: string | null;
  scorecardId: string | null;
};

/** The operational inputs behind the invoice, so a figure can be traced. */
export type BusCounts = {
  busDays: number | null;
  operatingDays: number | null;
  avgDailyBuses: number | null;
};

export type InvoiceVendor = {
  id: string;
  vendorCode: string;
  vendorName: string;
  billingBasis: string | null;
  applyKpi: boolean;
};

const SELECT = `
  id,
  vendor_id,
  period_month,
  shift_type_id,
  scorecard_id,
  billing_basis,
  rate_amount,
  bus_quantity,
  gross_amount,
  achieved_pct,
  net_amount,
  currency,
  status,
  notes,
  vendors ( vendor_code, vendor_name )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

function toRow(i: any, shifts: LookupOption[]): InvoiceRow {
  const vendor = one<any>(i.vendors);
  return {
    id: i.id,
    vendorId: i.vendor_id,
    vendorCode: vendor?.vendor_code ?? "—",
    vendorName: vendor?.vendor_name ?? "—",
    periodMonth: i.period_month,
    shiftTypeId: i.shift_type_id,
    shiftLabel: lookupLabel(shifts, i.shift_type_id),
    billingBasis: i.billing_basis,
    rateAmount: i.rate_amount,
    busQuantity: i.bus_quantity,
    grossAmount: i.gross_amount,
    achievedPct: i.achieved_pct,
    netAmount: i.net_amount,
    currency: i.currency,
    status: i.status,
    notes: i.notes,
    scorecardId: i.scorecard_id,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadInvoices(): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const [shifts, { data }] = await Promise.all([
    loadLookups("shift_type"),
    supabase.from("vendor_invoices").select(SELECT).order("period_month", { ascending: false }).limit(200),
  ]);

  return (data ?? []).map((i) => toRow(i, shifts));
}

export async function loadInvoice(id: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  const [shifts, { data }] = await Promise.all([
    loadLookups("shift_type"),
    supabase.from("vendor_invoices").select(SELECT).eq("id", id).maybeSingle(),
  ]);

  return data ? toRow(data, shifts) : null;
}

/** The month's operational counts, exactly as the invoice function saw them. */
/**
 * The view is now one row per (vendor, month, shift). `shiftTypeId` is null
 * only for the one legacy whole-month invoice that predates migration 0014 —
 * there's nothing to look up for it, so this returns null rather than
 * guessing which shift(s) fed it.
 */
export async function loadBusCounts(
  vendorId: string,
  periodMonth: string,
  shiftTypeId: string | null,
): Promise<BusCounts | null> {
  if (shiftTypeId === null) return null;

  const supabase = await createClient();
  // shift_type_id is a real column on the view (migration 0014) but the
  // checked-in generated types predate it — same staleness workaround as
  // fn_generate_invoice's call above.
  const { data } = await supabase
    .from("v_vendor_monthly_bus_counts")
    .select("bus_days, operating_days, avg_daily_buses")
    .eq("vendor_id", vendorId)
    .eq("period_month", periodMonth)
    .eq("shift_type_id" as "vendor_id", shiftTypeId)
    .maybeSingle();

  if (!data) return null;
  return {
    busDays: data.bus_days,
    operatingDays: data.operating_days,
    avgDailyBuses: data.avg_daily_buses,
  };
}

export async function loadShiftOptions(): Promise<LookupOption[]> {
  return loadLookups("shift_type");
}

export async function loadInvoiceVendors(): Promise<InvoiceVendor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, vendor_code, vendor_name, billing_basis, apply_kpi")
    .order("vendor_code");

  return (data ?? []).map((v) => ({
    id: v.id,
    vendorCode: v.vendor_code,
    vendorName: v.vendor_name,
    billingBasis: v.billing_basis,
    applyKpi: v.apply_kpi,
  }));
}
