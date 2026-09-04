import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadAuditLog, type EntityType } from "./queries";
import { buildActivityLogFilters } from "./filters";
import { ActivityTable } from "./activity-table";

const MODULE = "activity-log";
const ENTITY_TYPES: EntityType[] = ["rfr", "operation", "invoice"];

/**
 * Activity log — read-only, `super_admin` only (same scoping as Settings).
 * Roadmap item 2 (2026-08-30). Reads v_audit_log directly; no drawer, no
 * writes — the log itself is immutable, enforced at the DB (0015).
 */
export default async function ActivityLogPage({
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
  const entityParam = one("entity");
  const entity = ENTITY_TYPES.includes(entityParam as EntityType) ? entityParam : "";

  const user = await requireUser(locale);
  if (!isSuper(user.role)) notFound();

  const t = await getTranslations("activityLog");
  const tEntity = (code: string) => (t.has(`entity.${code}`) ? t(`entity.${code}`) : code);

  // Fetched unfiltered so chip counts stay accurate for every entity type
  // regardless of which one is currently selected — narrowed in-memory
  // below, the same pattern the rest of the app uses for filter chips.
  const [all, { state: filterState, saved }] = await Promise.all([
    loadAuditLog(""),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildActivityLogFilters(
    {
      actor: t("field.actor"),
      action: t("field.action"),
      when: t("field.when"),
    },
    all,
  );

  const searched = applyFilters(all, filters, filterState);
  const rows = entity ? searched.filter((r) => r.entityType === entity) : searched;

  const chips: Chip[] = [
    { value: "", label: t("all"), count: searched.length },
    ...ENTITY_TYPES.map((e) => ({
      value: e,
      label: tEntity(e),
      count: searched.filter((r) => r.entityType === e).length,
    })),
  ];

  const baseQuery: Record<string, string> = {};
  if (entity) baseQuery.entity = entity;

  // Chip clicks must not drop whatever the bar has composed — extraQuery
  // is what carries `f`/`q` through a chip change.
  const filterQuery = writeFilterState(filterState);

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead eyebrow={t("eyebrow")} title={t("title")} />

        <FilterBar
          pathname="/activity-log"
          controls={toControls(filters)}
          defaultFieldKeys={["actor", "action"]}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/activity-log"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={entity}
          param="entity"
          pathname="/activity-log"
          extraQuery={filterQuery}
        />
        <ActivityTable rows={rows} selectedId={null} />
      </Panel>
    </div>
  );
}
