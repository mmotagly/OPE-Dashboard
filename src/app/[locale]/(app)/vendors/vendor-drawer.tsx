import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { CsvImportForm } from "@/components/ui/csv-import-form";
import { money } from "@/lib/format";
import {
  EMPTY_VENDOR_FORM,
  loadVendor,
  loadVendorOptions,
  toVendorFormValues,
} from "./queries";
import { VendorForm } from "./vendor-form";
import { confirmImportVendors, previewImportVendors } from "./actions";

export async function VendorDrawer({
  mode,
  id,
  closeHref,
  canEdit,
}: {
  mode: "view" | "new" | "edit" | "import";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");
  const tFinance = await getTranslations("finance");

  if (mode === "import") {
    return (
      <Drawer
        code={`${tCommon("importCsv")} · ${t("vendorsTitle")}`}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <div className="p-4">
          <CsvImportForm
            previewAction={previewImportVendors}
            confirmAction={confirmImportVendors}
            templateHref="/api/import-template/vendors"
            extraColumns={[
              { key: "vendor_name", header: t("field.vendorName") },
              { key: "vendor_type_code", header: t("field.vendorType") },
            ]}
          />
        </div>
      </Drawer>
    );
  }

  if (mode === "new" || mode === "edit") {
    const [options, vendor] = await Promise.all([
      loadVendorOptions(),
      mode === "edit" && id ? loadVendor(id) : null,
    ]);

    if (mode === "edit" && !vendor) {
      return (
        <Drawer code={t("editVendor")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={vendor ? `${t("editVendor")} · ${vendor.vendorCode}` : t("newVendor")}
        sub={vendor?.vendorName}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <VendorForm
          mode={vendor ? "edit" : "create"}
          vendorId={vendor?.id}
          options={options}
          initial={vendor ? toVendorFormValues(vendor) : EMPTY_VENDOR_FORM}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  const vendor = id ? await loadVendor(id) : null;

  if (!vendor) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const basisLabel =
    vendor.billingBasis === "per_bus_day"
      ? t("basisPerBusDay")
      : vendor.billingBasis === "per_avg_bus_month"
        ? t("basisPerAvgBusMonth")
        : null;

  // The formula in words, so the terms read without opening an invoice.
  const formula =
    vendor.billingBasis === "per_avg_bus_month"
      ? tFinance("formulaOwned")
      : vendor.billingBasis === "per_bus_day"
        ? tFinance("formulaRental")
        : null;

  return (
    <Drawer
      code={vendor.vendorCode}
      sub={vendor.vendorName}
      pill={
        <>
          {vendor.isCompany && <Pill tone="ghost">{t("companyVendor")}</Pill>}
          {vendor.statusLabel && (
            <Pill tone={vendor.statusCode === "active" ? "go" : "idle"}>
              {vendor.statusLabel}
            </Pill>
          )}
        </>
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{ pathname: "/vendors", query: { mode: "edit", id: vendor.id } }}
            className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={t("billingTerms")}>
        {formula ? (
          <p className="mb-3 rounded-[9px] border border-hairline bg-raise px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
            {formula}
          </p>
        ) : (
          <p className="mb-3 text-[13px] text-ink-3">{t("noBillingTermsHint")}</p>
        )}

        <KeyValue>
          <Row label={tFinance("basis")}>{basisLabel ?? "—"}</Row>
          <Row
            label={
              vendor.billingBasis === "per_avg_bus_month"
                ? tFinance("ratePerBus")
                : t("field.rateAmount")
            }
          >
            {vendor.rateAmount === null ? "—" : money(vendor.rateAmount, vendor.currency)}
          </Row>
          <Row label={t("field.applyKpi")}>
            {vendor.applyKpi ? (
              <Micro tone="go">{t("kpiApplies")}</Micro>
            ) : (
              <span className="text-ink-2">{t("kpiDoesNotApply")}</span>
            )}
          </Row>
          <Row label={t("field.currency")} muted>
            <span dir="ltr">{vendor.currency}</span>
          </Row>
        </KeyValue>

        {vendor.billingNotes && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            {vendor.billingNotes}
          </p>
        )}
      </Section>

      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.vendorName")}>{vendor.vendorName}</Row>
          <Row label={t("field.vendorType")} muted>
            {vendor.vendorTypeLabel ?? "—"}
          </Row>
          <Row label={t("field.contactPerson")} muted>
            {vendor.contactPerson ?? "—"}
          </Row>
          <Row label={t("field.mobile")} muted>
            {vendor.mobileNumber ? (
              <span className="tnum" dir="ltr">
                {vendor.mobileNumber}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.email")} muted>
            {vendor.emailAddress ? <span dir="ltr">{vendor.emailAddress}</span> : "—"}
          </Row>
        </KeyValue>
      </Section>
    </Drawer>
  );
}
