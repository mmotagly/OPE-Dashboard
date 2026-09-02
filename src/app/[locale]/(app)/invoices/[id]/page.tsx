import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canSeeMoney, isSuper, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadBusCounts, loadInvoice, type InvoiceStatus } from "../queries";
import { InvoiceDetailBody } from "../invoice-drawer";
import { InvoiceStatusActions } from "../invoice-status";

const STATUS_TONE: Record<InvoiceStatus, "go" | "warn" | "stop" | "idle"> = {
  paid: "go",
  approved: "go",
  submitted: "warn",
  draft: "idle",
};

/**
 * Standalone full-page view — reached by clicking a row's vendor code in
 * the list, as opposed to clicking anywhere else in the row (which still
 * opens the overlay Drawer at /invoices?id=...). Same detail content
 * (InvoiceDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();
  const canEdit = isSuper(user.role);

  const t = await getTranslations("invoice");
  const tCommon = await getTranslations("common");

  const invoice = await loadInvoice(id);
  if (!invoice) notFound();

  const counts = await loadBusCounts(invoice.vendorId, invoice.periodMonth, invoice.shiftTypeId);

  return (
    <div className="font-inter contents">
      <DetailPage
        code={invoice.vendorCode}
        sub={`${invoice.vendorName} · ${invoice.periodMonth.slice(0, 7)}${
          invoice.shiftLabel ? ` · ${invoice.shiftLabel}` : ""
        }`}
        pill={<Pill tone={STATUS_TONE[invoice.status]}>{t(`status.${invoice.status}`)}</Pill>}
        backHref="/invoices"
        backLabel={t("title")}
        actions={
          <>
            <Link
              href={{ pathname: "/print/invoice", query: { id: invoice.id } }}
              target="_blank"
              className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise"
            >
              {tCommon("printPdf")}
            </Link>
            {canEdit && <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />}
          </>
        }
      >
        <InvoiceDetailBody invoice={invoice} counts={counts} />
      </DetailPage>
    </div>
  );
}
