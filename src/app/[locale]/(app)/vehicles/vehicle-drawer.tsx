import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { KmMeter } from "@/components/ui/km-meter";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { expiryState, expiryTone, km, pmTone, type PmStatus } from "@/lib/format";
import {
  EMPTY_VEHICLE_FORM,
  loadLatestOperation,
  loadPmSchedule,
  loadVehicle,
  loadVehicleOptions,
  toVehicleFormValues,
} from "./queries";
import { VehicleForm } from "./vehicle-form";
import { BuildPmSchedule } from "./build-pm-schedule";

const PM_STATUS_KEY: Record<string, string> = {
  overdue: "overdue",
  due_now: "dueNow",
  due_soon: "dueSoon",
  never_serviced: "neverServiced",
  no_km_data: "noKmData",
  ok: "ok",
};

const barTone = (status: PmStatus | null) => {
  const tone = status ? pmTone(status) : null;
  return tone === "stop" ? "stop" : tone === "warn" ? "warn" : "neutral";
};

const microTone = (status: PmStatus): "neutral" | "go" | "warn" | "stop" => {
  const tone = pmTone(status);
  return tone === "idle" ? "neutral" : tone;
};

/**
 * The vehicle drawer. Periodic maintenance opens this same drawer, which is why
 * the whole schedule lives here rather than on the PM page.
 */
export async function VehicleDrawer({
  mode,
  id,
  closeHref,
  canEdit,
}: {
  mode: "view" | "new" | "edit";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");
  const tVehicle = await getTranslations("vehicle");
  const tStatus = await getTranslations("status");

  if (mode === "new" || mode === "edit") {
    const [options, vehicle] = await Promise.all([
      loadVehicleOptions(),
      mode === "edit" && id ? loadVehicle(id) : null,
    ]);

    if (mode === "edit" && !vehicle) {
      return (
        <Drawer code={t("editVehicle")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={vehicle ? `${t("editVehicle")} · ${vehicle.vehicleCode}` : t("newVehicle")}
        sub={vehicle?.plateNumber}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <VehicleForm
          mode={vehicle ? "edit" : "create"}
          vehicleId={vehicle?.id}
          options={options}
          initial={vehicle ? toVehicleFormValues(vehicle) : EMPTY_VEHICLE_FORM}
          backTo={closeHref.query}
          odometer={
            vehicle
              ? { km: vehicle.currentOdometerKm, date: vehicle.currentOdometerDate }
              : undefined
          }
        />
      </Drawer>
    );
  }

  const vehicle = id ? await loadVehicle(id) : null;

  if (!vehicle) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const [schedule, latest] = await Promise.all([
    loadPmSchedule(vehicle.id),
    loadLatestOperation(vehicle.id),
  ]);

  const nearest = schedule[0] ?? null;
  const licence = expiryState(vehicle.licenseExpiryDate);

  const statusText = (status: PmStatus) => {
    const key = PM_STATUS_KEY[status] ?? status;
    return tStatus.has(key) ? tStatus(key) : status;
  };

  return (
    <Drawer
      code={vehicle.vehicleCode}
      sub={`${vehicle.plateNumber}${vehicle.vendorName ? ` · ${vehicle.vendorName}` : ""}`}
      pill={
        vehicle.statusLabel ? (
          <Pill tone={vehicle.statusCode === "active" ? "go" : "idle"}>
            {vehicle.statusLabel}
          </Pill>
        ) : undefined
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{
              pathname: "/vehicles",
              query: { mode: "edit", id: vehicle.id },
            }}
            className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={tVehicle("odometer")}>
        <KmMeter
          startKm={latest?.startKm ?? vehicle.currentOdometerKm}
          endKm={latest?.endKm ?? null}
          large
          pmProgress={
            nearest &&
            nearest.intervalKm !== null &&
            nearest.intervalKm > 0 &&
            nearest.kmRemaining !== null
              ? ((nearest.intervalKm - nearest.kmRemaining) / nearest.intervalKm) * 100
              : null
          }
          pmTone={barTone(nearest?.status ?? null)}
          pmLabel={
            nearest
              ? t("pmLabel", { part: nearest.partName, km: km(nearest.kmRemaining) })
              : undefined
          }
          right={
            vehicle.currentOdometerDate
              ? t("odometerAsOf", { date: vehicle.currentOdometerDate })
              : undefined
          }
        />
        <p className="mt-2 text-[10.5px] text-ink-3">{t("odometerReadOnly")}</p>
      </Section>

      <Section title={t("record")}>
        <KeyValue>
          <Row label={tVehicle("vendor")}>{vehicle.vendorName ?? "—"}</Row>
          <Row label={tVehicle("type")} muted>
            {vehicle.vehicleTypeLabel ?? "—"}
          </Row>
          <Row label={t("field.fuelType")} muted>
            {vehicle.fuelTypeLabel ?? "—"}
          </Row>
          <Row label={t("field.batteryCapacity")}>
            {vehicle.batteryCapacityKwh === null ? (
              "—"
            ) : (
              <span className="tnum">{vehicle.batteryCapacityKwh} kWh</span>
            )}
          </Row>
          <Row label={tVehicle("licenseExpiry")}>
            {vehicle.licenseExpiryDate ? (
              <span className="flex items-center justify-end gap-2">
                <span className="tnum">{vehicle.licenseExpiryDate}</span>
                {licence !== "ok" && licence !== "unknown" && (
                  <Micro tone={expiryTone(licence)}>
                    {licence === "expired" ? t("licenceExpired") : t("licenceExpiring")}
                  </Micro>
                )}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.defaultDriver")} muted>
            {vehicle.defaultDriverName ?? tCommon("none")}
            {vehicle.defaultDriverCode && (
              <span className="ms-2 text-[12px] text-ink-3">
                {vehicle.defaultDriverCode}
              </span>
            )}
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("pmSchedule")}>
        {schedule.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-ink-3">{t("noPmSchedule")}</p>
            {canEdit && <BuildPmSchedule vehicleId={vehicle.id} />}
          </div>
        ) : (
          <ul className="grid gap-2">
            {/*
              Every part, sorted by km remaining. Overdue rows carry a negative
              number — the view reports the real figure and it is not clamped.
            */}
            {schedule.map((part) => (
              <li
                key={part.partName}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-[13.5px]">{part.partName}</span>
                <span
                  className={`ms-auto tnum text-[12.5px] ${
                    part.kmRemaining !== null && part.kmRemaining < 0
                      ? "text-stop-text"
                      : "text-ink-2"
                  }`}
                >
                  {part.kmRemaining === null
                    ? "—"
                    : t("kmRemaining", { km: km(part.kmRemaining) })}
                </span>
                <Micro tone={microTone(part.status)}>{statusText(part.status)}</Micro>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Drawer>
  );
}
