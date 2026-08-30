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
  TextInput,
} from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { km } from "@/lib/format";
import { createVehicle, updateVehicle } from "./actions";
import type { VehicleFormValues, VehicleOptions } from "./queries";

export function VehicleForm({
  mode,
  vehicleId,
  options,
  initial,
  backTo,
  /** Read-only, trigger-maintained. Shown so the number is visible while editing. */
  odometer,
}: {
  mode: "create" | "edit";
  vehicleId?: string;
  options: VehicleOptions;
  initial: VehicleFormValues;
  backTo: QueryParams;
  odometer?: { km: number | null; date: string | null };
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");
  const tVehicle = useTranslations("vehicle");

  const action =
    mode === "edit" && vehicleId
      ? updateVehicle.bind(null, vehicleId)
      : createVehicle;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof VehicleFormValues>(key: K, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

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
        <Field label={t("field.vehicleCode")} htmlFor="vehicleCode" error={err("vehicleCode")}>
          <TextInput
            id="vehicleCode"
            name="vehicleCode"
            required
            value={values.vehicleCode}
            onChange={(e) => set("vehicleCode", e.target.value)}
          />
        </Field>

        <Field label={t("field.plateNumber")} htmlFor="plateNumber" error={err("plateNumber")}>
          <TextInput
            id="plateNumber"
            name="plateNumber"
            required
            value={values.plateNumber}
            onChange={(e) => set("plateNumber", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={tVehicle("vendor")}
        htmlFor="vendorId"
        error={err("vendorId")}
        hint={<Micro bar={false}>{t("vendorRequired")}</Micro>}
      >
        <SelectInput
          id="vendorId"
          name="vendorId"
          required
          value={values.vendorId}
          onChange={(e) => set("vendorId", e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {options.vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vendorCode} · {v.vendorName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tVehicle("type")} htmlFor="vehicleTypeId" error={err("vehicleTypeId")}>
          <SelectInput
            id="vehicleTypeId"
            name="vehicleTypeId"
            value={values.vehicleTypeId}
            onChange={(e) => set("vehicleTypeId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.vehicleTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label={t("field.fuelType")} htmlFor="fuelTypeId" error={err("fuelTypeId")}>
          <SelectInput
            id="fuelTypeId"
            name="fuelTypeId"
            value={values.fuelTypeId}
            onChange={(e) => set("fuelTypeId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.fuelTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.batteryCapacity")}
          htmlFor="batteryCapacityKwh"
          error={err("batteryCapacityKwh")}
        >
          <NumberInput
            id="batteryCapacityKwh"
            name="batteryCapacityKwh"
            min={0}
            step="0.01"
            value={values.batteryCapacityKwh}
            onChange={(e) => set("batteryCapacityKwh", e.target.value)}
          />
        </Field>

        <Field
          label={tVehicle("licenseExpiry")}
          htmlFor="licenseExpiryDate"
          error={err("licenseExpiryDate")}
        >
          <TextInput
            id="licenseExpiryDate"
            name="licenseExpiryDate"
            type="date"
            value={values.licenseExpiryDate}
            onChange={(e) => set("licenseExpiryDate", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={t("field.defaultDriver")}
        htmlFor="defaultDriverId"
        error={err("defaultDriverId")}
        source={t("defaultDriverHint")}
      >
        <SelectInput
          id="defaultDriverId"
          name="defaultDriverId"
          value={values.defaultDriverId}
          onChange={(e) => set("defaultDriverId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.driverCode} · {d.driverName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t("field.status")} htmlFor="statusId" error={err("statusId")}>
        <SelectInput
          id="statusId"
          name="statusId"
          value={values.statusId}
          onChange={(e) => set("statusId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.statuses.map((o) => (
            <option key={o.id} value={o.id}>
              {o.labelEn}
            </option>
          ))}
        </SelectInput>
      </Field>

      {odometer && (
        <div className="rounded-control border border-hairline bg-canvas px-3 py-2.5">
          <p className="text-[12.5px] text-ink-2">
            {tVehicle("odometer")}{" "}
            <span className="tnum font-medium text-ink">{km(odometer.km)}</span>
            {odometer.date && (
              <span className="tnum ms-1.5 text-ink-3">· {odometer.date}</span>
            )}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-3">{t("odometerReadOnly")}</p>
        </div>
      )}

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/vehicles", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
