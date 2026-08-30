"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Micro } from "@/components/ui/micro";
import { SelectInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import type { LookupOption } from "@/lib/lookups";
import { editRfrIssue } from "./actions";
import type { RfrIssueRow } from "./queries";

/**
 * The RFR's issue list. Each line can be skipped on its own, and the table's
 * check constraint refuses a skip with no reason — so the reason picker is part
 * of the same submit rather than a follow-up.
 */
export function IssueList({
  rfrId,
  issues,
  skipReasons,
  canEdit,
}: {
  rfrId: string;
  issues: RfrIssueRow[];
  skipReasons: LookupOption[];
  canEdit: boolean;
}) {
  const t = useTranslations("rfr");
  const [state, formAction, pending] = useActionState(
    editRfrIssue.bind(null, rfrId),
    EMPTY_FORM_STATE,
  );
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [reasonId, setReasonId] = useState("");

  if (issues.length === 0) {
    return <p className="text-[13px] text-ink-3">{t("noIssues")}</p>;
  }

  return (
    <div className={`grid gap-2 ${pending ? "opacity-60" : ""}`}>
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="rounded-control border border-hairline bg-canvas px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={`text-[13.5px] ${issue.isSkipped ? "text-ink-3 line-through" : ""}`}
            >
              {issue.issueTypeLabel}
            </span>

            {issue.isSkipped && issue.skipReasonLabel && (
              <Micro tone="stop">{issue.skipReasonLabel}</Micro>
            )}

            {canEdit && (
              <span className="ms-auto">
                {issue.isSkipped ? (
                  <form action={formAction}>
                    <input type="hidden" name="intent" value="unskip" />
                    <input type="hidden" name="rfrIssueId" value={issue.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="text-[12.5px] text-ink-2 hover:text-ink disabled:opacity-40"
                    >
                      {t("unskipIssue")}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFor(openFor === issue.id ? null : issue.id);
                      setReasonId("");
                    }}
                    className="text-[12.5px] text-ink-2 hover:text-ink"
                  >
                    {t("skipIssue")}
                  </button>
                )}
              </span>
            )}
          </div>

          {canEdit && openFor === issue.id && !issue.isSkipped && (
            <form action={formAction} className="mt-2.5 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="skip" />
              <input type="hidden" name="rfrIssueId" value={issue.id} />
              <div className="min-w-[180px] flex-1">
                <SelectInput
                  name="skipReasonId"
                  aria-label={t("skipReason")}
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                >
                  <option value="">{t("chooseSkipReason")}</option>
                  {skipReasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.labelEn}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <Button type="submit" variant="danger" disabled={pending || reasonId === ""}>
                {t("skipIssue")}
              </Button>
            </form>
          )}
        </div>
      ))}

      {(state.formError || state.fieldErrors.skipReasonId) && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError ?? state.fieldErrors.skipReasonId}`)}
        </p>
      )}
    </div>
  );
}
