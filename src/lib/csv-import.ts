import { parseCsv } from "./csv";
import type { createClient } from "./supabase/server";

/**
 * Shared engine behind every module's CSV import (roadmap: CSV
 * Import/Export). Each module supplies its own column mapping, FK-code
 * resolution, and row validator (its existing zod schema — never a
 * parallel one); this file only owns the generic parts: turning file text
 * into header-keyed records, and running best-effort per-row inserts while
 * collecting a report — the same "some rows fail, the rest still commit"
 * shape as the bulk-planning flow (operations/actions.ts, createBulkPlanned).
 */

export type ImportRowError = { row: number; message: string };
export type ImportReport = {
  totalRows: number;
  succeeded: number;
  failed: number;
  /** Match rows the user explicitly chose to skip — not a failure. */
  skipped: number;
  errors: ImportRowError[];
};

export type CsvRecord = { rowNumber: number; record: Record<string, string> };

/** Action state for the shared `CsvImportForm` client component. */
export type ImportFormState = {
  /** Message key from the `csvImport` namespace, or null. */
  formError: string | null;
  report: ImportReport | null;
};

export const EMPTY_IMPORT_STATE: ImportFormState = { formError: null, report: null };

/**
 * Row numbers are 1-based and count the header row as row 1, matching what
 * a person sees with the file open in Excel — so "row 3 failed" points at
 * the same row they'd click on to fix it. Blank rows (Excel often leaves a
 * trailing one) are skipped silently, not reported as failures.
 */
export function csvTextToRecords(text: string): { header: string[]; rows: CsvRecord[] } {
  // toCsv() writes a leading `sep=,` directive (Excel-only, forces
  // comma-delimited parsing regardless of OS regional settings) before
  // the BOM+header — strip it back out here so a round-tripped export/
  // template file parses the same as one without it. Excel doesn't count
  // this line as row 1 either, so stripping it first keeps this
  // function's own row numbering (below) aligned with what a person sees
  // with the file open.
  const withoutSepDirective = text.replace(/^﻿?sep=,\r?\n/, "");
  const table = parseCsv(withoutSepDirective);
  if (table.length === 0) return { header: [], rows: [] };

  const [header, ...body] = table;
  const rows = body
    .map((cells, i) => ({ rowNumber: i + 2, cells }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""))
    .map(({ rowNumber, cells }) => ({
      rowNumber,
      record: Object.fromEntries(header.map((h, idx) => [h.trim(), (cells[idx] ?? "").trim()])),
    }));

  return { header, rows };
}

/**
 * One query per code column per import run, not one per row — a code
 * (vehicle_code, driver_code, ...) resolved to its id, keyed exactly as it
 * appears in the column so callers can `.get(rawCsvValue)` directly. Table
 * name is a runtime string (any module can supply one), so this reaches
 * past the typed client the same one-line-wide way v_audit_log's bridge
 * did before its migration ran — except here it's permanent, since the
 * table/column pair is only known at the call site, not statically.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadCodeMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  codeColumn: string,
): Promise<Map<string, string>> {
  const { data, error } = await (supabase as any).from(table).select(`id, ${codeColumn}`);
  if (error) throw error;
  return new Map((data ?? []).map((r: Record<string, string>) => [r[codeColumn], r.id]));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Turns a category's active `LookupOption[]` (from `loadLookups`) into a
 * code -> id map, the same shape `loadCodeMap` returns for plain tables.
 * Kept separate because `lookups` rows are only unique per (category, code)
 * — a raw `loadCodeMap("lookups", "code")` would collide codes across
 * categories, so lookup categories always resolve through `loadLookups`
 * first and this just reshapes the result. */
export function codeMapFromLookups(options: { id: string; code: string }[]): Map<string, string> {
  return new Map(options.map((o) => [o.code, o.id]));
}

/**
 * Preview + decide, then commit — every module's import goes through this
 * two-step flow, never a one-shot insert. Step 1 (`buildPreview`)
 * classifies each row against the database *without writing anything*;
 * step 2 (`runPreviewedImport`) re-derives that same classification fresh
 * (never trusting what the client claims a row is) and acts on the
 * decision the user actually made for each match row.
 */

export type PreviewRowStatus = "new" | "match" | "error";

export type PreviewRow = {
  rowNumber: number;
  /** The module's natural-key column value for this row, for display. */
  code: string;
  status: PreviewRowStatus;
  /** Existing record id — present only when status === "match". */
  matchId?: string;
  /** Validation/resolution failure — present only when status === "error". */
  error?: string;
  /** The raw CSV row, so the preview table can show a column or two of
   * extra context (plate number, vendor code, ...) without the engine
   * needing to know which columns matter to which module. */
  record: Record<string, string>;
};

export type ImportPreview = {
  /** Resubmitted verbatim on confirm — the source of truth is re-parsed
   * fresh server-side, never the client's row classification. */
  csvText: string;
  totalRows: number;
  newCount: number;
  matchCount: number;
  errorCount: number;
  rows: PreviewRow[];
};

export type PreviewFormState = {
  /** Message key from the `csvImport` namespace, or null. */
  formError: string | null;
  preview: ImportPreview | null;
};

export const EMPTY_PREVIEW_STATE: PreviewFormState = { formError: null, preview: null };

export type RowValidation<T> =
  | { error: string; data?: undefined }
  | { error: null; data: T };

/**
 * Classifies every row as new/match/error against `existingCodes`, without
 * writing anything. `validateRow` is the *same* function `runPreviewedImport`
 * calls at commit time — sharing it is what guarantees the preview can
 * never promise something the commit step then does differently.
 */
export async function buildPreview<T>(
  formData: FormData,
  codeColumn: string,
  existingCodes: Map<string, string>,
  validateRow: (record: Record<string, string>) => Promise<RowValidation<T>>,
): Promise<{ formError: string; preview: null } | { formError: null; preview: ImportPreview }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "noFile", preview: null };
  }

  const csvText = await file.text();
  const { rows } = csvTextToRecords(csvText);

  const previewRows: PreviewRow[] = [];
  for (const { rowNumber, record } of rows) {
    const code = record[codeColumn] ?? "";
    const result = await validateRow(record);

    if (result.error !== null) {
      previewRows.push({ rowNumber, code, status: "error", error: result.error, record });
      continue;
    }

    const matchId = existingCodes.get(code);
    previewRows.push(
      matchId
        ? { rowNumber, code, status: "match", matchId, record }
        : { rowNumber, code, status: "new", record },
    );
  }

  return {
    formError: null,
    preview: {
      csvText,
      totalRows: previewRows.length,
      newCount: previewRows.filter((r) => r.status === "new").length,
      matchCount: previewRows.filter((r) => r.status === "match").length,
      errorCount: previewRows.filter((r) => r.status === "error").length,
      rows: previewRows,
    },
  };
}

/**
 * Commits the decisions made on a preview. Reads `csvText` back off the
 * form and re-parses/re-validates/re-classifies from scratch — the only
 * things trusted from the client are the explicit per-row decisions
 * (`decision_<rowNumber>`), never the earlier classification, since
 * database state can have changed between preview and confirm.
 *
 * A "new" row is always created — there was nothing to decide. A "match"
 * row requires a decision: `skip`, `update`, or `create:<newCode>` (the
 * replacement code the user typed in when choosing "create as new" — a
 * true duplicate of the original code is impossible under the column's
 * unique constraint, so that choice always carries a different code).
 * Anything else (including no decision at all) is reported as a failure
 * for that row rather than silently skipped, so a UI bug can never cause
 * a row to vanish without explanation.
 */
export async function runPreviewedImport<T>(
  formData: FormData,
  codeColumn: string,
  existingCodes: Map<string, string>,
  validateRow: (record: Record<string, string>) => Promise<RowValidation<T>>,
  insertOne: (data: T, rowNumber: number, codeOverride?: string) => Promise<string | null>,
  updateOne: (
    matchId: string,
    data: T,
    record: Record<string, string>,
    rowNumber: number,
  ) => Promise<string | null>,
): Promise<ImportReport> {
  const csvText = String(formData.get("csvText") ?? "");
  const { rows } = csvTextToRecords(csvText);

  const errors: ImportRowError[] = [];
  let succeeded = 0;
  let skipped = 0;

  /** Tallies an insert/update attempt's result — a returned message is a
   * failure, `null` is a success. */
  const tally = (rowNumber: number, message: string | null) => {
    if (message) {
      errors.push({ row: rowNumber, message });
    } else {
      succeeded++;
    }
  };

  for (const { rowNumber, record } of rows) {
    try {
      const result = await validateRow(record);
      if (result.error !== null) {
        errors.push({ row: rowNumber, message: result.error });
        continue;
      }

      const code = record[codeColumn] ?? "";
      const matchId = existingCodes.get(code);

      if (!matchId) {
        tally(rowNumber, await insertOne(result.data, rowNumber));
        continue;
      }

      const decision = String(formData.get(`decision_${rowNumber}`) ?? "");

      if (decision === "skip") {
        skipped++;
        continue;
      }
      if (decision === "update") {
        tally(rowNumber, await updateOne(matchId, result.data, record, rowNumber));
        continue;
      }
      if (decision.startsWith("create:")) {
        const newCode = decision.slice("create:".length).trim();
        if (!newCode || newCode === code) {
          errors.push({
            row: rowNumber,
            message: "A different code is required to create this row as a new record",
          });
          continue;
        }
        if ([...existingCodes.keys()].includes(newCode)) {
          errors.push({ row: rowNumber, message: `Code "${newCode}" is already in use` });
          continue;
        }
        tally(rowNumber, await insertOne(result.data, rowNumber, newCode));
        continue;
      }

      errors.push({ row: rowNumber, message: "No decision was made for this matching row" });
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof Error ? e.message : "Import failed" });
    }
  }

  return { totalRows: rows.length, succeeded, failed: errors.length, skipped, errors };
}
