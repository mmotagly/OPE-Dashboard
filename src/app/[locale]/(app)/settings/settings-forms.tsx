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
import { EMPTY_FORM_STATE } from "@/lib/forms";
import type { AppRole } from "@/lib/roles";
import { createLookup, updateLookup, updateThresholds, updateUser } from "./actions";
import type { LookupCategoryRow, LookupRow, ThresholdRow, UserRow } from "./queries";

const ROLES: AppRole[] = ["super_admin", "admin", "supervisor", "data_admin"];

const cancelLink =
  "flex flex-1 items-center justify-center rounded-[10px] border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none";

const checkbox =
  "flex items-center gap-3 rounded-[10px] border border-hairline bg-canvas px-3 py-3";

/** Edits an existing profile. There is no create — accounts live in Supabase. */
export function UserForm({
  user,
  backTo,
}: {
  user: UserRow;
  backTo: QueryParams;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(
    updateUser.bind(null, user.id),
    EMPTY_FORM_STATE,
  );

  const [values, setValues] = useState({
    fullName: user.fullName,
    jobTitle: user.jobTitle ?? "",
    role: user.role as string,
    isEngineer: user.isEngineer,
    isActive: user.isActive,
  });

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p
          role="alert"
          className="rounded-[10px] border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      <Field label={t("field.fullName")} htmlFor="fullName" error={err("fullName")}>
        <TextInput
          id="fullName"
          name="fullName"
          required
          value={values.fullName}
          onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
        />
      </Field>

      <Field label={t("field.jobTitle")} htmlFor="jobTitle" error={err("jobTitle")}>
        <TextInput
          id="jobTitle"
          name="jobTitle"
          value={values.jobTitle}
          onChange={(e) => setValues((v) => ({ ...v, jobTitle: e.target.value }))}
        />
      </Field>

      <Field label={t("field.role")} htmlFor="role" error={err("role")}>
        <SelectInput
          id="role"
          name="role"
          value={values.role}
          onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`role.${role}`)}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-1.5">
        <label className={checkbox}>
          <input
            type="checkbox"
            name="isEngineer"
            checked={values.isEngineer}
            onChange={(e) => setValues((v) => ({ ...v, isEngineer: e.target.checked }))}
            className="h-4.5 w-4.5 accent-[var(--color-ink)]"
          />
          <span className="text-[13.5px]">{t("field.isEngineer")}</span>
        </label>
        <p className="text-[10.5px] text-ink-3">{t("engineerHint")}</p>
      </div>

      <label className={checkbox}>
        <input
          type="checkbox"
          name="isActive"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="h-4.5 w-4.5 accent-[var(--color-ink)]"
        />
        <span className="text-[13.5px]">{t("field.isActive")}</span>
      </label>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link href={{ pathname: "/settings", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}

/** Both PM thresholds. Not a list, so it is a plain panel rather than a table. */
export function ThresholdsForm({ thresholds }: { thresholds: ThresholdRow[] }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(updateThresholds, EMPTY_FORM_STATE);

  const initial = (key: string) =>
    String(thresholds.find((s) => s.key === key)?.value ?? "");

  const [dueSoon, setDueSoon] = useState(initial("pm_due_soon_km"));
  const [dueNow, setDueNow] = useState(initial("pm_due_now_km"));

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p
          role="alert"
          className="rounded-[10px] border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      <p className="text-[12.5px] text-ink-3">{t("thresholdsNote")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.dueSoonKm")}
          htmlFor="pm_due_soon_km"
          error={err("pm_due_soon_km")}
        >
          <NumberInput
            id="pm_due_soon_km"
            name="pm_due_soon_km"
            min={0}
            step="1"
            required
            value={dueSoon}
            onChange={(e) => setDueSoon(e.target.value)}
          />
        </Field>

        <Field
          label={t("field.dueNowKm")}
          htmlFor="pm_due_now_km"
          error={err("pm_due_now_km")}
        >
          <NumberInput
            id="pm_due_now_km"
            name="pm_due_now_km"
            min={0}
            step="1"
            required
            value={dueNow}
            onChange={(e) => setDueNow(e.target.value)}
          />
        </Field>
      </div>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Add or edit a lookup value. Deactivating is how a used value is retired —
 * there is no delete, because operational rows reference it.
 */
export function LookupForm({
  mode,
  lookup,
  categories,
  defaultCategory,
  backTo,
}: {
  mode: "create" | "edit";
  lookup?: LookupRow;
  categories: LookupCategoryRow[];
  defaultCategory: string;
  backTo: QueryParams;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && lookup ? updateLookup.bind(null, lookup.id) : createLookup;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  const [values, setValues] = useState({
    // `||`, not `??` — defaultCategory arrives as "" (not undefined) when no
    // category filter is active, and an empty string should fall through
    // to the first real option same as a missing one would.
    category: lookup?.category || defaultCategory || categories[0]?.key || "",
    code: lookup?.code ?? "",
    labelEn: lookup?.labelEn ?? "",
    labelAr: lookup?.labelAr ?? "",
    sortOrder: String(lookup?.sortOrder ?? 0),
    isActive: lookup?.isActive ?? true,
  });

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      {state.formError && (
        <p
          role="alert"
          className="rounded-[10px] border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      <Field label={t("field.category")} htmlFor="category" error={err("category")}>
        {/* A disabled control never submits its value — the browser drops it
            from FormData entirely, not just from editing. Native <select>
            has no readOnly, so the locked-on-edit value travels through a
            hidden input instead; the visible select stays disabled purely
            for the interaction lock. */}
        {mode === "edit" && <input type="hidden" name="category" value={values.category} />}
        <SelectInput
          id="category"
          name={mode === "edit" ? undefined : "category"}
          required
          disabled={mode === "edit"}
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.code")} htmlFor="code" error={err("code")}>
          <TextInput
            id="code"
            name="code"
            required
            dir="ltr"
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
          />
        </Field>

        <Field label={t("field.sortOrder")} htmlFor="sortOrder" error={err("sortOrder")}>
          <NumberInput
            id="sortOrder"
            name="sortOrder"
            step="1"
            value={values.sortOrder}
            onChange={(e) => setValues((v) => ({ ...v, sortOrder: e.target.value }))}
          />
        </Field>
      </div>

      <Field label={t("field.labelEn")} htmlFor="labelEn" error={err("labelEn")}>
        <TextInput
          id="labelEn"
          name="labelEn"
          required
          value={values.labelEn}
          onChange={(e) => setValues((v) => ({ ...v, labelEn: e.target.value }))}
        />
      </Field>

      <Field label={t("field.labelAr")} htmlFor="labelAr" error={err("labelAr")}>
        <TextInput
          id="labelAr"
          name="labelAr"
          dir="rtl"
          value={values.labelAr}
          onChange={(e) => setValues((v) => ({ ...v, labelAr: e.target.value }))}
        />
      </Field>

      <div className="grid gap-1.5">
        <label className={checkbox}>
          <input
            type="checkbox"
            name="isActive"
            checked={values.isActive}
            onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            className="h-4.5 w-4.5 accent-[var(--color-ink)]"
          />
          <span className="text-[13.5px]">{t("field.isActive")}</span>
        </label>
        <p className="text-[10.5px] text-ink-3">{t("deactivateHint")}</p>
      </div>

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link href={{ pathname: "/settings", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
