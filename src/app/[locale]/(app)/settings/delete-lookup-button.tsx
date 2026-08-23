"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { deleteLookup } from "./actions";

/**
 * Delete is real (not deactivate) — the DB is the safety check, via the FK
 * constraints on every table that references lookups(id). A first tap arms
 * an inline confirmation instead of a native confirm() dialog, matching how
 * the rest of this app avoids browser-native chrome for its own controls.
 */
export function DeleteLookupButton({ id, category }: { id: string; category: string }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteLookup.bind(null, id, category),
    EMPTY_FORM_STATE,
  );

  if (!armed) {
    return (
      <Button type="button" variant="danger" onClick={() => setArmed(true)}>
        {tCommon("delete")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12.5px] text-ink-2">{t("confirmDeleteLookup")}</span>
      <Button type="submit" variant="danger" disabled={pending}>
        {tCommon("delete")}
      </Button>
      <Button
        type="button"
        variant="default"
        disabled={pending}
        onClick={() => setArmed(false)}
      >
        {tCommon("cancel")}
      </Button>
      {state.formError && (
        <p role="alert" className="w-full text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}
    </form>
  );
}
