import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { Drawer } from "@/components/ui/drawer";
import { Panel, PanelHead, Section } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { VehicleDrawer } from "../vehicles/vehicle-drawer";
import { loadPmBoard, loadVehiclesWithoutSchedule } from "./queries";
import { buildPmFilters } from "./filters";
import { PmTable } from "./pm-table";
import { BuildSchedules } from "./build-schedules";

const MODULE = "periodic-maintenance";

const buildButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/**
 * Periodic maintenance. The one place where a row is not the record the drawer
 * shows: rows are vehicle-part schedules sorted by urgency, but selecting one
 * opens that vehicle's drawer with its whole schedule.
 */
export default async function PeriodicMaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const one = (key: string) => {
    const value = sp[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const id = one("id") || undefined;
  const mode = one("mode");
  const sort = one("sort");
  const dir = one("dir") || "asc";
  const status = one("status");

  const t = await getTranslations("pm");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [all, { state: filterState, saved }] = await Promise.all([
    loadPmBoard(""),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildPmFilters(
    {
      vehicle: t("field.vehicle"),
      part: t("field.part"),
      interval: t("field.interval"),
      lastService: t("field.lastService"),
      scheduled: t("field.scheduled"),
      actual: t("field.actual"),
      remaining: t("field.remaining"),
      status: t("field.status"),
      statusOverdue: tStatus("overdue"),
      statusDueNow: tStatus("dueNow"),
      statusDueSoon: tStatus("dueSoon"),
      statusOk: tStatus("ok"),
      statusNeverServiced: tStatus("neverServiced"),
      statusNoKmData: tStatus("noKmData"),
    },
    {
      vehicles: [
        ...new Map(all.map((r) => [r.vehicleId, `${r.vehicleCode} · ${r.plateNumber}`])),
      ].map(([value, label]) => ({ value, label })),
      rows: all,
    },
  );

  const searched = applyFilters(all, filters, filterState);
  const rows = status ? searched.filter((r) => r.status === status) : searched;

  const count = (code: string) => searched.filter((r) => r.status === code).length;

  const chips: Chip[] = [
    { value: "", label: t("allParts"), count: searched.length },
    { value: "overdue", label: tStatus("overdue"), count: count("overdue"), tone: "stop" },
    { value: "due_now", label: tStatus("dueNow"), count: count("due_now"), tone: "warn" },
    { value: "due_soon", label: tStatus("dueSoon"), count: count("due_soon"), tone: "warn" },
    { value: "ok", label: tStatus("ok"), count: count("ok"), tone: "go" },
  ];
  if (count("never_serviced") > 0) {
    chips.push({
      value: "never_serviced",
      label: tStatus("neverServiced"),
      count: count("never_serviced"),
    });
  }
  if (count("no_km_data") > 0) {
    chips.push({
      value: "no_km_data",
      label: tStatus("noKmData"),
      count: count("no_km_data"),
    });
  }

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (status) baseQuery.status = status;
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...filterQuery };

  const drawerMode = canEdit && mode === "edit" && id ? "edit" : id ? "view" : null;

  // Always offered to supervisor and above, not only when the board is empty:
  // buses join the fleet after the first seeding too.
  const building = canEdit && mode === "build";
  const seedable = building ? await loadVehiclesWithoutSchedule() : [];

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead
          eyebrow={tNav("maintenance")}
          title={t("title")}
          actions={
            canEdit ? (
              <Link
                href={{ pathname: "/periodic-maintenance", query: { mode: "build" } }}
                className={buildButton}
              >
                {t("buildSchedules")}
              </Link>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/periodic-maintenance"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("search")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/periodic-maintenance"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={status}
          param="status"
          pathname="/periodic-maintenance"
          extraQuery={filterQuery}
        />

        <PmTable
          rows={rows}
          selectedVehicleId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {building && (
        <Drawer
          code={t("buildSchedules")}
          sub={t("buildSchedulesSub")}
          closeHref={{ pathname: "/periodic-maintenance", query }}
          closeLabel={tCommon("cancel")}
        >
          <Section title={t("vehiclesWithoutSchedule")}>
            <BuildSchedules vehicles={seedable} />
          </Section>
        </Drawer>
      )}

      {!building && drawerMode && (
        <VehicleDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/periodic-maintenance", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
