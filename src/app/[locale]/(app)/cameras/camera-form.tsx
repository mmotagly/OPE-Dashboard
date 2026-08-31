"use client";

import type { QueryParams } from "@/lib/filters";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Field, FormActions, NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { createCameraBridge, createCamera, updateCameraBridge, updateCamera } from "./actions";
import type {
  CameraBridgeFormValues,
  CameraFormValues,
  CameraOptions,
} from "./queries";

const cancelLink =
  "flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none";

const checkboxRow =
  "flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-3";
const checkboxInput = "h-4.5 w-4.5 accent-[var(--color-ink)]";

export function CameraBridgeForm({
  mode,
  bridgeId,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  bridgeId?: string;
  initial: CameraBridgeFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("cameras");
  const tCommon = useTranslations("common");

  const action = mode === "edit" && bridgeId ? updateCameraBridge.bind(null, bridgeId) : createCameraBridge;
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof CameraBridgeFormValues>(key: K, value: CameraBridgeFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p role="alert" className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}

      <Field label={t("field.bridgeCode")} htmlFor="bridgeCode" error={err("bridgeCode")}>
        <TextInput
          id="bridgeCode"
          name="bridgeCode"
          required
          value={values.bridgeCode}
          onChange={(e) => set("bridgeCode", e.target.value)}
        />
      </Field>

      <Field label={t("field.siteName")} htmlFor="siteName" error={err("siteName")}>
        <TextInput
          id="siteName"
          name="siteName"
          required
          value={values.siteName}
          onChange={(e) => set("siteName", e.target.value)}
        />
      </Field>

      <Field
        label={t("field.baseUrl")}
        htmlFor="baseUrl"
        error={err("baseUrl")}
        source={t("baseUrlHint")}
      >
        <TextInput
          id="baseUrl"
          name="baseUrl"
          dir="ltr"
          placeholder="https://bridge.example-vpn.internal:4100"
          value={values.baseUrl}
          onChange={(e) => set("baseUrl", e.target.value)}
        />
      </Field>

      <label className={checkboxRow}>
        <input
          type="checkbox"
          name="isActive"
          checked={values.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className={checkboxInput}
        />
        <span className="text-[13.5px]">{t("field.isActive")}</span>
      </label>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link href={{ pathname: "/cameras", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}

export function CameraForm({
  mode,
  cameraId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  cameraId?: string;
  options: CameraOptions;
  initial: CameraFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("cameras");
  const tCommon = useTranslations("common");

  const action = mode === "edit" && cameraId ? updateCamera.bind(null, cameraId) : createCamera;
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof CameraFormValues>(key: K, value: CameraFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p role="alert" className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.cameraCode")} htmlFor="cameraCode" error={err("cameraCode")}>
          <TextInput
            id="cameraCode"
            name="cameraCode"
            required
            value={values.cameraCode}
            onChange={(e) => set("cameraCode", e.target.value)}
          />
        </Field>

        <Field label={t("field.isapiChannel")} htmlFor="isapiChannel" error={err("isapiChannel")}>
          <NumberInput
            id="isapiChannel"
            name="isapiChannel"
            min={1}
            step="1"
            value={values.isapiChannel}
            onChange={(e) => set("isapiChannel", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("field.bridge")} htmlFor="bridgeId" error={err("bridgeId")}>
        <SelectInput
          id="bridgeId"
          name="bridgeId"
          value={values.bridgeId}
          onChange={(e) => set("bridgeId", e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {options.bridges.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bridgeCode} · {b.siteName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t("field.locationType")} htmlFor="locationType" error={err("locationType")}>
        <SelectInput
          id="locationType"
          name="locationType"
          value={values.locationType}
          onChange={(e) => set("locationType", e.target.value as "vehicle" | "station")}
        >
          <option value="vehicle">{t("locationVehicle")}</option>
          <option value="station">{t("locationStation")}</option>
        </SelectInput>
      </Field>

      {values.locationType === "vehicle" ? (
        <Field label={t("field.vehicle")} htmlFor="vehicleId" error={err("vehicleId")}>
          <SelectInput
            id="vehicleId"
            name="vehicleId"
            value={values.vehicleId}
            onChange={(e) => set("vehicleId", e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {options.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleCode}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : (
        <Field label={t("field.station")} htmlFor="stationId" error={err("stationId")}>
          <SelectInput
            id="stationId"
            name="stationId"
            value={values.stationId}
            onChange={(e) => set("stationId", e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {options.stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stationName}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <label className={checkboxRow}>
        <input
          type="checkbox"
          name="supportsLive"
          checked={values.supportsLive}
          onChange={(e) => set("supportsLive", e.target.checked)}
          className={checkboxInput}
        />
        <span className="text-[13.5px]">{t("field.supportsLive")}</span>
      </label>

      <label className={checkboxRow}>
        <input
          type="checkbox"
          name="supportsCounting"
          checked={values.supportsCounting}
          onChange={(e) => set("supportsCounting", e.target.checked)}
          className={checkboxInput}
        />
        <span className="text-[13.5px]">{t("field.supportsCounting")}</span>
      </label>

      <label className={checkboxRow}>
        <input
          type="checkbox"
          name="isActive"
          checked={values.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className={checkboxInput}
        />
        <span className="text-[13.5px]">{t("field.isActive")}</span>
      </label>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link href={{ pathname: "/cameras", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
