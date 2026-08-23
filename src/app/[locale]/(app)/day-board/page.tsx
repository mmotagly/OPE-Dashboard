import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel, PanelHead } from "@/components/ui/panel";
import { StatBar, Stat } from "@/components/ui/stat";
import { Empty } from "@/components/ui/empty";
import { OperationList, type OperationRow } from "./operation-list";

/**
 * Reference implementation. Every other module copies this shape:
 * Server Component fetches -> passes plain rows to a small client list ->
 * detail panel renders beside it.
 */
export default async function DayBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string }>;
}) {
  const t = await getTranslations();
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  // Day Board is "what's actually out today" — a bus that's Planned (hasn't
  // run yet), Cancelled, or Under Maintenance isn't out, so it's excluded
  // here rather than shown with the noEndKm/KmMeter treatment below, which
  // only makes sense for a bus that's actually running or finished running.
  const { data: runningStatuses } = await supabase
    .from("lookups")
    .select("id")
    .eq("category", "operation_status")
    .in("code", ["operating", "completed"]);
  const runningStatusIds = (runningStatuses ?? []).map((s) => s.id);

  const { data: operations } = await supabase
    .from("daily_vehicle_operations")
    .select(
      `
      id,
      operation_code,
      operation_date,
      operating_percentage,
      starting_odometer_km,
      ending_odometer_km,
      starting_battery_pct,
      ending_battery_pct,
      driver_tips,
      vehicles ( id, vehicle_code, plate_number, current_odometer_km ),
      drivers ( driver_code, driver_name ),
      routes ( route_code, route_name ),
      vendors ( vendor_name )
    `,
    )
    .eq("operation_date", day)
    .in("status_id", runningStatusIds)
    .order("operation_code");

  const rows: OperationRow[] = (operations ?? []).map((o) => {
    const v = Array.isArray(o.vehicles) ? o.vehicles[0] : o.vehicles;
    const d = Array.isArray(o.drivers) ? o.drivers[0] : o.drivers;
    const r = Array.isArray(o.routes) ? o.routes[0] : o.routes;
    const ven = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;

    return {
      id: o.id as string,
      code: (v?.vehicle_code as string) ?? "—",
      plate: (v?.plate_number as string) ?? "—",
      vendorName: (ven?.vendor_name as string) ?? "—",
      driverName: (d?.driver_name as string) ?? "—",
      driverCode: (d?.driver_code as string) ?? "—",
      routeName: (r?.route_name as string) ?? null,
      startKm: (o.starting_odometer_km as number) ?? null,
      endKm: (o.ending_odometer_km as number) ?? null,
      operatingPct: (o.operating_percentage as number) ?? null,
      batteryStart: (o.starting_battery_pct as number) ?? null,
      batteryEnd: (o.ending_battery_pct as number) ?? null,
    };
  });

  const missingEndKm = rows.filter((r) => r.endKm === null).length;

  // Open means the stage is neither Completed nor Skipped. Counting on
  // completed_at counts the closed ones instead.
  const { data: closedStages } = await supabase
    .from("lookups")
    .select("id")
    .eq("category", "rfr_stage")
    .in("code", ["completed", "skipped"]);

  const closedStageIds = (closedStages ?? []).map((s) => s.id);

  let openRfrsQuery = supabase
    .from("rfrs")
    .select("id", { count: "exact", head: true });

  if (closedStageIds.length > 0) {
    openRfrsQuery = openRfrsQuery.not("stage_id", "in", `(${closedStageIds.join(",")})`);
  }

  const { count: openRfrs } = await openRfrsQuery;

  return (
    <Panel>
      <PanelHead title={`${t("dayBoard.title")} · ${day}`} />
        <StatBar>
          <Stat label={t("dayBoard.busesOut")} value={rows.length} />
          <Stat
            label={t("dayBoard.missingEndKm")}
            value={missingEndKm}
            tone={missingEndKm > 0 ? "warn" : "neutral"}
          />
          <Stat
            label={t("dayBoard.openRfrs")}
            value={openRfrs ?? 0}
            tone={(openRfrs ?? 0) > 0 ? "stop" : "neutral"}
          />
        </StatBar>

        {rows.length === 0 ? (
          <Empty title={t("common.empty")} hint={t("common.emptyHint")} />
        ) : (
          <OperationList rows={rows} />
        )}
    </Panel>
  );
}
