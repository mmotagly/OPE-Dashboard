"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { percent } from "@/lib/format";
import { saveAchievedPoints } from "./actions";
import type { ScorecardSection } from "./queries";

/**
 * Inline achieved-points entry.
 *
 * Each line is capped at its own KPI weight by trg_cap_achieved. The cap is
 * shown beside every input and the input carries `max`, but the value is sent
 * exactly as typed — the database is what enforces it, and a value over the
 * weight comes back capped after saving.
 *
 * Section subtotals below are a plain sum of that section's own lines; no view
 * exposes them. The scorecard total is not computed here at all — it comes from
 * v_scorecard_totals and is rendered by the drawer.
 */
export function AchievedEditor({
  scorecardId,
  sections,
  canEdit,
}: {
  scorecardId: string;
  sections: ScorecardSection[];
  canEdit: boolean;
}) {
  const t = useTranslations("scorecard");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(
    saveAchievedPoints.bind(null, scorecardId),
    EMPTY_FORM_STATE,
  );

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sections.flatMap((section) =>
        section.lines.map((line) => [
          line.id,
          line.achievedPoints === null ? "" : String(line.achievedPoints),
        ]),
      ),
    ),
  );

  /** Sum of this section's entered points — arithmetic, not a stored figure. */
  const sectionPoints = (section: ScorecardSection) =>
    section.lines.reduce((sum, line) => {
      const raw = values[line.id];
      const entered = raw === "" || raw === undefined ? 0 : Number(raw);
      if (!Number.isFinite(entered)) return sum;
      // mirrors the cap so the running subtotal matches what will be stored
      return sum + Math.min(entered, line.metricWeight);
    }, 0);

  if (sections.length === 0) {
    return <p className="text-[13px] text-ink-3">{t("noSections")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-4">
      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      {sections.map((section) => {
        const points = sectionPoints(section);
        return (
          <div key={section.id} className="rounded-control border border-hairline">
            <div className="flex flex-wrap items-baseline gap-2.5 border-b border-hairline bg-raise px-3 py-2.5">
              <span className="text-[13px] font-semibold">{section.sectionName}</span>
              <Micro bar={false}>
                {t("sectionWeight", { weight: percent(section.sectionWeight, 0) })}
              </Micro>
              <span className="tnum ms-auto text-[12.5px] text-ink-2">
                {t("sectionScore", { score: percent(points / 100, 1) })}
              </span>
            </div>

            <ul>
              {section.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                    {line.kpiName}
                  </span>

                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      name={`line:${line.id}`}
                      min={0}
                      max={line.metricWeight}
                      step="0.001"
                      disabled={!canEdit}
                      value={values[line.id] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [line.id]: e.target.value }))
                      }
                      aria-label={line.kpiName}
                      className="tnum w-20 rounded-control border border-hairline bg-canvas px-2.5 py-1.5 text-end text-[13px] text-ink disabled:opacity-60"
                    />
                    <span className="tnum text-[12px] text-ink-3">
                      {t("outOf", { weight: line.metricWeight })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="text-[10.5px] text-ink-3">{t("capNote")}</p>

      {canEdit && (
        <FormActions>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? tCommon("loading") : t("savePoints")}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
