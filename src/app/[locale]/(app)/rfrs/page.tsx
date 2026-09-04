import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadRfrOptions, loadRfrs, loadStages } from "./queries";
import { buildRfrFilters } from "./filters";
import { RfrsTable } from "./rfrs-table";
import { RfrDrawer } from "./rfr-drawer";

const MODULE = "rfrs";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

export default async function RfrsPage({
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
  const filter = one("filter");

  const t = await getTranslations("rfr");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);
  const isSuperAdmin = isSuper(user.role);

  const [stages, all, options, { state: filterState, saved }] = await Promise.all([
    loadStages(),
    loadRfrs(""),
    loadRfrOptions(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildRfrFilters(
    {
      number: t("field.number"),
      requested: t("requested"),
      vehicle: t("vehicle"),
      driver: t("driver"),
      kmRecord: t("kmRecord"),
      location: t("location"),
      accessTime: t("accessTime"),
      clockRunning: t("clockRunning"),
      stage: t("stage"),
      raisedBy: t("raisedBy"),
    },
    {
      stages,
      vehicles: options.vehicles.map((v) => ({
        value: v.id,
        label: `${v.vehicleCode} · ${v.plateNumber}`,
      })),
      drivers: options.drivers.map((d) => ({
        value: d.id,
        label: `${d.driverCode} · ${d.driverName}`,
      })),
      rows: all,
    },
  );

  const searched = applyFilters(all, filters, filterState);

  const rows =
    filter === "running"
      ? searched.filter((r) => r.clockRunning)
      : filter
        ? searched.filter((r) => r.stageCode === filter)
        : searched;

  const chips: Chip[] = [
    { value: "", label: t("allStages"), count: searched.length },
    ...stages.map((s) => ({
      value: s.code,
      label: s.labelEn,
      count: searched.filter((r) => r.stageCode === s.code).length,
      tone:
        s.code === "completed"
          ? ("go" as const)
          : s.code === "skipped"
            ? ("stop" as const)
            : s.code === "pending"
              ? ("warn" as const)
              : ("neutral" as const),
    })),
    {
      value: "running",
      label: t("clockRunning"),
      count: searched.filter((r) => r.clockRunning).length,
      tone: "stop" as const,
    },
  ];

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (filter) baseQuery.filter = filter;
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...filterQuery };

  const drawerMode =
    canEdit && mode === "new"
      ? "new"
      : canEdit && mode === "edit" && id
        ? "edit"
        : id
          ? "view"
          : null;

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("maintenance")}
          title={t("title")}
          actions={
            canEdit ? (
              <Link
                href={{ pathname: "/rfrs", query: { ...query, mode: "new" } }}
                className={newButton}
              >
                {t("newRfr")}
              </Link>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/rfrs"
          controls={toControls(filters)}
          defaultFieldKeys={["vehicle", "stage"]}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/rfrs"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={filter}
          param="filter"
          pathname="/rfrs"
          extraQuery={filterQuery}
        />

        <RfrsTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <RfrDrawer
          mode={drawerMode}
          id={id}
          stages={stages}
          closeHref={{ pathname: "/rfrs", query }}
          canEdit={canEdit}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
