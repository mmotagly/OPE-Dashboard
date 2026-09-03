import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel, PanelHead } from "@/components/ui/panel";
import { StatBar, Stat } from "@/components/ui/stat";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { Empty } from "@/components/ui/empty";
import { loadOperations, loadNearestPmForVehicles, loadShifts } from "../operations/queries";
import { OperationList } from "./operation-list";

/** The four statuses the "Not running" chip/stat groups — same set
 * operationTone() already treats as one tone (src/lib/format.ts). */
const NOT_RUNNING = [
  "cancelled_by_vendor",
  "cancelled_by_tmf",
  "cancelled_by_ope",
  "under_maintenance",
] as const;

/** Synthetic chip value for the grouped statuses — not a real status code. */
const NOT_RUNNING_VALUE = "not_running";

/** Synthetic chip value for "vehicle currently has an open RFR" — not a
 * real status code, same idea as NOT_RUNNING_VALUE above. */
const OPEN_RFRS_VALUE = "open_rfrs";

/**
 * Reference implementation. Every other module copies this shape:
 * Server Component fetches -> passes plain rows to a small client list ->
 * detail panel renders beside it.
 *
 * Status-aware as of the Day Board redesign: fetches every status for the
 * day (not just operating/completed) via the same `loadOperations` the
 * Operations module itself uses, so status resolution can never drift
 * between the two pages.
 */
export default async function DayBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const t = await getTranslations();
  const tNav = await getTranslations("nav");
  const { date, status } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const [all, shifts, supabase] = await Promise.all([
    loadOperations({ date: day }),
    loadShifts(),
    createClient(),
  ]);

  const isIn = (r: (typeof all)[number], codes: readonly string[]) =>
    r.statusCode !== null && codes.includes(r.statusCode);

  // Open means the stage is neither Completed nor Skipped. Counting on
  // completed_at counts the closed ones instead.
  const { data: closedStages } = await supabase
    .from("lookups")
    .select("id")
    .eq("category", "rfr_stage")
    .in("code", ["completed", "skipped"]);

  const closedStageIds = (closedStages ?? []).map((s) => s.id);

  let openRfrVehiclesQuery = supabase.from("rfrs").select("vehicle_id");

  if (closedStageIds.length > 0) {
    openRfrVehiclesQuery = openRfrVehiclesQuery.not(
      "stage_id",
      "in",
      `(${closedStageIds.join(",")})`,
    );
  }

  const { data: openRfrVehicles } = await openRfrVehiclesQuery;
  const openRfrVehicleIds = new Set(
    (openRfrVehicles ?? []).map((r) => String(r.vehicle_id)),
  );

  const hasOpenRfr = (r: (typeof all)[number]) =>
    r.vehicleId !== null && openRfrVehicleIds.has(r.vehicleId);

  const rows =
    status === NOT_RUNNING_VALUE
      ? all.filter((r) => isIn(r, NOT_RUNNING))
      : status === OPEN_RFRS_VALUE
        ? all.filter(hasOpenRfr)
        : status
          ? all.filter((r) => r.statusCode === status)
          : all;

  const operatingCount = all.filter((r) => r.statusCode === "operating").length;
  const completedCount = all.filter((r) => r.statusCode === "completed").length;
  const plannedCount = all.filter((r) => r.statusCode === "planned").length;
  const notRunningCount = all.filter((r) => isIn(r, NOT_RUNNING)).length;
  // Day-scoped, unlike the old fleet-wide head-count this replaces — vehicles
  // with an open RFR that aren't on today's board don't inflate the number
  // shown here, which is what makes the stat and the click-through filter
  // agree on the same count.
  const openRfrsCount = all.filter(hasOpenRfr).length;

  const vehicleIds = [...new Set(rows.map((r) => r.vehicleId).filter((v): v is string => v !== null))];
  const pmByVehicle = await loadNearestPmForVehicles(vehicleIds);

  const chips: Chip[] = [
    { value: "", label: t("dayBoard.allStatuses"), count: all.length },
    { value: "operating", label: t("status.operating"), count: operatingCount, tone: "go" },
    { value: "completed", label: t("status.completed"), count: completedCount, tone: "go" },
    { value: "planned", label: t("status.planned"), count: plannedCount, tone: "neutral" },
    {
      value: NOT_RUNNING_VALUE,
      label: t("dayBoard.notRunning"),
      count: notRunningCount,
      tone: "stop",
    },
    {
      value: OPEN_RFRS_VALUE,
      label: t("dayBoard.openRfrs"),
      count: openRfrsCount,
      tone: openRfrsCount > 0 ? "stop" : "neutral",
    },
  ];

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead eyebrow={tNav("operations")} title={`${t("dayBoard.title")} · ${day}`} />
        <StatBar>
          <Stat label={t("status.operating")} value={operatingCount} tone="go" />
          <Stat label={t("status.completed")} value={completedCount} tone="go" />
          <Stat label={t("status.planned")} value={plannedCount} tone="neutral" />
          <Stat label={t("dayBoard.notRunning")} value={notRunningCount} tone="stop" />
          <Stat
            label={t("dayBoard.openRfrs")}
            value={openRfrsCount}
            tone={openRfrsCount > 0 ? "stop" : "neutral"}
          />
        </StatBar>

        <FilterChips
          chips={chips}
          active={status ?? ""}
          param="status"
          pathname="/day-board"
          extraQuery={date ? { date } : {}}
        />

        {rows.length === 0 ? (
          <Empty title={t("common.empty")} hint={t("common.emptyHint")} />
        ) : (
          <OperationList rows={rows} pmByVehicle={pmByVehicle} shifts={shifts} />
        )}
      </Panel>
    </div>
  );
}
