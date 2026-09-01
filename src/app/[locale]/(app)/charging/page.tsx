import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadChargingOptions, loadChargingSessions } from "./queries";
import { buildChargingFilters } from "./filters";
import { ChargingTable } from "./charging-table";
import { ChargingDrawer } from "./charging-drawer";

const MODULE = "charging";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

export default async function ChargingPage({
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

  const t = await getTranslations("charging");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);

  const [all, options, { state: filterState, saved }] = await Promise.all([
    loadChargingSessions(""),
    loadChargingOptions(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildChargingFilters(
    {
      sessionCode: t("field.sessionCode"),
      vehicle: t("field.vehicle"),
      charger: t("field.charger"),
      plugs: t("field.plugs"),
      batteryStart: t("field.batteryStart"),
      batteryEnd: t("field.batteryEnd"),
      startTime: t("field.startTime"),
      endTime: t("field.endTime"),
      energy: t("field.energy"),
      finished: t("finished"),
    },
    {
      vehicles: options.vehicles.map((v) => ({
        value: v.id,
        label: `${v.vehicleCode} · ${v.plateNumber}`,
      })),
      chargers: options.chargers.map((c) => ({ value: c.id, label: c.chargerCode })),
      rows: all,
    },
  );

  const rows = applyFilters(all, filters, filterState);


  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
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
          eyebrow={tNav("operations")}
          title={t("title")}
          actions={
            canEdit ? (
              <Link
                href={{ pathname: "/charging", query: { ...query, mode: "new" } }}
                className={newButton}
              >
                {t("new")}
              </Link>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/charging"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("search")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/charging"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <ChargingTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <ChargingDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/charging", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
