import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadLookupSets } from "@/lib/lookups";
import { expiryState } from "@/lib/format";
import { loadDrivers, type DriverRow } from "./queries";
import { buildDriverFilters } from "./filters";
import { DriversTable } from "./drivers-table";
import { DriverDrawer } from "./driver-drawer";

const MODULE = "drivers";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/** Amber or red on either document. */
const documentsDue = (r: DriverRow) => {
  const licence = expiryState(r.licenseExpiryDate);
  const tourism = r.hasTourismId ? expiryState(r.tourismIdExpiryDate) : "ok";
  return (
    licence === "expired" ||
    licence === "expiring" ||
    tourism === "expired" ||
    tourism === "expiring"
  );
};

export default async function DriversPage({
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

  const t = await getTranslations("master");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [all, sets, { state: filterState, saved }] = await Promise.all([
    loadDrivers(""),
    loadLookupSets(["license_grade", "generic_status"] as const),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildDriverFilters(
    {
      driverCode: t("field.driverCode"),
      driverName: t("field.driverName"),
      vendor: t("field.vendor"),
      mobile: t("field.mobile"),
      licenseGrade: t("field.licenseGrade"),
      hiringDate: t("field.hiringDate"),
      licenseExpiry: t("field.licenseExpiry"),
      tourismExpiry: t("field.tourismExpiry"),
      hasTourismId: t("field.hasTourismId"),
      status: t("field.status"),
    },
    {
      vendors: [
        ...new Map(
          all.filter((d) => d.vendorId && d.vendorName).map((d) => [d.vendorId!, d.vendorName!]),
        ),
      ].map(([value, label]) => ({ value, label })),
      licenseGrades: sets.license_grade,
      statuses: sets.generic_status,
    },
  );

  const searched = applyFilters(all, filters, filterState);

  const rows = filter === "due" ? searched.filter(documentsDue) : searched;

  // The only chip left: licence-or-tourism expiry spans two columns with an
  // OR, which the bar cannot express as a single row.
  const chips: Chip[] = [
    { value: "", label: t("allRecords"), count: searched.length },
    {
      value: "due",
      label: t("documentsDue"),
      count: searched.filter(documentsDue).length,
      tone: "warn" as const,
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
      <Panel clip={false}>
        <PanelHead
          eyebrow={tNav("fleet")}
          title={t("driversTitle")}
          actions={
            canEdit ? (
              <Link
                href={{ pathname: "/drivers", query: { ...query, mode: "new" } }}
                className={newButton}
              >
                {t("newDriver")}
              </Link>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/drivers"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchDrivers")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/drivers"
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
          pathname="/drivers"
          extraQuery={filterQuery}
        />

        <DriversTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <DriverDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/drivers", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
