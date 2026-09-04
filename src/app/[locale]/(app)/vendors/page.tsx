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
import { loadVendors } from "./queries";
import { buildVendorFilters } from "./filters";
import { VendorsTable } from "./vendors-table";
import { VendorDrawer } from "./vendor-drawer";

const MODULE = "vendors";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

export default async function VendorsPage({
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
  const tFinance = await getTranslations("finance");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [all, sets, { state: filterState, saved }] = await Promise.all([
    loadVendors(""),
    loadLookupSets(["vendor_type", "generic_status"] as const),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildVendorFilters(
    {
      vendorCode: t("field.vendorCode"),
      vendorName: t("field.vendorName"),
      vendorType: t("field.vendorType"),
      basis: tFinance("basis"),
      basisPerBusDay: t("basisPerBusDay"),
      basisPerAvgBusMonth: t("basisPerAvgBusMonth"),
      rateAmount: t("field.rateAmount"),
      applyKpi: t("field.applyKpi"),
      isCompany: t("companyVendor"),
      currency: t("field.currency"),
      status: t("field.status"),
    },
    { vendorTypes: sets.vendor_type, statuses: sets.generic_status, rows: all },
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
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("fleet")}
          title={t("vendorsTitle")}
          actions={
            canEdit ? (
              <>
                <ExportCsvLink href="/api/export/vendors" label={tCommon("exportCsv")} />
                <Link
                  href={{ pathname: "/vendors", query: { ...query, mode: "import" } }}
                  className="rounded-control border border-hairline bg-surface px-3 py-1.5 text-button font-medium text-ink transition-colors hover:bg-raise"
                >
                  {tCommon("importCsv")}
                </Link>
                <Link
                  href={{ pathname: "/vendors", query: { ...query, mode: "new" } }}
                  className={newButton}
                >
                  {t("newVendor")}
                </Link>
              </>
            ) : undefined
          }
        />

        <FilterBar
          pathname="/vendors"
          controls={toControls(filters)}
          defaultFieldKeys={["name", "type"]}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchVendors")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/vendors"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <VendorsTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <VendorDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/vendors", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
