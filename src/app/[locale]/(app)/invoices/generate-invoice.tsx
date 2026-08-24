"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/field";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import type { LookupOption } from "@/lib/lookups";
import { generateInvoice } from "./actions";
import type { InvoiceVendor } from "./queries";

/**
 * Calls fn_generate_invoice. Only vendors with billing terms are offered,
 * since the function refuses without them — but the refusal is still what
 * decides, and its message is shown if it comes. Billing is per shift as of
 * migration 0014, so a shift is required alongside vendor and month.
 */
export function GenerateInvoice({
  vendors,
  shifts,
}: {
  vendors: InvoiceVendor[];
  shifts: LookupOption[];
}) {
  const t = useTranslations("invoice");
  const [state, formAction, pending] = useActionState(generateInvoice, EMPTY_FORM_STATE);

  const [vendorId, setVendorId] = useState("");
  const [shiftTypeId, setShiftTypeId] = useState("");
  const [month, setMonth] = useState("");

  const eligible = vendors.filter((v) => v.billingBasis !== null);

  return (
    <form action={formAction} className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <SelectInput
            name="vendorId"
            aria-label={t("field.vendor")}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">{t("chooseVendor")}</option>
            {eligible.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorCode} · {v.vendorName}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="min-w-[130px]">
          <SelectInput
            name="shiftTypeId"
            aria-label={t("field.shift")}
            value={shiftTypeId}
            onChange={(e) => setShiftTypeId(e.target.value)}
          >
            <option value="">{t("chooseShift")}</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.labelEn}
              </option>
            ))}
          </SelectInput>
        </div>

        <input
          type="month"
          name="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={t("field.periodMonth")}
          className="tnum rounded-[10px] border border-hairline bg-canvas px-3 py-2 text-[13.5px] text-ink"
        />

        <Button
          type="submit"
          disabled={pending || vendorId === "" || shiftTypeId === "" || month === ""}
        >
          {pending ? t("generating") : t("generate")}
        </Button>
      </div>

      {eligible.length === 0 && (
        <p className="text-[12px] text-ink-3">{t("noVendorTerms")}</p>
      )}

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}
    </form>
  );
}
