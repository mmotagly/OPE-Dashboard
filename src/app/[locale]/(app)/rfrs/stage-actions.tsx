"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, SelectInput } from "@/components/ui/field";
import { StageRail, type Stage } from "@/components/ui/stage-rail";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import type { LookupOption } from "@/lib/lookups";
import { canTransition } from "./stage-rules";
import { isSkipStage } from "./stage-tone";
import { changeStage } from "./actions";

const ARM_TIMEOUT_MS = 4000;

/**
 * The stage rail is the control now — no separate select + "Move stage"
 * button. Tapping a valid node arms it (a ring, no write yet); tapping the
 * same node again within a few seconds commits. Every skip variant (Skip
 * Next Trip, Skip Next PM, Skipped) still needs a second decision — a
 * reason — so arming one reveals the reason picker instead of waiting on a
 * second tap; choosing a reason is itself the commit.
 */
export function StageActions({
  rfrId,
  stages,
  skipReasons,
  rail,
  currentStageCode,
  isSuperAdmin,
}: {
  rfrId: string;
  stages: LookupOption[];
  skipReasons: LookupOption[];
  rail: Stage[];
  currentStageCode: string;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("rfr");
  const [state, formAction, pending] = useActionState(
    changeStage.bind(null, rfrId),
    EMPTY_FORM_STATE,
  );

  const [armedCode, setArmedCode] = useState<string | null>(null);
  const [skipReasonId, setSkipReasonId] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearArmTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  // Resync to server truth on any rejected transition — nothing stays armed
  // or half-picked past a failure. Adjusted during render (comparing against
  // the last action result already committed) rather than in an effect, per
  // React's guidance against setState-in-effect for this exact "derive local
  // state from a result change" shape. The stale arm timeout (a ref) isn't
  // touched here — refs can't be read/written during render — it's left to
  // fire later and no-op against an already-null armedCode.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.formError || Object.keys(state.fieldErrors).length > 0) {
      setArmedCode(null);
      setSkipReasonId("");
    }
  }

  useEffect(() => clearArmTimer, []);

  const clickable = useMemo(
    () =>
      new Set(
        stages
          .filter((s) => canTransition(currentStageCode, s.code, isSuperAdmin))
          .map((s) => s.code),
      ),
    [stages, currentStageCode, isSuperAdmin],
  );

  const err = (field: string) => {
    const key = state.fieldErrors[field];
    return key ? t(`error.${key}`) : undefined;
  };

  const arm = (code: string) => {
    clearArmTimer();
    setArmedCode(code);
    timeoutRef.current = setTimeout(() => setArmedCode(null), ARM_TIMEOUT_MS);
  };

  const commit = (targetCode: string, reasonId: string) => {
    clearArmTimer();
    const target = stages.find((s) => s.code === targetCode);
    if (!target) return;

    const fd = new FormData();
    fd.set("stageId", target.id);
    fd.set("skipReasonId", reasonId);
    formAction(fd);

    setArmedCode(null);
    setSkipReasonId("");
  };

  const handleSelect = (code: string) => {
    if (pending) return;

    if (armedCode === code) {
      // A skip variant's second decision is the reason picker below, not a retap.
      if (isSkipStage(code)) return;
      commit(code, "");
      return;
    }

    arm(code);
  };

  const armedStage = armedCode ? stages.find((s) => s.code === armedCode) : null;
  const showSkipPicker = armedCode !== null && isSkipStage(armedCode);

  return (
    <div className="grid gap-2.5">
      <div className={pending ? "pointer-events-none opacity-60" : ""}>
        <StageRail
          stages={rail}
          onSelect={handleSelect}
          clickable={clickable}
          armedCode={armedCode}
        />
      </div>

      {armedStage && !showSkipPicker && (
        <p aria-live="polite" className="text-[11px] text-ink-2">
          {t("tapToConfirm", { stage: armedStage.labelEn })}
        </p>
      )}

      {showSkipPicker && armedCode && (
        <Field label={t("skipReason")} htmlFor="skipReasonId" error={err("skipReasonId")}>
          <SelectInput
            id="skipReasonId"
            value={skipReasonId}
            disabled={pending}
            onChange={(e) => {
              const id = e.target.value;
              setSkipReasonId(id);
              if (id) commit(armedCode, id);
            }}
          >
            <option value="">{t("chooseSkipReason")}</option>
            {skipReasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.labelEn}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {(state.formError || state.fieldErrors.stageId) && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError ?? state.fieldErrors.stageId}`)}
        </p>
      )}
    </div>
  );
}
