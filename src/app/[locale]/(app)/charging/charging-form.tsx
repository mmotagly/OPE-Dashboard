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
import { Micro } from "@/components/ui/micro";
import { VehiclePicker } from "@/components/ui/vehicle-picker";
import { useHydrated } from "@/components/ui/use-hydrated";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { toLocalInput } from "@/lib/format";
import { createChargingSession, updateChargingSession } from "./actions";
import { PLUG_OPTIONS } from "./plugs";
import type { ChargingFormValues, ChargingOptions } from "./queries";

/**
 * Charging session form. The vehicle list holds electric vehicles only.
 *
 * Nothing here checks whether the plug is free — the database refuses an
 * overlapping session and the action turns that refusal into the message shown
 * at the top of this form.
 */
export function ChargingForm({
  mode,
  sessionId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  sessionId?: string;
  options: ChargingOptions;
  initial: ChargingFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("charging");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && sessionId
      ? updateChargingSession.bind(null, sessionId)
      : createChargingSession;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const hydrated = useHydrated();
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  const localValue = (key: "chargingStartTime" | "chargingEndTime") =>
    localEdits[key] ?? (hydrated && values[key] ? toLocalInput(values[key]) : "");

  const setLocal = (key: "chargingStartTime" | "chargingEndTime", local: string) => {
    setLocalEdits((e) => ({ ...e, [key]: local }));
    const parsed = new Date(local);
    setValues((v) => ({
      ...v,
      [key]: local && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "",
    }));
  };

  const set = <K extends keyof ChargingFormValues>(key: K, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      <input type="hidden" name="chargingStartTime" value={values.chargingStartTime} />
      <input type="hidden" name="chargingEndTime" value={values.chargingEndTime} />

      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`, state.formErrorValues)}
        </p>
      )}

      <VehiclePicker
        vehicles={options.vehicles}
        value={values.vehicleId}
        onChange={(v) => set("vehicleId", v.id)}
        error={err("vehicleId")}
        labels={{
          field: t("field.vehicle"),
          search: t("searchVehicles"),
          noMatch: t("noVehicleMatch"),
          odometer: (formatted) => t("odometerNow", { km: formatted }),
        }}
      />
      <p className="-mt-2 text-[10.5px] text-ink-3">{t("electricOnly")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.charger")} htmlFor="chargerId" error={err("chargerId")}>
          <SelectInput
            id="chargerId"
            name="chargerId"
            required
            value={values.chargerId}
            onChange={(e) => set("chargerId", e.target.value)}
          >
            <option value="">{t("chooseCharger")}</option>
            {options.chargers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chargerCode}
                {c.chargerLocation ? ` · ${c.chargerLocation}` : ""}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label={t("field.plugs")}
          htmlFor="plugsUsed"
          error={err("plugsUsed")}
          hint={<Micro bar={false}>{t("plugsHint")}</Micro>}
        >
          <SelectInput
            id="plugsUsed"
            name="plugsUsed"
            required
            value={values.plugsUsed}
            onChange={(e) => set("plugsUsed", e.target.value)}
          >
            {PLUG_OPTIONS.map((plug) => (
              <option key={plug} value={plug}>
                {plug}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.startTime")}
          htmlFor="startLocal"
          error={err("chargingStartTime")}
        >
          <TextInput
            id="startLocal"
            type="datetime-local"
            value={localValue("chargingStartTime")}
            onChange={(e) => setLocal("chargingStartTime", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.endTime")}
          htmlFor="endLocal"
          error={err("chargingEndTime")}
          source={t("source.duration")}
        >
          <TextInput
            id="endLocal"
            type="datetime-local"
            value={localValue("chargingEndTime")}
            onChange={(e) => setLocal("chargingEndTime", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.batteryStart")}
          htmlFor="batteryStartPct"
          error={err("batteryStartPct")}
        >
          <NumberInput
            id="batteryStartPct"
            name="batteryStartPct"
            min={0}
            max={100}
            step="0.1"
            value={values.batteryStartPct}
            onChange={(e) => set("batteryStartPct", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.batteryEnd")}
          htmlFor="batteryEndPct"
          error={err("batteryEndPct")}
        >
          <NumberInput
            id="batteryEndPct"
            name="batteryEndPct"
            min={0}
            max={100}
            step="0.1"
            value={values.batteryEndPct}
            onChange={(e) => set("batteryEndPct", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={t("field.energy")}
        htmlFor="energyConsumedKwh"
        error={err("energyConsumedKwh")}
      >
        <NumberInput
          id="energyConsumedKwh"
          name="energyConsumedKwh"
          min={0}
          step="0.01"
          value={values.energyConsumedKwh}
          onChange={(e) => set("energyConsumedKwh", e.target.value)}
        />
      </Field>

      <Field label={t("field.notes")} htmlFor="notes" error={err("notes")}>
        <TextArea
          id="notes"
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/charging", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
