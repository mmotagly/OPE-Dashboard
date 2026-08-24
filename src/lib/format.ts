/** Shared formatters. Data is always English — only chrome is localised. */

export function km(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function money(value: number | null | undefined, currency = "EGP"): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)} ${currency}`;
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Minutes -> "2d 4h 13m". Matches fn_format_minutes in the database. */
export function duration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const m = Math.max(0, Math.floor(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${mm}m`].filter(Boolean).join(" ");
}

/**
 * A stored `timestamptz` as the value a `datetime-local` input expects, in the
 * caller's own timezone. Client-side only — on the server this renders in the
 * server's zone, which is not the one the user is reading.
 */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * Document expiry, for licences and tourism IDs. Amber inside 30 days, red once
 * the date has passed. Purely presentational — nothing in the database tracks
 * this, so there is no view to defer to.
 */
export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryState = "expired" | "expiring" | "ok" | "unknown";

export function expiryState(
  date: string | null | undefined,
  today = new Date(),
): ExpiryState {
  if (!date) return "unknown";
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "unknown";

  const midnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const days = Math.floor((parsed - midnight) / 86_400_000);

  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "expiring";
  return "ok";
}

export const expiryTone = (s: ExpiryState): "neutral" | "warn" | "stop" =>
  s === "expired" ? "stop" : s === "expiring" ? "warn" : "neutral";

export type PmStatus =
  | "never_serviced"
  | "no_km_data"
  | "overdue"
  | "due_now"
  | "due_soon"
  | "ok";

export const pmTone = (s: PmStatus): "go" | "warn" | "stop" | "idle" =>
  s === "overdue" ? "stop" : s === "due_now" || s === "due_soon" ? "warn" : s === "ok" ? "go" : "idle";

/** operation_status codes (0009). `completed` = go ("completed, paid" in the
 * design system's own table); `operating` = warn — a deliberate extension of
 * that table (see CLAUDE.md §5) so a dispatcher can tell "still running"
 * apart from "finished" at a glance, not just by reading the pill text; both
 * were "go" before this. "Overdue, skipped, under repair" = stop, per that
 * same table — under_maintenance is its "under repair" and cancelled_by_* is
 * its "skipped". Planned hasn't happened yet, so it's neutral rather than
 * either. */
export const operationTone = (code: string): "go" | "warn" | "stop" | "idle" =>
  code === "completed"
    ? "go"
    : code === "operating"
      ? "warn"
      : code === "under_maintenance" || code.startsWith("cancelled_by_")
        ? "stop"
        : "idle";

/** operation_status codes (snake_case) -> next-intl keys under `status.*`. */
export const OPERATION_STATUS_KEY: Record<string, string> = {
  planned: "planned",
  operating: "operating",
  completed: "completed",
  cancelled_by_vendor: "cancelledByVendor",
  cancelled_by_tmf: "cancelledByTmf",
  cancelled_by_ope: "cancelledByOpe",
  under_maintenance: "underMaintenance",
};

/** Translated label when one exists (mirrors shift_type's convention), else
 * the DB label as-is. Works with either useTranslations or getTranslations —
 * both return the same callable-plus-`.has` shape. Lives here rather than in
 * operations/queries.ts because that module imports the server Supabase
 * client, and this is called from a client component (operation-form.tsx). */
export function statusLabel(
  tStatus: { has: (key: string) => boolean } & ((key: string) => string),
  status: { code: string; labelEn: string } | null,
): string | null {
  if (!status) return null;
  const key = OPERATION_STATUS_KEY[status.code] ?? status.code;
  return tStatus.has(key) ? tStatus(key) : status.labelEn;
}
