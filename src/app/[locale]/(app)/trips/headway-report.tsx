import { getTranslations } from "next-intl/server";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { HeadwayRow, TripEntryRouteOption } from "./trip-queries";
import type { HeadwayPeriod } from "./headway-period";
import { HeadwayTable } from "./headway-table";

/**
 * A report, not a filterable record list — no FilterBar/SavedViews, per the
 * Phase 4 plan. `fn_trip_headway_report` (0023) does the actual computation;
 * the caller resolves the date range and fetches `rows` (shared with the
 * page's Headway tab-chip count, so it isn't fetched twice) — this only
 * renders the picker and the result.
 */
export async function HeadwayReport({
  routes,
  routeId,
  period,
  date,
  from,
  to,
  rows,
  extraQuery,
}: {
  routes: TripEntryRouteOption[];
  routeId: string;
  period: HeadwayPeriod;
  date: string;
  from: string;
  to: string;
  rows: HeadwayRow[];
  /** Query params (e.g. sort/dir) to carry through the picker's GET submit,
   * excluding entity/route/period/date which the form sets itself. */
  extraQuery: Record<string, string>;
}) {
  const t = await getTranslations("trips");

  return (
    <>
      <form
        method="get"
        className="flex flex-wrap items-end gap-2.5 border-b border-hairline px-4 py-3"
      >
        <input type="hidden" name="entity" value="headway" />
        {Object.entries(extraQuery).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

        <div className="grid gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-2">{t("field.route")}</label>
          <SelectInput name="route" defaultValue={routeId} className="w-auto">
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.routeCode} · {r.routeName}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="grid gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-2">{t("field.period")}</label>
          <SelectInput name="period" defaultValue={period} className="w-auto">
            <option value="day">{t("period.day")}</option>
            <option value="week">{t("period.week")}</option>
            <option value="month">{t("period.month")}</option>
          </SelectInput>
        </div>

        <div className="grid gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-2">{t("field.date")}</label>
          <TextInput type="date" name="date" defaultValue={date} className="w-auto" />
        </div>

        <Button type="submit" variant="primary">
          {t("applyPeriod")}
        </Button>

        <span className="ms-auto self-center text-[12px] text-ink-3">
          {t("periodRange", { from, to })}
        </span>
      </form>

      <HeadwayTable rows={rows} />
    </>
  );
}
