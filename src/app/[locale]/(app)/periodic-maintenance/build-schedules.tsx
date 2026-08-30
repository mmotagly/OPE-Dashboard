"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { buildPmSchedules } from "./actions";
import type { SeedableVehicle } from "./queries";

/**
 * Seeds PM schedules for a whole fleet in one pass. Only vehicles that have no
 * schedule are listed, and select-all is the expected path — a new fleet is
 * fifty buses, not one.
 */
export function BuildSchedules({ vehicles }: { vehicles: SeedableVehicle[] }) {
  const t = useTranslations("pm");

  const [state, formAction, pending] = useActionState(
    buildPmSchedules,
    EMPTY_FORM_STATE,
  );

  const [selected, setSelected] = useState<string[]>(() => vehicles.map((v) => v.id));

  const allSelected = vehicles.length > 0 && selected.length === vehicles.length;

  const toggle = (id: string, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)));

  if (vehicles.length === 0) {
    return <p className="text-[13px] text-ink-3">{t("allVehiclesSeeded")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <p className="text-[12.5px] text-ink-3">{t("buildNote")}</p>

      <label className="flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-2.5">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => setSelected(e.target.checked ? vehicles.map((v) => v.id) : [])}
          className="h-4.5 w-4.5 accent-[var(--color-ink)]"
        />
        <span className="text-[13.5px] font-medium">{t("selectAll")}</span>
        <span className="ms-auto">
          <Micro bar={false}>
            {t("selectedCount", { selected: selected.length, total: vehicles.length })}
          </Micro>
        </span>
      </label>

      <ul className="grid max-h-80 gap-1.5 overflow-y-auto rounded-control border border-hairline p-1.5">
        {vehicles.map((vehicle) => {
          const checked = selected.includes(vehicle.id);
          return (
            <li key={vehicle.id}>
              <label
                className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 transition-colors ${
                  checked ? "bg-elev" : "hover:bg-raise"
                }`}
              >
                <input
                  type="checkbox"
                  name="vehicleIds"
                  value={vehicle.id}
                  checked={checked}
                  onChange={(e) => toggle(vehicle.id, e.target.checked)}
                  className="h-4.5 w-4.5 accent-[var(--color-ink)]"
                />
                <span className="tnum text-[13.5px] font-medium">{vehicle.vehicleCode}</span>
                <span className="tnum text-[12.5px] text-ink-3">{vehicle.plateNumber}</span>
                {vehicle.vendorName && (
                  <span className="ms-auto truncate text-[12px] text-ink-3">
                    {vehicle.vendorName}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`, state.formErrorValues)}
        </p>
      )}

      <FormActions>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || selected.length === 0}
        >
          {pending
            ? t("building")
            : t("buildForCount", { count: selected.length })}
        </Button>
      </FormActions>
    </form>
  );
}
