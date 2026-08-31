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
  const table = parseCsv(text);
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
 * Runs `insertOne` for every record, best-effort — one row's failure
 * (a thrown Error, or a returned error string) doesn't stop the rest.
 */
export async function runImport(
  rows: CsvRecord[],
  insertOne: (record: Record<string, string>, rowNumber: number) => Promise<string | null>,
): Promise<ImportReport> {
  const errors: ImportRowError[] = [];
  let succeeded = 0;

  for (const { rowNumber, record } of rows) {
    try {
      const message = await insertOne(record, rowNumber);
      if (message) {
        errors.push({ row: rowNumber, message });
      } else {
        succeeded++;
      }
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof Error ? e.message : "Import failed" });
    }
  }

  return { totalRows: rows.length, succeeded, failed: errors.length, errors };
}

/**
 * The full server-action boilerplate every module's import action repeats:
 * pull the uploaded file off the FormData, parse it, run it. Returns a
 * message key (for `ImportFormState.formError`) instead of a report only
 * when there's no file to even try parsing.
 */
export async function importFromFormData(
  formData: FormData,
  processRow: (record: Record<string, string>, rowNumber: number) => Promise<string | null>,
): Promise<{ formError: string; report: null } | { formError: null; report: ImportReport }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "noFile", report: null };
  }
  const text = await file.text();
  const { rows } = csvTextToRecords(text);
  const report = await runImport(rows, processRow);
  return { formError: null, report };
}
