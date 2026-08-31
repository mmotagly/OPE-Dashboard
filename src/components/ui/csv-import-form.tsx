"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EMPTY_IMPORT_STATE, type ImportFormState } from "@/lib/csv-import";

/**
 * Generic upload-CSV-and-report UI, shared by every module's import (roadmap
 * item 1). Each module supplies its own Server Action (built with
 * `importFromFormData` in csv-import.ts) and a template download link; this
 * component only owns the file input, the pending state, and rendering the
 * per-row error report the action returns.
 */
export function CsvImportForm({
  action,
  templateHref,
}: {
  action: (prev: ImportFormState, formData: FormData) => Promise<ImportFormState>;
  templateHref: string;
}) {
  const t = useTranslations("csvImport");
  const [state, formAction, pending] = useActionState(action, EMPTY_IMPORT_STATE);

  return (
    <div className="grid gap-4">
      <a
        href={templateHref}
        className="w-fit text-[13px] text-ink-2 underline underline-offset-2 transition-colors hover:text-ink"
      >
        {t("downloadTemplate")}
      </a>

      <form action={formAction} className="grid gap-3">
        <label className="grid gap-1.5 text-[13px] text-ink-2">
          {t("chooseFile")}
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded-control border border-hairline bg-surface px-3 py-2 text-[13px] text-ink file:me-3 file:rounded-control file:border-0 file:bg-elev file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-ink"
          />
        </label>

        {state.formError && (
          <p role="alert" className="text-[12px] text-stop-text">
            {t(state.formError)}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={pending} className="w-fit">
          {pending ? t("uploading") : t("submit")}
        </Button>
      </form>

      {state.report && (
        <div className="grid gap-2 rounded-control border border-hairline p-3">
          <p className="tnum text-[13px] text-ink-2">
            {t("summary", { succeeded: state.report.succeeded, total: state.report.totalRows })}
          </p>
          {state.report.errors.length === 0 ? (
            <p className="text-[12px] text-go-text">{t("allSucceeded")}</p>
          ) : (
            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {state.report.errors.map((e) => (
                <li key={e.row} className="tnum text-[12px] text-stop-text">
                  {t("rowError", { row: e.row, message: e.message })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
