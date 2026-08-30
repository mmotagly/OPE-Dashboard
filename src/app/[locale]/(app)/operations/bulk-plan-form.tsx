"use client";

import type { QueryParams } from "@/lib/filters";
import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FormActions, SelectInput, TextInput } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { createBulkPlanned } from "./actions";
import { EMPTY_BULK_PLAN_STATE } from "./schema";
import type { ShiftOption, VehicleOption } from "./queries";

/**
 * A Planned row is (vehicle, date, shift) only — fn_validate_operation_status
 * forbids everything else for that status — so this form is deliberately
 * three fields plus a vehicle checklist, not a repeat of `OperationForm`.
 *
 * Best-effort submit: on any per-vehicle failure the action returns a
 * results report instead of redirecting (see actions.ts), so this renders
 * either the input form or that report from the same action state.
 */
export function BulkPlanForm({
  shifts,
  vehicles,
  initialDate,
  backTo,
}: {
  shifts: ShiftOption[];
  vehicles: VehicleOption[];
  initialDate: string;
  /** Query to return to when the form is cancelled. Already free of blanks. */
  backTo: QueryParams;
}) {
  const t = useTranslations("operations");
  const tShift = useTranslations("shift");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(
    createBulkPlanned,
    EMPTY_BULK_PLAN_STATE,
  );

  const [operationDate, setOperationDate] = useState(initialDate);
  const [shiftTypeId, setShiftTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plateNumber.toLowerCase().includes(q) ||
        v.vehicleCode.toLowerCase().includes(q),
    );
  }, [vehicles, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The results report replaces the form entirely once the action has run
  // and at least one row failed — a full success redirects instead, so this
  // state is only ever reached on partial/total failure.
  if (state.results) {
    const successCount = state.results.filter((r) => r.ok).length;

    return (
      <div className="grid gap-4">
        <p className="text-[13px] text-ink-2">
          {t("bulkResultSummary", {
            success: successCount,
            total: state.results.length,
          })}
        </p>

        <ul className="grid gap-1.5">
          {state.results.map((r) => (
            <li
              key={r.vehicleId}
              className="flex items-center justify-between gap-2.5 rounded-control border border-hairline px-3 py-2.5"
            >
              <span className="tnum text-[13.5px] font-medium">{r.vehicleCode}</span>
              {r.ok ? (
                <Pill tone="go">{t("bulkCreated")}</Pill>
              ) : (
                <span className="text-[12px] text-stop-text">
                  {t(`error.${r.reason}`)}
                </span>
              )}
            </li>
          ))}
        </ul>

        <FormActions>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setSelected(new Set());
              // Reset by remounting the action state — simplest is just to
              // let the user submit again with a cleared selection; the
              // results view only shows because `state.results` is set, and
              // there's no local "start over" flag needed since the form
              // below is conditionally the results view or the inputs.
              window.location.reload();
            }}
          >
            {t("bulkStartOver")}
          </Button>
          <Link
            href={{ pathname: "/operations", query: backTo }}
            className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-center text-[13px] font-medium text-ink transition-colors hover:bg-raise"
          >
            {tCommon("cancel")}
          </Link>
        </FormActions>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="operationDate" value={operationDate} />
      <input type="hidden" name="shiftTypeId" value={shiftTypeId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="vehicleIds" value={id} />
      ))}

      <Field label={t("field.date")} error={state.fieldErrors.operationDate}>
        <TextInput
          type="date"
          value={operationDate}
          onChange={(e) => setOperationDate(e.target.value)}
        />
      </Field>

      <Field label={t("field.shift")} error={state.fieldErrors.shiftTypeId}>
        <SelectInput
          value={shiftTypeId}
          onChange={(e) => setShiftTypeId(e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {tShift.has(s.code) ? tShift(s.code) : s.labelEn}
            </option>
          ))}
        </SelectInput>
      </Field>

      <FieldGroup
        label={t("selectVehicles")}
        hint={<span className="tnum text-ink-3">{selected.size}</span>}
        error={state.fieldErrors.vehicleIds}
      >
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchVehicles")}
          aria-label={t("searchVehicles")}
          autoComplete="off"
        />

        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(matches.map((v) => v.id)))}
            className="text-[12px] text-ink-2 transition-colors hover:text-ink"
          >
            {t("selectAll")}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12px] text-ink-2 transition-colors hover:text-ink"
          >
            {t("selectNone")}
          </button>
        </div>

        <div className="mt-1.5 max-h-72 overflow-y-auto rounded-control border border-hairline">
          {matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-ink-3">
              {t("noVehicleMatch")}
            </p>
          ) : (
            <ul>
              {matches.map((v) => {
                const isSelected = selected.has(v.id);
                return (
                  <li key={v.id}>
                    <label className="flex w-full cursor-pointer items-baseline gap-2.5 border-b border-hairline px-3 py-3 text-start transition-colors last:border-b-0 hover:bg-raise">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(v.id)}
                        className="h-4 w-4 accent-[var(--color-ink)]"
                      />
                      <span className="tnum text-[14px] font-semibold">{v.vehicleCode}</span>
                      <span className="tnum text-[13px] text-ink-2">{v.plateNumber}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </FieldGroup>

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}

      <FormActions>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || selected.size === 0 || operationDate === "" || shiftTypeId === ""}
        >
          {pending
            ? tCommon("loading")
            : t("bulkSubmit", { count: selected.size })}
        </Button>
        <Link
          href={{ pathname: "/operations", query: backTo }}
          className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-center text-[13px] font-medium text-ink transition-colors hover:bg-raise"
        >
          {tCommon("cancel")}
        </Link>
      </FormActions>
    </form>
  );
}
