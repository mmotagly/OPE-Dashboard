"use client";

import type { QueryParams } from "@/lib/filters";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormActions,
  NumberInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { VehiclePicker } from "@/components/ui/vehicle-picker";
import { statusLabel } from "@/lib/format";
import { createOperation, updateOperation } from "./actions";
import { EMPTY_FORM_STATE } from "./schema";
import type {
  DriverOption,
  OperationFormValues,
  PickerOptions,
  VehicleOption,
} from "./queries";

/**
 * Create / edit form. Controlled rather than uncontrolled: React resets a form
 * once its action settles, and the entered values have to survive a rejected
 * submit — plus picking a vehicle rewrites two other fields.
 */
export function OperationForm({
  mode,
  operationId,
  options,
  initial,
  backTo,
  isSuperAdmin,
}: {
  mode: "create" | "edit";
  operationId?: string;
  options: PickerOptions;
  initial: OperationFormValues;
  /** Query to return to when the form is cancelled. Already free of blanks. */
  backTo: QueryParams;
  /** Completed is terminal for everyone else — trg_operation_status_locked
   * (0012) is the real gate; this only disables the control to match. */
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("operations");
  const tShift = useTranslations("shift");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && operationId
      ? updateOperation.bind(null, operationId)
      : createOperation;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState<OperationFormValues>(initial);

  const set = <K extends keyof OperationFormValues>(
    key: K,
    value: OperationFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  /**
   * Choosing a vehicle re-seeds starting KM from vehicles.current_odometer_km
   * and the driver from default_driver_id. Both stay editable afterwards.
   */
  const onVehicle = (vehicle: VehicleOption) =>
    setValues((v) => ({
      ...v,
      vehicleId: vehicle.id,
      startingKm:
        vehicle.currentOdometerKm === null ? "" : String(vehicle.currentOdometerKm),
      driverId: vehicle.defaultDriverId ?? "",
    }));

  const selectedVehicle =
    options.vehicles.find((v) => v.id === values.vehicleId) ?? null;

  const statusCode = options.statuses.find((s) => s.id === values.statusId)?.code ?? "";
  /** Mirrors fn_validate_operation_status (0009/0010) exactly: only these two
   * statuses carry a driver/KM record; only Completed carries an end reading. */
  const needsRunFields = statusCode === "operating" || statusCode === "completed";
  const needsEndKm = statusCode === "completed";
  const isLockedCompleted = mode === "edit" && statusCode === "completed" && !isSuperAdmin;

  const startKmIsPrefill =
    selectedVehicle !== null &&
    selectedVehicle.currentOdometerKm !== null &&
    values.startingKm === String(selectedVehicle.currentOdometerKm);

  const driverIsDefault =
    selectedVehicle !== null &&
    selectedVehicle.defaultDriverId !== null &&
    values.driverId === selectedVehicle.defaultDriverId;

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  const driverLabel = (d: DriverOption) => `${d.driverCode} · ${d.driverName}`;

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.date")} htmlFor="operationDate" error={err("operationDate")}>
          <TextInput
            id="operationDate"
            name="operationDate"
            type="date"
            required
            value={values.operationDate}
            onChange={(e) => set("operationDate", e.target.value)}
          />
        </Field>

        <Field label={t("field.shift")} htmlFor="shiftTypeId" error={err("shiftTypeId")}>
          <SelectInput
            id="shiftTypeId"
            name="shiftTypeId"
            required
            value={values.shiftTypeId}
            onChange={(e) => set("shiftTypeId", e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {options.shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {tShift.has(s.code) ? tShift(s.code) : s.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <VehiclePicker
        vehicles={options.vehicles}
        value={values.vehicleId}
        onChange={onVehicle}
        error={err("vehicleId")}
        labels={{
          field: t("field.vehicle"),
          search: t("searchVehicles"),
          noMatch: t("noVehicleMatch"),
          odometer: (formatted) => t("odometerNow", { km: formatted }),
        }}
      />

      <Field
        label={t("field.status")}
        htmlFor="statusId"
        error={err("statusId")}
        source={isLockedCompleted ? t("statusLocked") : undefined}
      >
        <SelectInput
          id="statusId"
          name="statusId"
          required
          disabled={isLockedCompleted}
          value={values.statusId}
          onChange={(e) => set("statusId", e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {options.statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {statusLabel(tStatus, s)}
            </option>
          ))}
        </SelectInput>
        {isLockedCompleted && <input type="hidden" name="statusId" value={values.statusId} />}
      </Field>

      {needsRunFields && (
        <Field
          label={t("field.driver")}
          htmlFor="driverId"
          error={err("driverId")}
          source={driverIsDefault ? t("source.driver") : undefined}
        >
          <SelectInput
            id="driverId"
            name="driverId"
            required
            value={values.driverId}
            onChange={(e) => set("driverId", e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {options.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {driverLabel(d)}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <Field label={t("field.route")} htmlFor="routeId" error={err("routeId")}>
        <SelectInput
          id="routeId"
          name="routeId"
          value={values.routeId}
          onChange={(e) => set("routeId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.routeCode} · {r.routeName}
            </option>
          ))}
        </SelectInput>
      </Field>

      {needsRunFields && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("field.startingKm")}
            htmlFor="startingKm"
            error={err("startingKm")}
            source={startKmIsPrefill ? t("source.odometer") : undefined}
          >
            <NumberInput
              id="startingKm"
              name="startingKm"
              required
              min={0}
              step="0.01"
              value={values.startingKm}
              onChange={(e) => set("startingKm", e.target.value)}
            />
          </Field>

          {needsEndKm && (
            <Field label={t("field.endingKm")} htmlFor="endingKm" error={err("endingKm")}>
              <NumberInput
                id="endingKm"
                name="endingKm"
                required
                min={0}
                step="0.01"
                value={values.endingKm}
                onChange={(e) => set("endingKm", e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      {needsRunFields && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("field.startingBattery")}
            htmlFor="startingBatteryPct"
            error={err("startingBatteryPct")}
          >
            <NumberInput
              id="startingBatteryPct"
              name="startingBatteryPct"
              required
              min={0}
              max={100}
              step="0.1"
              value={values.startingBatteryPct}
              onChange={(e) => set("startingBatteryPct", e.target.value)}
            />
          </Field>

          {needsEndKm && (
            <Field
              label={t("field.endingBattery")}
              htmlFor="endingBatteryPct"
              error={err("endingBatteryPct")}
            >
              <NumberInput
                id="endingBatteryPct"
                name="endingBatteryPct"
                required
                min={0}
                max={100}
                step="0.1"
                value={values.endingBatteryPct}
                onChange={(e) => set("endingBatteryPct", e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {needsRunFields && (
          <Field
            label={t("field.operatingPct")}
            htmlFor="operatingPct"
            error={err("operatingPct")}
          >
            <NumberInput
              id="operatingPct"
              name="operatingPct"
              required={needsEndKm}
              min={0}
              max={100}
              step="0.1"
              value={values.operatingPct}
              onChange={(e) => set("operatingPct", e.target.value)}
            />
          </Field>
        )}

        <Field
          label={t("field.driverTips")}
          htmlFor="driverTips"
          error={err("driverTips")}
        >
          <NumberInput
            id="driverTips"
            name="driverTips"
            min={0}
            step="0.01"
            value={values.driverTips}
            onChange={(e) => set("driverTips", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("field.remarks")} htmlFor="remarks" error={err("remarks")}>
        <TextArea
          id="remarks"
          name="remarks"
          rows={3}
          value={values.remarks}
          onChange={(e) => set("remarks", e.target.value)}
        />
      </Field>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/operations", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
