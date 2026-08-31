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

/**
 * RFC4180-ish parser for the import side (roadmap: CSV Import/Export).
 * Handles quoted fields (embedded commas/newlines, doubled `""` for a
 * literal quote), CRLF or LF line endings, and a missing trailing newline.
 * Deliberately not a streaming parser — imports here are hundreds of rows,
 * not the file sizes that would need one.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // A UTF-8 BOM (written by toCsv, and by Excel's own "CSV UTF-8" export)
  // lands as a literal character on the first cell if not stripped.
  if (rows.length > 0 && rows[0].length > 0) {
    rows[0][0] = rows[0][0].replace(/^﻿/, "");
  }
  return rows;
}
