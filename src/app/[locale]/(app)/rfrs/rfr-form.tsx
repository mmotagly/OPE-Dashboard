"use client";

import type { QueryParams } from "@/lib/filters";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FormActions,
  NumberInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { VehiclePicker } from "@/components/ui/vehicle-picker";
import { useHydrated } from "@/components/ui/use-hydrated";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { toLocalInput } from "@/lib/format";
import { createRfr, updateRfr } from "./actions";
import type { RfrFormValues, RfrOptions } from "./queries";

/**
 * Raise or amend an RFR.
 *
 * Driver and KM record are shown but left blank on a new request: the insert
 * trigger fills them from the last operation on or before the request date.
 * Typing a value overrides that — the trigger only fills what is null — and
 * whatever ends up stored is what the detail pane reads back.
 */
export function RfrForm({
  mode,
  rfrId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  rfrId?: string;
  options: RfrOptions;
  initial: RfrFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("rfr");
  const tCommon = useTranslations("common");

  const action = mode === "edit" && rfrId ? updateRfr.bind(null, rfrId) : createRfr;
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  const [values, setValues] = useState(initial);

  // The posted value is an ISO instant; the visible control shows it as local
  // wall-clock. The stored instant renders differently in the server's zone
  // and the browser's, so the conversion waits until hydration is done.
  const hydrated = useHydrated();
  const [localEdit, setLocalEdit] = useState<string | null>(null);
  const localAt =
    localEdit ?? (hydrated && values.requestAt ? toLocalInput(values.requestAt) : "");

  const set = <K extends keyof RfrFormValues>(key: K, value: RfrFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onRequestAt = (local: string) => {
    setLocalEdit(local);
    const parsed = new Date(local);
    set("requestAt", local && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "");
  };

  const toggleIssue = (id: string, checked: boolean) =>
    set(
      "issueTypeIds",
      checked
        ? [...values.issueTypeIds, id]
        : values.issueTypeIds.filter((i) => i !== id),
    );

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      <input type="hidden" name="requestAt" value={values.requestAt} />

      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      <Field label={t("requested")} htmlFor="requestAtLocal" error={err("requestAt")}>
        <TextInput
          id="requestAtLocal"
          type="datetime-local"
          required
          value={localAt}
          onChange={(e) => onRequestAt(e.target.value)}
        />
      </Field>

      <VehiclePicker
        vehicles={options.vehicles}
        value={values.vehicleId}
        onChange={(v) => set("vehicleId", v.id)}
        error={err("vehicleId")}
        labels={{
          field: t("vehicle"),
          search: t("searchVehicles"),
          noMatch: t("noVehicleMatch"),
          odometer: (formatted) => t("odometerNow", { km: formatted }),
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("driver")}
          htmlFor="driverId"
          error={err("driverId")}
          source={t("source.driver")}
        >
          <SelectInput
            id="driverId"
            name="driverId"
            value={values.driverId}
            onChange={(e) => set("driverId", e.target.value)}
          >
            <option value="">{t("autoFromLastOperation")}</option>
            {options.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driverCode} · {d.driverName}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label={t("kmRecord")}
          htmlFor="odometerKm"
          error={err("odometerKm")}
          source={t("source.odometer")}
        >
          <NumberInput
            id="odometerKm"
            name="odometerKm"
            min={0}
            step="0.01"
            placeholder={t("autoFromLastOperation")}
            value={values.odometerKm}
            onChange={(e) => set("odometerKm", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={t("location")}
        htmlFor="vehicleLocation"
        error={err("vehicleLocation")}
      >
        <TextInput
          id="vehicleLocation"
          name="vehicleLocation"
          required
          value={values.vehicleLocation}
          onChange={(e) => set("vehicleLocation", e.target.value)}
        />
      </Field>

      <Field label={t("description")} htmlFor="description" error={err("description")}>
        <TextArea
          id="description"
          name="description"
          rows={4}
          required
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <FieldGroup label={t("issues")} error={err("issueTypeIds")}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.issueTypes.map((issue) => {
            const checked = values.issueTypeIds.includes(issue.id);
            return (
              <label
                key={issue.id}
                className={`flex items-center gap-2.5 rounded-control border px-3 py-2.5 transition-colors ${
                  checked ? "border-white/10 bg-elev" : "border-hairline bg-canvas"
                }`}
              >
                <input
                  type="checkbox"
                  name="issueTypeIds"
                  value={issue.id}
                  checked={checked}
                  onChange={(e) => toggleIssue(issue.id, e.target.checked)}
                  className="h-4.5 w-4.5 accent-[var(--color-ink)]"
                />
                <span className="text-[13px]">{issue.labelEn}</span>
              </label>
            );
          })}
        </div>
      </FieldGroup>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/rfrs", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
