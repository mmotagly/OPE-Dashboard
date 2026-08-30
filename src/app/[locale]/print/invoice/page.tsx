import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canSeeMoney, requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/ui/print-button";
import { money, percent } from "@/lib/format";
import { loadBusCounts, loadInvoice } from "@/app/[locale]/(app)/invoices/queries";

/**
 * Print/PDF view for one invoice (roadmap item 7) — deliberately outside
 * the (app) route group so it renders with no sidebar/topbar chrome, just
 * the document. Plain black-on-white styling rather than the app's
 * dark/light theme tokens: a printed page always needs to be legible on
 * paper regardless of the viewer's current theme, and "Save as PDF" is one
 * of every browser's native print destinations — this covers PDF export
 * without a server-side PDF-writing dependency.
 */
export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  const { id } = await searchParams;

  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();
  if (!id) notFound();

  const t = await getTranslations("invoice");
  const tCommon = await getTranslations("common");
  const invoice = await loadInvoice(id);
  if (!invoice) notFound();

  const counts = await loadBusCounts(invoice.vendorId, invoice.periodMonth, invoice.shiftTypeId);
  const perBusDay = invoice.billingBasis === "per_bus_day";

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 border-b border-gray-200 py-2 text-[13px]">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium tabular-nums text-black">{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-[720px] bg-white px-8 py-10 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <PrintButton label={tCommon("printPdf")} />
      </div>

      <header className="mb-8 border-b border-gray-300 pb-6">
        <div className="text-[11px] uppercase tracking-[0.08em] text-gray-500">
          Pyramids Ops — {t("title")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">
          {invoice.vendorName} ({invoice.vendorCode})
        </h1>
        <p className="mt-1 text-[13px] text-gray-600">
          {invoice.periodMonth.slice(0, 7)}
          {invoice.shiftLabel ? ` · ${invoice.shiftLabel}` : ""} · {invoice.status.toUpperCase()}
        </p>
      </header>

      <section className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
          {t("netPayable")}
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums">
          {invoice.netAmount === null ? "—" : money(invoice.netAmount, invoice.currency)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
          {t("inputs")}
        </h2>
        {row(t("field.basis"), perBusDay ? t("basisPerBusDay") : t("basisPerAvgBusMonth"))}
        {row(
          t("field.rate"),
          invoice.rateAmount === null ? "—" : money(invoice.rateAmount, invoice.currency),
        )}
        {row(
          t("field.gross"),
          invoice.grossAmount === null ? "—" : money(invoice.grossAmount, invoice.currency),
        )}
        {row(
          t("field.achievedPct"),
          invoice.achievedPct === null ? t("noKpi") : percent(invoice.achievedPct),
        )}
        {row(t("field.net"), invoice.netAmount === null ? "—" : money(invoice.netAmount, invoice.currency))}
        {row(t("field.currency"), invoice.currency)}
      </section>

      {counts && (
        <section className="mb-8">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
            {t("busCounts")}
          </h2>
          {row("Bus-days", String(counts.busDays ?? "—"))}
          {row(t("field.operatingDays"), String(counts.operatingDays ?? "—"))}
        </section>
      )}

      {invoice.notes && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
            {t("field.notes")}
          </h2>
          <p className="text-[13px] leading-relaxed text-gray-700">{invoice.notes}</p>
        </section>
      )}
    </div>
  );
}
