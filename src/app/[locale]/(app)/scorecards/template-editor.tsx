"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FormActions, SelectInput } from "@/components/ui/field";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { percent } from "@/lib/format";
import { createTemplate, saveTemplate } from "./actions";
import type { ScorecardSection, VendorOption } from "./queries";

type DraftLine = { key: string; id: string | null; kpiName: string; metricWeight: string };
type DraftSection = {
  key: string;
  id: string | null;
  sectionName: string;
  sectionWeight: string;
  lines: DraftLine[];
};

let nextKey = 0;
const newKey = () => `new-${nextKey++}`;

/**
 * The vendor's own KPI set. Sections, KPI names and weights are all per vendor —
 * there is no shared list to pick from, so everything here is free-form.
 *
 * The whole tree is posted in one field and the action reconciles it, which
 * keeps adding, renaming, reordering and removing to a single save.
 *
 * With no `scorecardId` this is creating a template: the vendor picker appears
 * and the save inserts the scorecard row first. Without a template
 * fn_open_month has nothing to copy, so this is where the invoicing chain
 * starts.
 */
export function TemplateEditor({
  scorecardId,
  sections,
  canEdit,
  vendorsWithoutTemplate = [],
}: {
  /** Absent when creating. */
  scorecardId?: string;
  sections: ScorecardSection[];
  canEdit: boolean;
  /** Create mode only — vendors that do not already have a template. */
  vendorsWithoutTemplate?: VendorOption[];
}) {
  const t = useTranslations("scorecard");
  const tCommon = useTranslations("common");

  const creating = scorecardId === undefined;

  const [state, formAction, pending] = useActionState(
    creating ? createTemplate : saveTemplate.bind(null, scorecardId),
    EMPTY_FORM_STATE,
  );

  const [vendorId, setVendorId] = useState("");

  const [draft, setDraft] = useState<DraftSection[]>(() =>
    sections.map((section) => ({
      key: section.id,
      id: section.id,
      sectionName: section.sectionName,
      sectionWeight: String(section.sectionWeight),
      lines: section.lines.map((line) => ({
        key: line.id,
        id: line.id,
        kpiName: line.kpiName,
        metricWeight: String(line.metricWeight),
      })),
    })),
  );

  const patchSection = (key: string, patch: Partial<DraftSection>) =>
    setDraft((d) => d.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const patchLine = (sectionKey: string, lineKey: string, patch: Partial<DraftLine>) =>
    setDraft((d) =>
      d.map((s) =>
        s.key === sectionKey
          ? { ...s, lines: s.lines.map((l) => (l.key === lineKey ? { ...l, ...patch } : l)) }
          : s,
      ),
    );

  const move = (index: number, delta: number) =>
    setDraft((d) => {
      const target = index + delta;
      if (target < 0 || target >= d.length) return d;
      const next = [...d];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const weightTotal = draft.reduce((sum, s) => sum + (Number(s.sectionWeight) || 0), 0);

  const payload = JSON.stringify({
    sections: draft.map((s) => ({
      id: s.id,
      sectionName: s.sectionName,
      sectionWeight: Number(s.sectionWeight) || 0,
      lines: s.lines.map((l) => ({
        id: l.id,
        kpiName: l.kpiName,
        metricWeight: Number(l.metricWeight) || 0,
      })),
    })),
  });

  const input =
    "rounded-control border border-hairline bg-canvas px-2.5 py-1.5 text-[13px] text-ink disabled:opacity-60";

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="draft" value={payload} />

      {state.formError && (
        <p
          role="alert"
          className="rounded-control border border-stop bg-stop-soft px-3 py-2.5 text-[13px] text-stop-text"
        >
          {t(`error.${state.formError}`)}
        </p>
      )}

      {creating && (
        <Field
          label={t("field.vendor")}
          htmlFor="vendorId"
          error={state.fieldErrors.vendorId ? t("error.required") : undefined}
        >
          <SelectInput
            id="vendorId"
            name="vendorId"
            required
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">{t("chooseVendor")}</option>
            {vendorsWithoutTemplate.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorCode} · {v.vendorName}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {creating && vendorsWithoutTemplate.length === 0 && (
        <p className="text-[12.5px] text-ink-3">{t("allVendorsHaveTemplates")}</p>
      )}

      {draft.length === 0 && (
        <p className="text-[13px] text-ink-3">{t("noSectionsYet")}</p>
      )}

      {draft.map((section, index) => (
        <div key={section.key} className="rounded-control border border-hairline">
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-raise px-3 py-2.5">
            <input
              value={section.sectionName}
              disabled={!canEdit}
              onChange={(e) => patchSection(section.key, { sectionName: e.target.value })}
              aria-label={t("field.sectionName")}
              placeholder={t("field.sectionName")}
              className={`${input} min-w-0 flex-1 font-medium`}
            />
            <input
              type="number"
              min={0}
              step="0.001"
              value={section.sectionWeight}
              disabled={!canEdit}
              onChange={(e) => patchSection(section.key, { sectionWeight: e.target.value })}
              aria-label={t("field.sectionWeight")}
              className={`${input} tnum w-20 text-end`}
            />

            {canEdit && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("moveUp")}
                  className="grid h-7 w-7 place-items-center rounded-control border border-hairline text-[12px] text-ink-2 disabled:opacity-30 hover:bg-raise"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === draft.length - 1}
                  aria-label={t("moveDown")}
                  className="grid h-7 w-7 place-items-center rounded-control border border-hairline text-[12px] text-ink-2 disabled:opacity-30 hover:bg-raise"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => d.filter((s) => s.key !== section.key))
                  }
                  aria-label={t("removeSection")}
                  className="grid h-7 w-7 place-items-center rounded-control border border-hairline text-[12px] text-stop-text hover:bg-stop-soft"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          <ul>
            {section.lines.map((line) => (
              <li
                key={line.key}
                className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0"
              >
                <input
                  value={line.kpiName}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchLine(section.key, line.key, { kpiName: e.target.value })
                  }
                  aria-label={t("field.kpiName")}
                  placeholder={t("field.kpiName")}
                  className={`${input} min-w-0 flex-1`}
                />
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={line.metricWeight}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchLine(section.key, line.key, { metricWeight: e.target.value })
                  }
                  aria-label={t("field.metricWeight")}
                  className={`${input} tnum w-20 text-end`}
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      patchSection(section.key, {
                        lines: section.lines.filter((l) => l.key !== line.key),
                      })
                    }
                    aria-label={t("removeLine")}
                    className="grid h-7 w-7 place-items-center rounded-control border border-hairline text-[12px] text-stop-text hover:bg-stop-soft"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          {canEdit && (
            <div className="px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  patchSection(section.key, {
                    lines: [
                      ...section.lines,
                      { key: newKey(), id: null, kpiName: "", metricWeight: "0" },
                    ],
                  })
                }
                className="text-[12.5px] text-ink-2 hover:text-ink"
              >
                {t("addLine")}
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Micro bar={false} tone={Math.abs(weightTotal - 100) > 0.001 ? "warn" : "neutral"}>
          {t("sectionsWeightTotal", { weight: percent(weightTotal, 0) })}
        </Micro>
        {canEdit && (
          <button
            type="button"
            onClick={() =>
              setDraft((d) => [
                ...d,
                {
                  key: newKey(),
                  id: null,
                  sectionName: "",
                  sectionWeight: "0",
                  lines: [],
                },
              ])
            }
            className="text-[12.5px] text-ink-2 hover:text-ink"
          >
            {t("addSection")}
          </button>
        )}
      </div>

      {canEdit && (
        <FormActions>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || (creating && vendorId === "")}
          >
            {pending ? tCommon("loading") : creating ? t("createTemplate") : t("saveTemplate")}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
