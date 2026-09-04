import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { ExportCsvLink } from "@/components/ui/export-csv-link";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { statusLabel } from "@/lib/format";
import { loadOperations, loadPickerOptions } from "./queries";
import { buildOperationFilters } from "./filters";
import { OperationsTable } from "./operations-table";
import { OperationDrawer } from "./operation-drawer";

const MODULE = "operations";

/** The one primary (accent-filled) action on this screen — DESIGN_SYSTEM.md
 * allows at most one per screen. "Bulk plan" stays secondary/neutral. */
const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

const bulkButton =
  "rounded-control border border-hairline bg-surface px-3 py-1.5 text-button font-medium text-ink transition-colors hover:bg-raise";

/**
 * Daily operations. One dense table across the content region; the drawer
 * overlays it from the inline-end edge for viewing, creating and editing.
 *
 * Filtering is declarative — `buildOperationFilters` names one control per
 * column and `applyFilters` narrows the fetched page. The shift chips stay as
 * quick filters beside the bar.
 */
export default async function OperationsPage({
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

  const t = await getTranslations("operations");
  const tNav = await getTranslations("nav");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);
  const isSuperAdmin = isSuper(user.role);

  const [pickers, { state: filterState, saved }, all] = await Promise.all([
    loadPickerOptions(),
    resolveFilters(MODULE, sp),
    loadOperations({}),
  ]);
  const shifts = pickers.shifts;

  const filters = buildOperationFilters(
    {
      code: t("field.code"),
      date: t("field.date"),
      shift: t("field.shift"),
      vehicle: t("field.vehicle"),
      driver: t("field.driver"),
      route: t("field.route"),
      vendor: t("vendorLabel"),
      startingKm: t("field.startingKm"),
      endingKm: t("field.endingKm"),
      distance: t("field.distance"),
      operatingPct: t("field.operatingPct"),
      status: t("field.status"),
    },
    {
      shifts,
      statuses: pickers.statuses.map((s) => ({
        value: s.code,
        label: statusLabel(tStatus, s) ?? s.labelEn,
      })),
      vehicles: pickers.vehicles.map((v) => ({
        value: v.id,
        label: `${v.vehicleCode} · ${v.plateNumber}`,
      })),
      drivers: pickers.drivers.map((d) => ({
        value: d.id,
        label: `${d.driverCode} · ${d.driverName}`,
      })),
      routes: pickers.routes.map((r) => ({
        value: r.id,
        label: `${r.routeCode} · ${r.routeName}`,
      })),
    },
  );

  const rows = applyFilters(all, filters, filterState);

  // A new operation opens with whatever a single-value shift or date filter
  // already narrows to — the same courtesy the old chips gave.
  const shiftRow = filterState.rows.find(
    (r) => r.field === "shift" && r.operator === "in",
  );
  const shiftIds = shiftRow ? shiftRow.value.split(",").filter(Boolean) : [];
  const prefillShift =
    shiftIds.length === 1
      ? (shifts.find((s) => s.id === shiftIds[0])?.code ?? "")
      : "";

  const dateRow = filterState.rows.find(
    (r) => r.field === "date" && r.operator === "between",
  );
  const prefillDate = dateRow ? (dateRow.value.split("..")[0] ?? "") : "";

  const filterQuery = writeFilterState(filterState);

  /** Params that are not filters — kept when the filter set changes. */
  const baseQuery: Record<string, string> = {};
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }

  const query = { ...baseQuery, ...filterQuery };

  const drawerMode =
    canEdit && mode === "new"
      ? "new"
      : canEdit && mode === "bulk"
        ? "bulk"
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
            <>
              <ExportCsvLink href="/api/export/operations" label={tCommon("exportCsv")} />
              {canEdit && (
                <>
                  <Link
                    href={{ pathname: "/operations", query: { ...query, mode: "bulk" } }}
                    className={bulkButton}
                  >
                    {t("bulkPlan")}
                  </Link>
                  <Link
                    href={{ pathname: "/operations", query: { ...query, mode: "new" } }}
                    className={newButton}
                  >
                    {t("new")}
                  </Link>
                </>
              )}
            </>
          }
        />

        <FilterBar
          pathname="/operations"
          controls={toControls(filters)}
          defaultFieldKeys={["vehicle", "status"]}
          state={filterState}
          baseQuery={baseQuery}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/operations"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <OperationsTable
          rows={rows}
          shifts={shifts}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <OperationDrawer
          mode={drawerMode}
          id={id}
          shifts={shifts}
          closeHref={{ pathname: "/operations", query }}
          canEdit={canEdit}
          isSuperAdmin={isSuperAdmin}
          filterDate={prefillDate}
          filterShift={prefillShift}
        />
      )}
    </div>
  );
}
