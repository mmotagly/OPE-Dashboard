import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { CsvImportForm } from "@/components/ui/csv-import-form";
import { expiryState, expiryTone, type ExpiryState } from "@/lib/format";
import {
  EMPTY_DRIVER_FORM,
  loadDriver,
  loadDriverOptions,
  toDriverFormValues,
  type DriverRow,
} from "./queries";
import { DriverForm } from "./driver-form";
import { confirmImportDrivers, previewImportDrivers } from "./actions";

/**
 * View-mode body, factored out so `/drivers/[id]` (reached by clicking a
 * driver's code, as opposed to elsewhere in the row) can render the exact
 * same content as the Drawer without duplicating it. See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export async function DriverDetailBody({ driver }: { driver: DriverRow }) {
  const t = await getTranslations("master");

  const licence = expiryState(driver.licenseExpiryDate);
  const tourism = driver.hasTourismId
    ? expiryState(driver.tourismIdExpiryDate)
    : "unknown";

  const expiryValue = (
    date: string | null,
    state: ExpiryState,
    expired: string,
    expiring: string,
  ) =>
    date ? (
      <span className="flex items-center justify-end gap-2">
        <span className="tnum">{date}</span>
        {(state === "expired" || state === "expiring") && (
          <Micro tone={expiryTone(state)}>
            {state === "expired" ? expired : expiring}
          </Micro>
        )}
      </span>
    ) : (
      "—"
    );

  return (
    <>
      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.driverName")}>{driver.driverName}</Row>
          <Row label={t("field.vendor")} muted>
            {driver.vendorName ?? t("companyDriver")}
          </Row>
          <Row label={t("field.mobile")} muted>
            {driver.mobileNumber ? (
              <span className="tnum" dir="ltr">
                {driver.mobileNumber}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.hiringDate")} muted>
            {driver.hiringDate ? <span className="tnum">{driver.hiringDate}</span> : "—"}
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("licence")}>
        <KeyValue>
          <Row label={t("field.licenseNumber")}>
            {driver.licenseNumber ? (
              <span className="tnum">{driver.licenseNumber}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.licenseGrade")} muted>
            {driver.licenseGradeLabel ?? "—"}
          </Row>
          <Row label={t("field.licenseExpiry")}>
            {expiryValue(
              driver.licenseExpiryDate,
              licence,
              t("licenceExpired"),
              t("licenceExpiring"),
            )}
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("tourismId")}>
        {driver.hasTourismId ? (
          <KeyValue>
            <Row label={t("field.tourismIssuer")} muted>
              {driver.tourismIdIssuingCompany ?? "—"}
            </Row>
            <Row label={t("field.tourismExpiry")}>
              {expiryValue(
                driver.tourismIdExpiryDate,
                tourism,
                t("tourismExpired"),
                t("tourismExpiring"),
              )}
            </Row>
          </KeyValue>
        ) : (
          <p className="text-[13px] text-ink-3">{t("noTourismId")}</p>
        )}
      </Section>
    </>
  );
}

export async function DriverDrawer({
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

  if (mode === "import") {
    return (
      <Drawer
        code={`${tCommon("importCsv")} · ${t("driversTitle")}`}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <div className="p-4">
          <CsvImportForm
            previewAction={previewImportDrivers}
            confirmAction={confirmImportDrivers}
            templateHref="/api/import-template/drivers"
            extraColumns={[
              { key: "driver_name", header: t("field.driverName") },
              { key: "vendor_code", header: t("field.vendor") },
            ]}
          />
        </div>
      </Drawer>
    );
  }

  if (mode === "new" || mode === "edit") {
    const [options, driver] = await Promise.all([
      loadDriverOptions(),
      mode === "edit" && id ? loadDriver(id) : null,
    ]);

    if (mode === "edit" && !driver) {
      return (
        <Drawer code={t("editDriver")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={driver ? `${t("editDriver")} · ${driver.driverCode}` : t("newDriver")}
        sub={driver?.driverName}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <DriverForm
          mode={driver ? "edit" : "create"}
          driverId={driver?.id}
          options={options}
          initial={driver ? toDriverFormValues(driver) : EMPTY_DRIVER_FORM}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  const driver = id ? await loadDriver(id) : null;

  if (!driver) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  return (
    <Drawer
      code={driver.driverCode}
      sub={`${driver.driverName} · ${driver.vendorName ?? t("companyDriver")}`}
      pill={
        driver.statusLabel ? (
          <Pill tone={driver.statusCode === "active" ? "go" : "idle"}>
            {driver.statusLabel}
          </Pill>
        ) : undefined
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{ pathname: "/drivers", query: { mode: "edit", id: driver.id } }}
            className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <DriverDetailBody driver={driver} />
    </Drawer>
  );
}
