"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/field";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { openMonth } from "./actions";
import type { VendorOption } from "./queries";

/**
 * Opens a month for a vendor by calling fn_open_month, which copies that
 * vendor's template. Only vendors that have a template are offered.
 */
export function OpenMonth({
  vendors,
  withTemplate,
}: {
  vendors: VendorOption[];
  withTemplate: string[];
}) {
  const t = useTranslations("scorecard");
  const [state, formAction, pending] = useActionState(openMonth, EMPTY_FORM_STATE);

  const [vendorId, setVendorId] = useState("");
  const [month, setMonth] = useState("");

  const eligible = vendors.filter((v) => withTemplate.includes(v.id));

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

        <input
          type="month"
          name="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={t("field.periodMonth")}
          className="tnum rounded-control border border-hairline bg-canvas px-3 py-2 text-[13.5px] text-ink"
        />

        <Button type="submit" variant="primary" disabled={pending || vendorId === "" || month === ""}>
          {pending ? t("opening") : t("openMonth")}
        </Button>
      </div>

      {eligible.length === 0 && (
        <p className="text-[12px] text-ink-3">{t("noVendorTemplates")}</p>
      )}

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}
    </form>
  );
}
