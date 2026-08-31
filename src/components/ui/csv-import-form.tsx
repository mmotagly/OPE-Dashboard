"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  EMPTY_PREVIEW_STATE,
  type ImportFormState,
  type ImportReport,
  type PreviewFormState,
} from "@/lib/csv-import";
import { CsvImportPreview } from "@/components/ui/csv-import-preview";

/**
 * Step 1 of CSV import: upload a file, get a preview of what it would do —
 * nothing is written to the database yet. `CsvImportPreview` (step 2) takes
 * over once a preview comes back, and owns the actual commit.
 */
export function CsvImportForm({
  previewAction,
  confirmAction,
  templateHref,
  extraColumns,
}: {
  previewAction: (prev: PreviewFormState, formData: FormData) => Promise<PreviewFormState>;
  confirmAction: (prev: ImportFormState, formData: FormData) => Promise<ImportFormState>;
  templateHref: string;
  /** Extra raw CSV columns to show for context in the preview table,
   * beyond the row's natural-key code — e.g. plate_number for vehicles. */
  extraColumns: { key: string; header: string }[];
}) {
  const t = useTranslations("csvImport");
  const [state, formAction, pending] = useActionState(previewAction, EMPTY_PREVIEW_STATE);

  if (state.preview) {
    return (
      <CsvImportPreview preview={state.preview} confirmAction={confirmAction} extraColumns={extraColumns} />
    );
  }

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
          {pending ? t("uploading") : t("preview")}
        </Button>
      </form>
    </div>
  );
}

/** Shared by the preview step's post-commit view — the same report shape
 * every module's import produces. */
export function ImportReportView({ report }: { report: ImportReport }) {
  const t = useTranslations("csvImport");

  return (
    <div className="grid gap-2 rounded-control border border-hairline p-3">
      <p className="tnum text-[13px] text-ink-2">
        {t("summary", { succeeded: report.succeeded, total: report.totalRows })}
      </p>
      {report.skipped > 0 && (
        <p className="tnum text-[12px] text-ink-3">{t("skippedSummary", { count: report.skipped })}</p>
      )}
      {report.errors.length === 0 ? (
        <p className="text-[12px] text-go-text">{t("allSucceeded")}</p>
      ) : (
        <ul className="grid max-h-64 gap-1 overflow-y-auto">
          {report.errors.map((e) => (
            <li key={e.row} className="tnum text-[12px] text-stop-text">
              {t("rowError", { row: e.row, message: e.message })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
