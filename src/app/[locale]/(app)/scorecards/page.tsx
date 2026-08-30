import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/lib/i18n/routing";
import { canSeeMoney, isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { ExportCsvLink } from "@/components/ui/export-csv-link";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import { loadScorecards, loadVendorsWithTemplates } from "./queries";
import { buildScorecardFilters } from "./filters";
import { ScorecardsTable } from "./scorecards-table";
import { ScorecardDrawer } from "./scorecard-drawer";
import { OpenMonth } from "./open-month";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

export default async function ScorecardsPage({
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
  const kind = one("kind") === "templates" ? "templates" : "months";
  const moduleKey = kind === "templates" ? "scorecards:templates" : "scorecards";

  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();

  const t = await getTranslations("scorecard");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const canEdit = isSuper(user.role);

  const [months, templates, vendorInfo, { state: filterState, saved }] = await Promise.all([
    loadScorecards("months"),
    loadScorecards("templates"),
    loadVendorsWithTemplates(),
    resolveFilters(moduleKey, sp),
  ]);

  const source = kind === "templates" ? templates : months;

  const filters = buildScorecardFilters(
    {
      vendor: t("field.vendor"),
      periodMonth: t("field.periodMonth"),
      totalAchieved: t("field.totalAchieved"),
      approvedBy: t("field.approvedBy"),
      sections: t("field.sections"),
      kpiLines: t("field.kpiLines"),
      sectionsWeight: t("field.sectionsWeight"),
      status: t("field.status"),
      statusDraft: t("status.draft"),
      statusSubmitted: t("status.submitted"),
      statusApproved: t("status.approved"),
      statusReopened: t("status.reopened"),
    },
    {
      kind,
      vendors: vendorInfo.vendors.map((v) => ({
        value: v.id,
        label: `${v.vendorCode} · ${v.vendorName}`,
      })),
      rows: source,
    },
  );

  const rows = applyFilters(source, filters, filterState);

  const chips: Chip[] = [
    { value: "", label: t("monthsTab"), count: months.length },
    { value: "templates", label: t("templatesTab"), count: templates.length },
  ];

  const vendorsWithoutTemplate = vendorInfo.vendors.filter(
    (v) => !vendorInfo.withTemplate.includes(v.id),
  );

  const drawerMode = canEdit && mode === "new" ? "new" : id ? "view" : null;

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (kind === "templates") baseQuery.kind = "templates";
  if (sort) {
    baseQuery.sort = sort;
    baseQuery.dir = dir;
  }
  const query = { ...baseQuery, ...filterQuery };

  return (
    <div className="font-inter contents">
      <Panel clip={false}>
        <PanelHead
          eyebrow={tNav("finance")}
          title={kind === "templates" ? t("templatesTitle") : t("title")}
          actions={
            <>
              {kind === "months" && (
                <ExportCsvLink href="/api/export/scorecards" label={tCommon("exportCsv")} />
              )}
              {canEdit &&
                (kind === "templates" ? (
                  <Link
                    href={{ pathname: "/scorecards", query: { ...query, mode: "new" } }}
                    className={newButton}
                  >
                    {t("newTemplate")}
                  </Link>
                ) : (
                  <OpenMonth
                    vendors={vendorInfo.vendors}
                    withTemplate={vendorInfo.withTemplate}
                  />
                ))}
            </>
          }
        />

        <FilterBar
          pathname="/scorecards"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={moduleKey}
              pathname="/scorecards"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={kind === "templates" ? "templates" : ""}
          param="kind"
          pathname="/scorecards"
          extraQuery={filterQuery}
        />

        <ScorecardsTable
          rows={rows}
          kind={kind}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {drawerMode && (
        <ScorecardDrawer
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/scorecards", query }}
          canEdit={canEdit}
          vendorsWithoutTemplate={vendorsWithoutTemplate}
        />
      )}
    </div>
  );
}
