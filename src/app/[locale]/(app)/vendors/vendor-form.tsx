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
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { createVendor, updateVendor } from "./actions";
import type { VendorFormValues, VendorOptions } from "./queries";

export function VendorForm({
  mode,
  vendorId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  vendorId?: string;
  options: VendorOptions;
  initial: VendorFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");
  const tFinance = useTranslations("finance");

  const action =
    mode === "edit" && vendorId ? updateVendor.bind(null, vendorId) : createVendor;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof VendorFormValues>(
    key: K,
    value: VendorFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  // One company vendor, enforced here as well as by one_company_vendor. The
  // record already holding the flag can of course keep it.
  const heldByAnother =
    options.companyVendor !== null && options.companyVendor.id !== vendorId;

  const formula =
    values.billingBasis === "per_avg_bus_month"
      ? tFinance("formulaOwned")
      : values.billingBasis === "per_bus_day"
        ? tFinance("formulaRental")
        : null;

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
        <Field label={t("field.vendorCode")} htmlFor="vendorCode" error={err("vendorCode")}>
          <TextInput
            id="vendorCode"
            name="vendorCode"
            required
            value={values.vendorCode}
            onChange={(e) => set("vendorCode", e.target.value)}
          />
        </Field>

        <Field label={t("field.vendorName")} htmlFor="vendorName" error={err("vendorName")}>
          <TextInput
            id="vendorName"
            name="vendorName"
            required
            value={values.vendorName}
            onChange={(e) => set("vendorName", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("field.vendorType")} htmlFor="vendorTypeId" error={err("vendorTypeId")}>
        <SelectInput
          id="vendorTypeId"
          name="vendorTypeId"
          value={values.vendorTypeId}
          onChange={(e) => set("vendorTypeId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.vendorTypes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.labelEn}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-1.5">
        <label
          className={`flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-3 ${
            heldByAnother ? "opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            name="isCompany"
            checked={values.isCompany}
            disabled={heldByAnother}
            onChange={(e) => set("isCompany", e.target.checked)}
            className="h-4.5 w-4.5 accent-[var(--color-ink)]"
          />
          <span className="text-[13.5px]">{t("field.isCompany")}</span>
        </label>
        {heldByAnother && (
          <p className="text-[12px] text-ink-3">
            {t("companyVendorHeldBy", { vendor: options.companyVendor!.vendorName })}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.contactPerson")}
          htmlFor="contactPerson"
          error={err("contactPerson")}
        >
          <TextInput
            id="contactPerson"
            name="contactPerson"
            value={values.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
          />
        </Field>

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
      </div>

      <Field label={t("field.email")} htmlFor="emailAddress" error={err("emailAddress")}>
        <TextInput
          id="emailAddress"
          name="emailAddress"
          type="email"
          dir="ltr"
          value={values.emailAddress}
          onChange={(e) => set("emailAddress", e.target.value)}
        />
      </Field>

      <div className="border-t border-hairline pt-4">
        <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          {t("billingTerms")}
        </h3>

        <div className="grid gap-4">
          <Field
            label={tFinance("basis")}
            htmlFor="billingBasis"
            error={err("billingBasis")}
          >
            <SelectInput
              id="billingBasis"
              name="billingBasis"
              value={values.billingBasis}
              onChange={(e) => set("billingBasis", e.target.value)}
            >
              <option value="">{t("noBillingTerms")}</option>
              <option value="per_bus_day">{t("basisPerBusDay")}</option>
              <option value="per_avg_bus_month">{t("basisPerAvgBusMonth")}</option>
            </SelectInput>
          </Field>

          {formula && (
            <p className="rounded-[9px] border border-hairline bg-raise px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
              {formula}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={
                values.billingBasis === "per_avg_bus_month"
                  ? tFinance("ratePerBus")
                  : t("field.rateAmount")
              }
              htmlFor="rateAmount"
              error={err("rateAmount")}
            >
              <NumberInput
                id="rateAmount"
                name="rateAmount"
                min={0}
                step="0.01"
                value={values.rateAmount}
                onChange={(e) => set("rateAmount", e.target.value)}
              />
            </Field>

            <Field label={t("field.currency")} htmlFor="currency" error={err("currency")}>
              <TextInput
                id="currency"
                name="currency"
                required
                dir="ltr"
                value={values.currency}
                onChange={(e) => set("currency", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-1.5">
            <label className="flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-3">
              <input
                type="checkbox"
                name="applyKpi"
                checked={values.applyKpi}
                onChange={(e) => set("applyKpi", e.target.checked)}
                className="h-4.5 w-4.5 accent-[var(--color-ink)]"
              />
              <span className="text-[13.5px]">{t("field.applyKpi")}</span>
            </label>
            <Micro bar={false}>{t("applyKpiHint")}</Micro>
          </div>

          <Field
            label={t("field.billingNotes")}
            htmlFor="billingNotes"
            error={err("billingNotes")}
          >
            <TextArea
              id="billingNotes"
              name="billingNotes"
              rows={3}
              value={values.billingNotes}
              onChange={(e) => set("billingNotes", e.target.value)}
            />
          </Field>
        </div>
      </div>

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
          href={{ pathname: "/vendors", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
