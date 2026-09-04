import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/lib/i18n/routing";
import { isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { ListSearch } from "@/components/ui/list-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { buildLookupFilters } from "./filters";
import {
  loadAllLookups,
  loadLookupCategories,
  loadThresholds,
  loadUsers,
  type SettingsEntity,
} from "./queries";
import { LookupsTable, UsersTable } from "./settings-tables";
import { ThresholdsForm } from "./settings-forms";
import { SettingsDrawer } from "./settings-drawer";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/**
 * Settings — users, PM thresholds and the lookup lists. `super_admin` only,
 * the whole page; every action re-checks the same thing.
 */
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    entity?: string;
    q?: string;
    category?: string;
    id?: string;
    mode?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    entity: entityParam,
    q = "",
    category = "",
    id,
    mode,
    sort = "",
    dir = "asc",
  } = await searchParams;
  const searchParamsRaw = await searchParams;

  const user = await requireUser(locale);
  if (!isSuper(user.role)) notFound();

  const t = await getTranslations("settings");
  const tNav = await getTranslations("nav");

  const entity: SettingsEntity =
    entityParam === "lookups" ? "lookups" : entityParam === "thresholds" ? "thresholds" : "users";

  const [users, allLookups, thresholds, categories, { state: filterState, saved }] =
    await Promise.all([
      loadUsers(entity === "users" ? q : ""),
      entity === "lookups" ? loadAllLookups("") : [],
      loadThresholds(),
      loadLookupCategories(),
      resolveFilters("settings:lookups", searchParamsRaw),
    ]);

  const lookupFilters = buildLookupFilters(
    {
      category: t("field.category"),
      code: t("field.code"),
      labelEn: t("field.labelEn"),
      labelAr: t("field.labelAr"),
      sortOrder: t("field.sortOrder"),
      isActive: t("field.isActive"),
    },
    { categories, rows: allLookups },
  );

  // The old category select is now the `category` filter control.
  const lookups = applyFilters(allLookups, lookupFilters, filterState);
  const filterQuery = writeFilterState(filterState);

  const chips: Chip[] = [
    { value: "", label: t("usersTab"), count: users.length },
    { value: "thresholds", label: t("thresholdsTab"), count: thresholds.length },
    {
      value: "lookups",
      label: t("dataValidationTab"),
      count: entity === "lookups" ? lookups.length : categories.length,
    },
  ];

  const baseQuery: Record<string, string> = {};
  if (entity !== "users") baseQuery.entity = entity;
  if (entity === "users" && q) baseQuery.q = q;
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...(entity === "lookups" ? filterQuery : {}) };

  const drawerMode =
    mode === "new" ? "new" : mode === "edit" && id ? "edit" : id ? "view" : null;

  const title =
    entity === "lookups"
      ? t("dataValidationTitle")
      : entity === "thresholds"
        ? t("thresholdsTitle")
        : t("usersTitle");

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("admin")}
          title={title}
          actions={
            entity === "lookups" ? (
              <Link
                href={{ pathname: "/settings", query: { ...query, mode: "new" } }}
                className={newButton}
              >
                {t("newLookup")}
              </Link>
            ) : undefined
          }
        />

        <FilterChips
          chips={chips}
          active={entity === "users" ? "" : entity}
          param="entity"
          pathname="/settings"
        />

        {entity === "users" && (
          <>
            <ListSearch pathname="/settings" value={q} placeholder={t("searchUsers")} />
            <UsersTable
              rows={users}
              selectedId={id ?? null}
              query={query}
              sort={sort}
              dir={dir}
            />
          </>
        )}

        {entity === "thresholds" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ThresholdsForm thresholds={thresholds} />
          </div>
        )}

        {entity === "lookups" && (
          <>
            <FilterBar
              pathname="/settings"
              controls={toControls(lookupFilters)}
              defaultFieldKeys={["category", "code"]}
              state={filterState}
              baseQuery={baseQuery}
              savedViews={
                <SavedViewsTabs
                  module="settings:lookups"
                  pathname="/settings"
                  views={saved}
                  state={filterState}
                  baseQuery={baseQuery}
                />
              }
            />
            <LookupsTable
              rows={lookups}
              selectedId={id ?? null}
              query={query}
              sort={sort}
              dir={dir}
            />
          </>
        )}
      </Panel>

      {entity !== "thresholds" && drawerMode && (
        <SettingsDrawer
          entity={entity}
          mode={drawerMode}
          id={id}
          category={category}
          closeHref={{ pathname: "/settings", query }}
        />
      )}
    </div>
  );
}
