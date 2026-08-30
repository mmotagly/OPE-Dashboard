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
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { useHydrated } from "@/components/ui/use-hydrated";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { km, toLocalInput } from "@/lib/format";
import { createWorkOrder, updateWorkOrder } from "./actions";
import type {
  RfrContext,
  WorkOrderFormValues,
  WorkOrderOptions,
} from "./queries";

/**
 * The work order form. The RFR block at the top is read-only context — a work
 * order belongs to its request and none of those values are editable here.
 *
 * Filling in the repair end is what completes the order and, through
 * trg_wo_advance_pm, advances the PM schedule for every replaced part.
 */
export function WorkOrderForm({
  mode,
  workOrderId,
  rfr,
  options,
  initial,
  backTo,
}: {
  mode: "create" | "edit";
  workOrderId?: string;
  rfr: RfrContext;
  options: WorkOrderOptions;
  initial: WorkOrderFormValues;
  backTo: QueryParams;
}) {
  const t = useTranslations("workOrder");
  const tCommon = useTranslations("common");
  const tRfr = useTranslations("rfr");

  const action =
    mode === "edit" && workOrderId
      ? updateWorkOrder.bind(null, workOrderId)
      : createWorkOrder.bind(null, rfr.rfrId);

  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [values, setValues] = useState(initial);

  // Stored instants render differently in the server's zone and the browser's,
  // so the local-time controls are only filled once hydration is done.
  const hydrated = useHydrated();
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  const localValue = (key: "repairStartAt" | "repairEndAt") =>
    localEdits[key] ?? (hydrated && values[key] ? toLocalInput(values[key]) : "");

  const setLocal = (key: "repairStartAt" | "repairEndAt", local: string) => {
    setLocalEdits((e) => ({ ...e, [key]: local }));
    const parsed = new Date(local);
    setValues((v) => ({
      ...v,
      [key]: local && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "",
    }));
  };

  const set = <K extends keyof WorkOrderFormValues>(
    key: K,
    value: WorkOrderFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const togglePart = (id: string, checked: boolean) =>
    set(
      "partIds",
      checked ? [...values.partIds, id] : values.partIds.filter((p) => p !== id),
    );

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  const selectedPmParts = options.parts.filter(
    (p) => p.isPmItem && values.partIds.includes(p.id),
  ).length;

  return (
    <form action={formAction} className="grid gap-4 px-4 py-4">
      <input type="hidden" name="repairStartAt" value={values.repairStartAt} />
      <input type="hidden" name="repairEndAt" value={values.repairEndAt} />

      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      {/* Read-only context from the request this order hangs off. */}
      <div className="grid gap-2 rounded-control border border-hairline bg-canvas px-3 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="tnum text-[14px] font-semibold">{rfr.rfrNumber}</span>
          <span className="tnum text-[13px] text-ink-2">{rfr.vehicleCode}</span>
          <span className="tnum text-[12.5px] text-ink-3">{rfr.plateNumber}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
          <span>
            {tRfr("driver")}: {rfr.driverName ?? "—"}
          </span>
          <span className="tnum">
            {tRfr("kmRecord")}: {km(rfr.odometerKm)}
          </span>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-3">{rfr.description}</p>
        <Micro bar={false}>{t("fromRequest")}</Micro>
      </div>

      <Field
        label={t("field.engineer")}
        htmlFor="assignedEngineerId"
        error={err("assignedEngineerId")}
        source={t("source.engineer")}
      >
        <SelectInput
          id="assignedEngineerId"
          name="assignedEngineerId"
          value={values.assignedEngineerId}
          onChange={(e) => set("assignedEngineerId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.engineers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.maintenanceType")}
          htmlFor="maintenanceTypeId"
          error={err("maintenanceTypeId")}
        >
          <SelectInput
            id="maintenanceTypeId"
            name="maintenanceTypeId"
            value={values.maintenanceTypeId}
            onChange={(e) => set("maintenanceTypeId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.maintenanceTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label={t("field.issueType")}
          htmlFor="issueTypeId"
          error={err("issueTypeId")}
        >
          <SelectInput
            id="issueTypeId"
            name="issueTypeId"
            value={values.issueTypeId}
            onChange={(e) => set("issueTypeId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.issueTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.category")}
          htmlFor="maintenanceCategoryId"
          error={err("maintenanceCategoryId")}
        >
          <SelectInput
            id="maintenanceCategoryId"
            name="maintenanceCategoryId"
            value={values.maintenanceCategoryId}
            onChange={(e) => set("maintenanceCategoryId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.maintenanceCategories.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label={t("field.centre")}
          htmlFor="maintenanceCenterId"
          error={err("maintenanceCenterId")}
        >
          <SelectInput
            id="maintenanceCenterId"
            name="maintenanceCenterId"
            value={values.maintenanceCenterId}
            onChange={(e) => set("maintenanceCenterId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {options.centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.centreCode} · {c.centreName}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("field.repairStart")}
          htmlFor="repairStartLocal"
          error={err("repairStartAt")}
        >
          <TextInput
            id="repairStartLocal"
            type="datetime-local"
            value={localValue("repairStartAt")}
            onChange={(e) => setLocal("repairStartAt", e.target.value)}
          />
        </Field>

        <Field
          label={t("field.repairEnd")}
          htmlFor="repairEndLocal"
          error={err("repairEndAt")}
          source={t("source.repairEnd")}
        >
          <TextInput
            id="repairEndLocal"
            type="datetime-local"
            value={localValue("repairEndAt")}
            onChange={(e) => setLocal("repairEndAt", e.target.value)}
          />
        </Field>
      </div>

      <FieldGroup label={t("field.technicians")}>
        <div className="grid gap-2 sm:grid-cols-3">
          <TextInput
            name="technician1"
            aria-label={`${t("field.technicians")} 1`}
            value={values.technician1}
            onChange={(e) => set("technician1", e.target.value)}
          />
          <TextInput
            name="technician2"
            aria-label={`${t("field.technicians")} 2`}
            value={values.technician2}
            onChange={(e) => set("technician2", e.target.value)}
          />
          <TextInput
            name="technician3"
            aria-label={`${t("field.technicians")} 3`}
            value={values.technician3}
            onChange={(e) => set("technician3", e.target.value)}
          />
        </div>
      </FieldGroup>

      <FieldGroup
        label={t("field.replacedParts")}
        source={
          selectedPmParts > 0 ? t("pmPartsSelected", { count: selectedPmParts }) : undefined
        }
      >
        <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-control border border-hairline p-1.5">
          {options.parts.map((part) => {
            const checked = values.partIds.includes(part.id);
            return (
              <label
                key={part.id}
                className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 transition-colors ${
                  checked ? "bg-elev" : "hover:bg-raise"
                }`}
              >
                <input
                  type="checkbox"
                  name="partIds"
                  value={part.id}
                  checked={checked}
                  onChange={(e) => togglePart(part.id, e.target.checked)}
                  className="h-4.5 w-4.5 accent-[var(--color-ink)]"
                />
                <span className="text-[13px]">{part.partName}</span>
                {part.isPmItem && (
                  <span className="ms-auto">
                    <Micro bar={false}>{t("pmItem")}</Micro>
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </FieldGroup>

      <Field
        label={t("field.vehicleStatusAfter")}
        htmlFor="vehicleStatusAfterId"
        error={err("vehicleStatusAfterId")}
      >
        <SelectInput
          id="vehicleStatusAfterId"
          name="vehicleStatusAfterId"
          value={values.vehicleStatusAfterId}
          onChange={(e) => set("vehicleStatusAfterId", e.target.value)}
        >
          <option value="">{tCommon("none")}</option>
          {options.vehicleStatusAfter.map((o) => (
            <option key={o.id} value={o.id}>
              {o.labelEn}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t("field.description")} htmlFor="description" error={err("description")}>
        <TextArea
          id="description"
          name="description"
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-3">
        <input
          type="checkbox"
          name="isSkipped"
          checked={values.isSkipped}
          onChange={(e) => set("isSkipped", e.target.checked)}
          className="h-4.5 w-4.5 accent-[var(--color-ink)]"
        />
        <span className="text-[13.5px]">{t("field.isSkipped")}</span>
      </label>

      {values.isSkipped && (
        <div className="grid gap-4">
          <Field
            label={t("field.skipReason")}
            htmlFor="skipReasonId"
            error={err("skipReasonId")}
          >
            <SelectInput
              id="skipReasonId"
              name="skipReasonId"
              value={values.skipReasonId}
              onChange={(e) => set("skipReasonId", e.target.value)}
            >
              <option value="">{t("chooseSkipReason")}</option>
              {options.skipReasons.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.labelEn}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label={t("field.skipNotes")} htmlFor="skipNotes" error={err("skipNotes")}>
            <TextArea
              id="skipNotes"
              name="skipNotes"
              rows={2}
              value={values.skipNotes}
              onChange={(e) => set("skipNotes", e.target.value)}
            />
          </Field>
        </div>
      )}

      <FormActions>
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 xl:flex-none">
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
        <Link
          href={{ pathname: "/work-orders", query: backTo }}
          className="flex flex-1 items-center justify-center rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise xl:flex-none"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
