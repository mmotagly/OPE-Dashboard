import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { ExportCsvLink } from "@/components/ui/export-csv-link";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadLookupSets } from "@/lib/lookups";
import { loadVehicles } from "./queries";
import { buildVehicleFilters } from "./filters";
import { VehiclesTable } from "./vehicles-table";
import { VehicleDrawer } from "./vehicle-drawer";

const MODULE = "vehicles";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

export default async function VehiclesPage({
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

  const t = await getTranslations("master");
  const tVehicle = await getTranslations("vehicle");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [all, sets, { state: filterState, saved }] = await Promise.all([
    loadVehicles(""),
    loadLookupSets(["vehicle_type", "fuel_type", "generic_status"] as const),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildVehicleFilters(
    {
      vehicleCode: t("field.vehicleCode"),
      plateNumber: t("field.plateNumber"),
      vendor: tVehicle("vendor"),
      type: tVehicle("type"),
      fuelType: t("field.fuelType"),
      defaultDriver: t("field.defaultDriver"),
      odometer: tVehicle("odometer"),
      batteryCapacity: t("field.batteryCapacity"),
      licenseExpiry: tVehicle("licenseExpiry"),
      status: t("field.status"),
    },
    {
      vendors: [
        ...new Map(
          all.filter((v) => v.vendorName).map((v) => [v.vendorId, v.vendorName!]),
        ),
      ].map(([value, label]) => ({ value, label })),
      drivers: [
        ...new Map(
          all
            .filter((v) => v.defaultDriverId && v.defaultDriverName)
            .map((v) => [v.defaultDriverId!, v.defaultDriverName!]),
        ),
      ].map(([value, label]) => ({ value, label })),
      vehicleTypes: sets.vehicle_type,
      fuelTypes: sets.fuel_type,
      statuses: sets.generic_status,
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
        : canEdit && mode === "import"
          ? "import"
          : id
            ? "view"
            : null;

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead
          eyebrow={tNav("fleet")}
          title={t("vehiclesTitle")}
          actions={
            canEdit ? (
              <>
                <ExportCsvLink href="/api/export/vehicles" label={tCommon("exportCsv")} />
                <Link
                  href={{ pathname: "/vehicles", query: { ...query, mode: "import" } }}
                  className="rounded-control border border-hairline bg-surface px-3 py-1.5 text-button font-medium text-ink transition-colors hover:bg-raise"
                >
                  {tCommon("importCsv")}
                </Link>
                <Link
                  href={{ pathname: "/vehicles", query: { ...query, mode: "new" } }}
                  className={newButton}
                >
                  {t("newVehicle")}
                </Link>
              </>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/vehicles"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchVehicles")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/vehicles"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <VehiclesTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <VehicleDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/vehicles", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
