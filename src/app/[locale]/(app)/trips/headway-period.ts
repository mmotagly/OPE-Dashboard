/**
 * Pure calendar arithmetic for the headway report's day/week/month picker —
 * not domain business logic (unlike leg time, round-trip time or the
 * headway calculation itself, all of which stay in SQL), so it's fine here.
 */

export type HeadwayPeriod = "day" | "week" | "month";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The calendar day / Mon-Sun week / calendar month containing `anchor`, as
 * an inclusive [from, to] date range. */
export function headwayRange(period: HeadwayPeriod, anchor: string): { from: string; to: string } {
  const d = new Date(`${anchor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return headwayRange(period, toIso(new Date()));

  if (period === "day") return { from: anchor, to: anchor };

  if (period === "week") {
    const mondayOffset = (d.getDay() + 6) % 7; // days since Monday, Sunday=6
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toIso(monday), to: toIso(sunday) };
  }

  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toIso(first), to: toIso(last) };
}
