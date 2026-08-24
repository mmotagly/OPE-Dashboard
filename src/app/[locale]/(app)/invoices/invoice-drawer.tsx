import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { money, percent } from "@/lib/format";
import { loadBusCounts, loadInvoice, type InvoiceStatus } from "./queries";
import { InvoiceStatusActions } from "./invoice-status";

const STATUS_TONE: Record<InvoiceStatus, "go" | "warn" | "stop" | "idle"> = {
  paid: "go",
  approved: "go",
  submitted: "warn",
  draft: "idle",
};

/**
 * Everything that fed the number, so a disputed figure can be traced without
 * opening the database: the formula in words, the rate and quantity it used,
 * the operational counts behind the quantity, and the scorecard behind the
 * percentage.
 */
export async function InvoiceDrawer({
  id,
  closeHref,
  canEdit,
}: {
  id: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("invoice");
  const tCommon = await getTranslations("common");
  const tFinance = await getTranslations("finance");

  const invoice = await loadInvoice(id);

  if (!invoice) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const counts = await loadBusCounts(
    invoice.vendorId,
    invoice.periodMonth,
    invoice.shiftTypeId,
  );

  const perBusDay = invoice.billingBasis === "per_bus_day";
  const formula = perBusDay ? tFinance("formulaRental") : tFinance("formulaOwned");

  const basisLabel = perBusDay ? t("basisPerBusDay") : t("basisPerAvgBusMonth");

  return (
    <Drawer
      code={invoice.vendorCode}
      sub={`${invoice.vendorName} · ${invoice.periodMonth.slice(0, 7)}${
        invoice.shiftLabel ? ` · ${invoice.shiftLabel}` : ""
      }`}
      pill={<Pill tone={STATUS_TONE[invoice.status]}>{t(`status.${invoice.status}`)}</Pill>}
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />
        ) : undefined
      }
    >
      <Section title={t("netPayable")}>
        <div className="tnum text-2xl font-semibold tracking-[-0.02em]">
          {invoice.netAmount === null ? "—" : money(invoice.netAmount, invoice.currency)}
        </div>
        <p className="mt-2 rounded-[9px] border border-hairline bg-raise px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
          {formula}
        </p>
      </Section>

      <Section title={t("inputs")}>
        <KeyValue>
          <Row label={t("field.shift")}>{invoice.shiftLabel ?? "—"}</Row>
          <Row label={t("field.basis")}>{basisLabel}</Row>
          <Row label={perBusDay ? t("field.rate") : tFinance("ratePerBus")}>
            {invoice.rateAmount === null
              ? "—"
              : money(invoice.rateAmount, invoice.currency)}
          </Row>
          <Row label={perBusDay ? tFinance("busDays") : tFinance("avgBuses")}>
            {invoice.busQuantity === null ? (
              "—"
            ) : (
              <span className="tnum">{invoice.busQuantity}</span>
            )}
          </Row>
          <Row label={t("field.gross")}>
            {invoice.grossAmount === null
              ? "—"
              : money(invoice.grossAmount, invoice.currency)}
          </Row>
          <Row label={t("field.achievedPct")}>
            {invoice.achievedPct === null ? (
              <span className="text-ink-2">{t("noKpi")}</span>
            ) : (
              percent(invoice.achievedPct)
            )}
          </Row>
          <Row label={t("field.net")}>
            {invoice.netAmount === null ? "—" : money(invoice.netAmount, invoice.currency)}
          </Row>
          <Row label={t("field.currency")} muted>
            <span dir="ltr">{invoice.currency}</span>
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("busCounts")}>
        {/* From v_vendor_monthly_bus_counts — derived from operations, never typed in. */}
        <p className="mb-3 text-[12.5px] text-ink-3">{t("busCountsNote")}</p>
        {counts ? (
          <KeyValue>
            <Row label={tFinance("busDays")}>
              <span className="tnum">{counts.busDays ?? "—"}</span>
            </Row>
            <Row label={t("field.operatingDays")} muted>
              <span className="tnum">{counts.operatingDays ?? "—"}</span>
            </Row>
            <Row label={tFinance("avgBuses")} muted>
              <span className="tnum">{counts.avgDailyBuses ?? "—"}</span>
            </Row>
          </KeyValue>
        ) : (
          <p className="text-[13px] text-ink-3">{t("noBusCounts")}</p>
        )}
      </Section>

      <Section title={t("scorecard")}>
        {invoice.scorecardId ? (
          <Link
            href={{ pathname: "/scorecards", query: { id: invoice.scorecardId } }}
            className="text-[13.5px] font-medium text-ink hover:underline"
          >
            {t("openScorecard")}
          </Link>
        ) : (
          <p className="text-[13px] text-ink-3">{t("noScorecardLinked")}</p>
        )}
      </Section>

      {invoice.notes && (
        <Section title={t("field.notes")}>
          <p className="text-[13px] leading-relaxed text-ink-2">{invoice.notes}</p>
        </Section>
      )}
    </Drawer>
  );
}
