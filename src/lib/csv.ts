/**
 * Generic CSV builder for the export routes (roadmap item 7). Plain
 * client-safe utility — no framework dependency, no new npm package: CSV
 * already opens natively in Excel, so it covers "export to Excel" without
 * pulling in a spreadsheet-writing library for what's fundamentally
 * tabular data.
 */

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key])).join(","),
  );
  // \r\n and a leading BOM: Excel on Windows mis-decodes UTF-8 CSVs without
  // one, showing mangled Arabic/accented text instead of an error.
  return "﻿" + [headerLine, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
