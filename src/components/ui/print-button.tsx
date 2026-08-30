"use client";

/** Triggers the browser's native print dialog — "Save as PDF" is one of
 * its destinations on every major browser/OS, so this covers PDF export
 * without a server-side PDF-writing dependency. Hidden in the print
 * output itself via the `print:hidden` Tailwind variant. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-control border border-accent-fill bg-accent-fill px-3.5 py-2 text-[13px] font-medium text-on-accent transition-opacity hover:opacity-90"
    >
      {label}
    </button>
  );
}
