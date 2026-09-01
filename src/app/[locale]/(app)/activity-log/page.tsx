import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { loadAuditLog, type EntityType } from "./queries";
import { ActivityTable } from "./activity-table";

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
  searchParams: Promise<{ entity?: string }>;
}) {
  const { locale } = await params;
  const { entity: entityParam = "" } = await searchParams;
  const entity = ENTITY_TYPES.includes(entityParam as EntityType) ? entityParam : "";

  const user = await requireUser(locale);
  if (!isSuper(user.role)) notFound();

  const t = await getTranslations("activityLog");
  const tEntity = (code: string) => (t.has(`entity.${code}`) ? t(`entity.${code}`) : code);

  // Fetched unfiltered so chip counts stay accurate for every entity type
  // regardless of which one is currently selected — narrowed in-memory
  // below, the same pattern the rest of the app uses for filter chips.
  const all = await loadAuditLog("");
  const rows = entity ? all.filter((r) => r.entityType === entity) : all;

  const chips: Chip[] = [
    { value: "", label: t("all"), count: all.length },
    ...ENTITY_TYPES.map((e) => ({
      value: e,
      label: tEntity(e),
      count: all.filter((r) => r.entityType === e).length,
    })),
  ];

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead eyebrow={t("eyebrow")} title={t("title")} />
        <FilterChips chips={chips} active={entity} param="entity" pathname="/activity-log" />
        <ActivityTable rows={rows} selectedId={null} />
      </Panel>
    </div>
  );
}
