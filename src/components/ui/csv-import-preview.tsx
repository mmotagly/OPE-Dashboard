"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EMPTY_IMPORT_STATE, type ImportFormState, type ImportPreview } from "@/lib/csv-import";
import { ImportReportView } from "@/components/ui/csv-import-form";

type Decision = "" | "skip" | "update" | "create";

/**
 * Step 2 of CSV import. Every "match" row (a CSV row whose code already
 * belongs to an existing record) needs an explicit decision before the
 * import can run — there is deliberately no default, so nothing is ever
 * skipped or overwritten just because a row wasn't looked at. "New" rows
 * need no decision; "error" rows can't proceed either way and show their
 * message inline.
 */
export function CsvImportPreview({
  preview,
  confirmAction,
  extraColumns,
}: {
  preview: ImportPreview;
  confirmAction: (prev: ImportFormState, formData: FormData) => Promise<ImportFormState>;
  extraColumns: { key: string; header: string }[];
}) {
  const t = useTranslations("csvImport");
  const [state, formAction, pending] = useActionState(confirmAction, EMPTY_IMPORT_STATE);

  const matchRows = preview.rows.filter((r) => r.status === "match");

  const [decisions, setDecisions] = useState<Record<number, Decision>>(() =>
    Object.fromEntries(matchRows.map((r) => [r.rowNumber, ""])),
  );
  const [newCodes, setNewCodes] = useState<Record<number, string>>({});

  const setDecision = (rowNumber: number, decision: Decision, suggestedCode: string) => {
    setDecisions((d) => ({ ...d, [rowNumber]: decision }));
    if (decision === "create") {
      setNewCodes((n) => (n[rowNumber] ? n : { ...n, [rowNumber]: `${suggestedCode}-2` }));
    }
  };

  const bulkSet = (decision: "skip" | "update") =>
    setDecisions((d) => {
      const next = { ...d };
      for (const r of matchRows) next[r.rowNumber] = decision;
      return next;
    });

  const unresolved = matchRows.filter((r) => !decisions[r.rowNumber]);
  const readyCount =
    preview.newCount +
    matchRows.filter((r) => decisions[r.rowNumber] === "skip" || decisions[r.rowNumber] === "update")
      .length +
    matchRows.filter((r) => decisions[r.rowNumber] === "create" && newCodes[r.rowNumber]?.trim()).length;

  if (state.report) {
    return <ImportReportView report={state.report} />;
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="csvText" value={preview.csvText} />
      {matchRows.map((r) => {
        const decision = decisions[r.rowNumber];
        const value = decision === "create" ? `create:${newCodes[r.rowNumber] ?? ""}` : decision;
        return <input key={r.rowNumber} type="hidden" name={`decision_${r.rowNumber}`} value={value ?? ""} />;
      })}

      <p className="tnum text-[13px] text-ink-2">
        {t("previewSummary", {
          total: preview.totalRows,
          new: preview.newCount,
          match: preview.matchCount,
          errors: preview.errorCount,
        })}
      </p>

      {matchRows.length > 0 && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => bulkSet("skip")}
            className="text-[12px] text-ink-2 transition-colors hover:text-ink"
          >
            {t("skipAll")}
          </button>
          <button
            type="button"
            onClick={() => bulkSet("update")}
            className="text-[12px] text-ink-2 transition-colors hover:text-ink"
          >
            {t("updateAll")}
          </button>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto rounded-control border border-hairline">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-surface text-ink-3">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">{t("row")}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t("code")}</th>
              {extraColumns.map((c) => (
                <th key={c.key} className="px-2 py-1.5 text-start font-medium">
                  {c.header}
                </th>
              ))}
              <th className="px-2 py-1.5 text-start font-medium">{t("status")}</th>
              <th className="px-2 py-1.5 text-end font-medium">{t("decision")}</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => (
              <tr key={r.rowNumber} className="border-t border-hairline">
                <td className="tnum px-2 py-1.5 text-ink-3">{r.rowNumber}</td>
                <td className="tnum px-2 py-1.5 font-medium">{r.code || "—"}</td>
                {extraColumns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-ink-2">
                    {r.record[c.key] || "—"}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  {r.status === "new" && <Pill tone="go">{t("statusNew")}</Pill>}
                  {r.status === "match" && <Pill tone="warn">{t("statusMatch")}</Pill>}
                  {r.status === "error" && (
                    <>
                      <Pill tone="stop">{t("statusError")}</Pill>
                      <p className="mt-1 max-w-[220px] text-[11px] text-stop-text">{r.error}</p>
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5 text-end">
                  {r.status === "match" && (
                    <div className="grid justify-items-end gap-1">
                      <select
                        value={decisions[r.rowNumber] ?? ""}
                        onChange={(e) => setDecision(r.rowNumber, e.target.value as Decision, r.code)}
                        className="rounded-control border border-hairline bg-canvas px-1.5 py-1 text-[12px]"
                      >
                        <option value="">{t("chooseDecision")}</option>
                        <option value="skip">{t("decisionSkip")}</option>
                        <option value="update">{t("decisionUpdate")}</option>
                        <option value="create">{t("decisionCreate")}</option>
                      </select>
                      {decisions[r.rowNumber] === "create" && (
                        <input
                          type="text"
                          value={newCodes[r.rowNumber] ?? ""}
                          onChange={(e) =>
                            setNewCodes((n) => ({ ...n, [r.rowNumber]: e.target.value }))
                          }
                          placeholder={t("newCodePlaceholder")}
                          className="tnum w-32 rounded-control border border-hairline bg-canvas px-1.5 py-1 text-[12px]"
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unresolved.length > 0 && (
        <p className="text-[12px] text-warn-text">{t("unresolvedHint", { count: unresolved.length })}</p>
      )}

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(state.formError)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending || unresolved.length > 0}>
          {pending ? t("uploading") : t("importCount", { count: readyCount })}
        </Button>
        <Button type="button" onClick={() => window.location.reload()}>
          {t("back")}
        </Button>
      </div>
    </form>
  );
}
