import { getTranslations } from "next-intl/server";
import { canWriteOps, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadWorkOrderOptions, loadWorkOrders } from "./queries";
import { buildWorkOrderFilters } from "./filters";
import { WorkOrdersTable } from "./work-orders-table";
import { WorkOrderDrawer } from "./work-order-drawer";

const MODULE = "work-orders";

/**
 * Work orders. There is no New button — an order is always raised from its RFR,
 * which is where the "Create work order" action lives.
 */
export default async function WorkOrdersPage({
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
  const rfr = one("rfr") || undefined;

  const t = await getTranslations("workOrder");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);

  const [all, options, { state: filterState, saved }] = await Promise.all([
    loadWorkOrders(""),
    loadWorkOrderOptions(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildWorkOrderFilters(
    {
      number: t("field.number"),
      rfr: t("field.rfr"),
      vehicle: t("field.vehicle"),
      issueType: t("field.issueType"),
      maintenanceType: t("field.maintenanceType"),
      category: t("field.category"),
      engineer: t("field.engineer"),
      centre: t("field.centre"),
      repairStart: t("field.repairStart"),
      repairEnd: t("field.repairEnd"),
      status: t("field.status"),
      statusNotStarted: t("status.notStarted"),
      statusInProgress: t("status.inProgress"),
      statusCompleted: t("status.completed"),
      statusSkipped: t("status.skipped"),
    },
    {
      issueTypes: options.issueTypes,
      maintenanceTypes: options.maintenanceTypes,
      categories: options.maintenanceCategories,
      engineers: options.engineers.map((e) => ({ value: e.id, label: e.fullName })),
      centres: options.centres.map((c) => ({
        value: c.id,
        label: `${c.centreCode} · ${c.centreName}`,
      })),
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
        <PanelHead eyebrow={tNav("maintenance")} title={t("title")} />

        <FilterBar
          pathname="/work-orders"
          controls={toControls(filters)}
          defaultFieldKeys={["vehicle", "status"]}
          state={filterState}
          baseQuery={baseQuery}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/work-orders"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <WorkOrdersTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <WorkOrderDrawer
          mode={drawerMode}
          id={id}
          rfrId={rfr}
          closeHref={{ pathname: "/work-orders", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
