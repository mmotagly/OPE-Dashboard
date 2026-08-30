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
import { createRoute, createStation, updateRoute, updateStation } from "./actions";
import type {
  RouteFormValues,
  RouteOptions,
  StationFormValues,
} from "./queries";

const cancelLink =
  "flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none";

export function RouteForm({
  mode,
  routeId,
  options,
  initial,
  backTo,
  /** Stops actually linked, so the manual count can be sanity-checked. */
  linkedStations,
}: {
  mode: "create" | "edit";
  routeId?: string;
  options: RouteOptions;
  initial: RouteFormValues;
  backTo: QueryParams;
  linkedStations?: number;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && routeId ? updateRoute.bind(null, routeId) : createRoute;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof RouteFormValues>(key: K, value: string) =>
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
        <Field label={t("field.routeCode")} htmlFor="routeCode" error={err("routeCode")}>
          <TextInput
            id="routeCode"
            name="routeCode"
            required
            value={values.routeCode}
            onChange={(e) => set("routeCode", e.target.value)}
          />
        </Field>

        <Field label={t("field.routeName")} htmlFor="routeName" error={err("routeName")}>
          <TextInput
            id="routeName"
            name="routeName"
            required
            value={values.routeName}
            onChange={(e) => set("routeName", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.routeDistance")}
          htmlFor="routeDistanceKm"
          error={err("routeDistanceKm")}
        >
          <NumberInput
            id="routeDistanceKm"
            name="routeDistanceKm"
            min={0}
            step="0.01"
            value={values.routeDistanceKm}
            onChange={(e) => set("routeDistanceKm", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.numberOfStations")}
          htmlFor="numberOfStations"
          error={err("numberOfStations")}
          hint={
            linkedStations !== undefined ? (
              <Micro bar={false}>{t("stopCount", { count: linkedStations })}</Micro>
            ) : undefined
          }
        >
          <NumberInput
            id="numberOfStations"
            name="numberOfStations"
            min={0}
            step="1"
            value={values.numberOfStations}
            onChange={(e) => set("numberOfStations", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.legTime")}
          htmlFor="standardLegTime"
          error={err("standardLegTime")}
          hint={<Micro bar={false}>{t("timeFormat")}</Micro>}
        >
          <TextInput
            id="standardLegTime"
            name="standardLegTime"
            dir="ltr"
            placeholder="00:25"
            value={values.standardLegTime}
            onChange={(e) => set("standardLegTime", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.roundTripTime")}
          htmlFor="standardRoundTripTime"
          error={err("standardRoundTripTime")}
          hint={<Micro bar={false}>{t("timeFormat")}</Micro>}
        >
          <TextInput
            id="standardRoundTripTime"
            name="standardRoundTripTime"
            dir="ltr"
            placeholder="01:10"
            value={values.standardRoundTripTime}
            onChange={(e) => set("standardRoundTripTime", e.target.value)}
          />
        </Field>
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
        <Link href={{ pathname: "/routes", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}

export function StationForm({
  mode,
  stationId,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  stationId?: string;
  options: RouteOptions;
  initial: StationFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("master");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && stationId
      ? updateStation.bind(null, stationId)
      : createStation;

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  const set = <K extends keyof StationFormValues>(key: K, value: string) =>
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
        <Field
          label={t("field.stationCode")}
          htmlFor="stationCode"
          error={err("stationCode")}
        >
          <TextInput
            id="stationCode"
            name="stationCode"
            required
            value={values.stationCode}
            onChange={(e) => set("stationCode", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.stationName")}
          htmlFor="stationName"
          error={err("stationName")}
        >
          <TextInput
            id="stationName"
            name="stationName"
            required
            value={values.stationName}
            onChange={(e) => set("stationName", e.target.value)}
          />
        </Field>
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
        <Link href={{ pathname: "/routes", query: backTo }} className={cancelLink}>
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
