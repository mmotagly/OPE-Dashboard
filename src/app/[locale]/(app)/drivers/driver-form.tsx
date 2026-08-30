"use client";

import type { QueryParams } from "@/lib/filters";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormActions,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { createDriver, updateDriver } from "./actions";
import type { DriverFormValues, DriverOptions } from "./queries";

export function DriverForm({
  mode,
  driverId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  driverId?: string;
  options: DriverOptions;
  initial: DriverFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && driverId ? updateDriver.bind(null, driverId) : createDriver;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof DriverFormValues>(
    key: K,
    value: DriverFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

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
        <Field label={t("field.driverCode")} htmlFor="driverCode" error={err("driverCode")}>
          <TextInput
            id="driverCode"
            name="driverCode"
            required
            value={values.driverCode}
            onChange={(e) => set("driverCode", e.target.value)}
          />
        </Field>

        <Field label={t("field.driverName")} htmlFor="driverName" error={err("driverName")}>
          <TextInput
            id="driverName"
            name="driverName"
            required
            value={values.driverName}
            onChange={(e) => set("driverName", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label={t("field.vendor")}
        htmlFor="vendorId"
        error={err("vendorId")}
        hint={
          values.vendorId === "" ? (
            <Micro bar={false}>{t("companyDriver")}</Micro>
          ) : undefined
        }
      >
        <SelectInput
          id="vendorId"
          name="vendorId"
          value={values.vendorId}
          onChange={(e) => set("vendorId", e.target.value)}
        >
          <option value="">{t("companyDriver")}</option>
          {options.vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vendorCode} · {v.vendorName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.mobile")} htmlFor="mobileNumber" error={err("mobileNumber")}>
          <TextInput
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            dir="ltr"
            value={values.mobileNumber}
            onChange={(e) => set("mobileNumber", e.target.value)}
          />
        </Field>

        <Field label={t("field.hiringDate")} htmlFor="hiringDate" error={err("hiringDate")}>
          <TextInput
            id="hiringDate"
            name="hiringDate"
            type="date"
            value={values.hiringDate}
            onChange={(e) => set("hiringDate", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.licenseNumber")}
          htmlFor="licenseNumber"
          error={err("licenseNumber")}
        >
          <TextInput
            id="licenseNumber"
            name="licenseNumber"
            value={values.licenseNumber}
            onChange={(e) => set("licenseNumber", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.licenseGrade")}
          htmlFor="licenseGradeId"
          error={err("licenseGradeId")}
        >
          <SelectInput
            id="licenseGradeId"
            name="licenseGradeId"
            value={values.licenseGradeId}
            onChange={(e) => set("licenseGradeId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.licenseGrades.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field
        label={t("field.licenseExpiry")}
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

      <label className="flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-3">
        <input
          type="checkbox"
          name="hasTourismId"
          checked={values.hasTourismId}
          onChange={(e) => set("hasTourismId", e.target.checked)}
          className="h-4.5 w-4.5 accent-[var(--color-ink)]"
        />
        <span className="text-[13.5px]">{t("field.hasTourismId")}</span>
      </label>

      {values.hasTourismId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("field.tourismIssuer")}
            htmlFor="tourismIdIssuingCompany"
            error={err("tourismIdIssuingCompany")}
          >
            <TextInput
              id="tourismIdIssuingCompany"
              name="tourismIdIssuingCompany"
              value={values.tourismIdIssuingCompany}
              onChange={(e) => set("tourismIdIssuingCompany", e.target.value)}
            />
          </Field>

          <Field
            label={t("field.tourismExpiry")}
            htmlFor="tourismIdExpiryDate"
            error={err("tourismIdExpiryDate")}
          >
            <TextInput
              id="tourismIdExpiryDate"
              name="tourismIdExpiryDate"
              type="date"
              value={values.tourismIdExpiryDate}
              onChange={(e) => set("tourismIdExpiryDate", e.target.value)}
            />
          </Field>
        </div>
      )}

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

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/drivers", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
