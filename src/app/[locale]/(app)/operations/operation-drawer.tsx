import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { KmMeter } from "@/components/ui/km-meter";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import {
  km,
  money,
  percent,
  pmBarTone,
  pmLabelTone,
  operationTone,
  statusLabel,
} from "@/lib/format";
import {
  loadNearestPm,
  loadOperation,
  loadPickerOptions,
  toFormValues,
  type ShiftOption,
} from "./queries";
import { OperationForm } from "./operation-form";
import { BulkPlanForm } from "./bulk-plan-form";

const PM_STATUS_KEY: Record<string, string> = {
  overdue: "overdue",
  due_now: "dueNow",
  due_soon: "dueSoon",
  never_serviced: "neverServiced",
  no_km_data: "noKmData",
  ok: "ok",
};

const actionLink =
  "rounded-[10px] border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise";

/**
 * The operations drawer: view, create and edit in the one overlay, chosen by
 * `?id=` / `?mode=`. Stays a Server Component.
 */
export async function OperationDrawer({
  mode,
  id,
  shifts,
  closeHref,
  canEdit,
  isSuperAdmin,
  filterDate,
  filterShift,
}: {
  mode: "view" | "new" | "edit" | "bulk";
  id?: string;
  shifts: ShiftOption[];
  closeHref: CloseHref;
  canEdit: boolean;
  isSuperAdmin: boolean;
  filterDate: string;
  filterShift: string;
}) {
  const t = await getTranslations("operations");
  const tCommon = await getTranslations("common");
  const tVehicle = await getTranslations("vehicle");
  const tShift = await getTranslations("shift");
  const tStatus = await getTranslations("status");

  const shiftLabel = (shiftId: string | null) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return null;
    return tShift.has(shift.code) ? tShift(shift.code) : shift.labelEn;
  };

  /* ---- bulk plan ---- */

  if (mode === "bulk") {
    const options = await loadPickerOptions();
    const today = new Date().toISOString().slice(0, 10);

    return (
      <Drawer
        code={t("bulkPlanTitle")}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <BulkPlanForm
          shifts={options.shifts}
          vehicles={options.vehicles}
          initialDate={filterDate || today}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  /* ---- create / edit ---- */

  if (mode === "new" || mode === "edit") {
    const [options, operation] = await Promise.all([
      loadPickerOptions(),
      mode === "edit" && id ? loadOperation(id) : null,
    ]);

    if (mode === "edit" && !operation) {
      return (
        <Drawer
          code={t("edit")}
          closeHref={closeHref}
          closeLabel={tCommon("cancel")}
        >
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const shiftFromFilter = shifts.find((s) => s.code === filterShift);
    // Operating is the historical default shape (start KM now, add an end KM
    // later) — status stays a real, changeable field, this just avoids an
    // extra click for the common case.
    const defaultStatusId = options.statuses.find((s) => s.code === "operating")?.id ?? "";

    return (
      <Drawer
        code={operation ? `${t("edit")} · ${operation.code}` : t("new")}
        sub={operation ? `${operation.vehicleCode} · ${operation.plate}` : undefined}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <OperationForm
          mode={operation ? "edit" : "create"}
          operationId={operation?.id}
          options={options}
          initial={
            operation
              ? toFormValues(operation)
              : {
                  operationDate: filterDate || today,
                  shiftTypeId: shiftFromFilter?.id ?? "",
                  vehicleId: "",
                  statusId: defaultStatusId,
                  driverId: "",
                  routeId: "",
                  startingKm: "",
                  endingKm: "",
                  operatingPct: "",
                  startingBatteryPct: "",
                  endingBatteryPct: "",
                  driverTips: "",
                  remarks: "",
                }
          }
          backTo={closeHref.query}
          isSuperAdmin={isSuperAdmin}
        />
      </Drawer>
    );
  }

  /* ---- view ---- */

  const operation = id ? await loadOperation(id) : null;

  if (!operation) {
    return (
      <Drawer
        code={t("noSelection")}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const status = operation.statusCode
    ? { code: operation.statusCode, labelEn: operation.statusLabel ?? operation.statusCode }
    : null;
  const pm = operation.vehicleId ? await loadNearestPm(operation.vehicleId) : null;
  const pmStatus = pm?.status ?? null;

  return (
    <Drawer
      code={operation.vehicleCode}
      sub={`${operation.plate} · ${operation.code}`}
      pill={
        status && (
          <Pill tone={operationTone(status.code)}>{statusLabel(tStatus, status)}</Pill>
        )
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{
              pathname: "/operations",
              query: { ...closeHref.query, mode: "edit", id: operation.id },
            }}
            className={`${actionLink} border-ink bg-ink text-on-ink hover:opacity-90`}
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={tVehicle("odometer")}>
        <KmMeter
          startKm={operation.startKm}
          endKm={operation.endKm}
          large
          pmProgress={
            pm && pm.intervalKm !== null && pm.intervalKm > 0 && pm.kmRemaining !== null
              ? ((pm.intervalKm - pm.kmRemaining) / pm.intervalKm) * 100
              : null
          }
          pmTone={pmBarTone(pmStatus)}
          pmLabel={
            pm ? t("pmLabel", { part: pm.partName, km: km(pm.kmRemaining) }) : undefined
          }
        />
        {pm && (
          <div className="mt-2.5">
            <Micro tone={pmLabelTone(pmStatus)}>
              {tStatus.has(PM_STATUS_KEY[pm.status] ?? pm.status)
                ? tStatus(PM_STATUS_KEY[pm.status] ?? pm.status)
                : pm.status}
            </Micro>
          </div>
        )}
      </Section>

      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.date")}>
            <span className="tnum">{operation.date}</span>
          </Row>
          <Row label={t("field.shift")}>{shiftLabel(operation.shiftId) ?? "—"}</Row>
          <Row label={tVehicle("vendor")} muted>
            {operation.vendorName ?? "—"}
          </Row>
          <Row label={t("field.driver")}>
            {operation.driverName ?? "—"}
            {operation.driverCode && (
              <span className="ms-2 text-[12px] text-ink-3">{operation.driverCode}</span>
            )}
          </Row>
          <Row label={t("field.route")} muted>
            {operation.routeName ?? tCommon("none")}
          </Row>
          <Row label={t("field.startingKm")}>
            <span className="tnum">{km(operation.startKm)}</span>
          </Row>
          <Row label={t("field.endingKm")}>
            {operation.statusCode === "operating" ? (
              <span className="text-warn-text">{tStatus("noEndKm")}</span>
            ) : (
              <span className="tnum">{km(operation.endKm)}</span>
            )}
          </Row>
          <Row label={t("field.distance")} muted>
            {operation.distanceKm === null ? (
              "—"
            ) : (
              <span className="tnum">{km(operation.distanceKm)} km</span>
            )}
          </Row>
          <Row label={t("field.battery")} muted>
            {operation.batteryStart !== null && operation.batteryEnd !== null
              ? t("batteryRange", {
                  from: operation.batteryStart,
                  to: operation.batteryEnd,
                })
              : "—"}
          </Row>
          <Row label={t("field.operatingPct")}>{percent(operation.operatingPct)}</Row>
          <Row label={t("field.driverTips")} muted>
            {money(operation.driverTips)}
          </Row>
        </KeyValue>
      </Section>

      {operation.remarks && (
        <Section title={t("field.remarks")}>
          <p className="text-[13px] leading-relaxed text-ink-2">{operation.remarks}</p>
        </Section>
      )}
    </Drawer>
  );
}
