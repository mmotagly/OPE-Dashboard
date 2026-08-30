import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { canSeeMoney, isSuper, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { ExportCsvLink } from "@/components/ui/export-csv-link";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { FilterBar } from "@/components/ui/filter-bar";
import { SavedViewsTabs } from "@/components/ui/saved-views-tabs";
import { applyFilters, toControls, writeFilterState } from "@/lib/filters";
import { resolveFilters } from "@/lib/filter-page";
import {
  loadInvoiceVendors,
  loadInvoices,
  loadShiftOptions,
  type InvoiceStatus,
} from "./queries";
import { buildInvoiceFilters } from "./filters";
import { InvoicesTable } from "./invoices-table";
import { InvoiceDrawer } from "./invoice-drawer";
import { GenerateInvoice } from "./generate-invoice";

const MODULE = "invoices";

export default async function InvoicesPage({
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
  const sort = one("sort");
  const dir = one("dir") || "asc";
  const status = one("status");

  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();

  const t = await getTranslations("invoice");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const canEdit = isSuper(user.role);

  const [all, vendors, shifts, { state: filterState, saved }] = await Promise.all([
    loadInvoices(),
    loadInvoiceVendors(),
    loadShiftOptions(),
    resolveFilters(MODULE, sp),
  ]);

  const filters = buildInvoiceFilters(
    {
      vendor: t("field.vendor"),
      periodMonth: t("field.periodMonth"),
      basis: t("field.basis"),
      basisPerBusDay: t("basisPerBusDay"),
      basisPerAvgBusMonth: t("basisPerAvgBusMonth"),
      busQuantity: t("field.busQuantity"),
      gross: t("field.gross"),
      achievedPct: t("field.achievedPct"),
      net: t("field.net"),
      currency: t("field.currency"),
      status: t("field.status"),
      statusDraft: t("status.draft"),
      statusSubmitted: t("status.submitted"),
      statusApproved: t("status.approved"),
      statusPaid: t("status.paid"),
    },
    {
      vendors: vendors.map((v) => ({
        value: v.id,
        label: `${v.vendorCode} · ${v.vendorName}`,
      })),
      rows: all,
    },
  );

  const searched = applyFilters(all, filters, filterState);
  const rows = status ? searched.filter((r) => r.status === status) : searched;

  const count = (s: InvoiceStatus) => searched.filter((r) => r.status === s).length;

  const chips: Chip[] = [
    { value: "", label: t("allInvoices"), count: searched.length },
    { value: "draft", label: t("status.draft"), count: count("draft") },
    { value: "submitted", label: t("status.submitted"), count: count("submitted"), tone: "warn" },
    { value: "approved", label: t("status.approved"), count: count("approved"), tone: "go" },
    { value: "paid", label: t("status.paid"), count: count("paid"), tone: "go" },
  ];

  const filterQuery = writeFilterState(filterState);
  const baseQuery: Record<string, string> = {};
  if (status) baseQuery.status = status;
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
          title={t("title")}
          actions={
            <>
              <ExportCsvLink href="/api/export/invoices" label={tCommon("exportCsv")} />
              {canEdit && <GenerateInvoice vendors={vendors} shifts={shifts} />}
            </>
          }
        />

        <FilterBar
          pathname="/invoices"
          controls={toControls(filters)}
          state={filterState}
          baseQuery={baseQuery}
          searchPlaceholder={t("searchPlaceholder")}
          savedViews={
            <SavedViewsTabs
              module={MODULE}
              pathname="/invoices"
              views={saved}
              state={filterState}
              baseQuery={baseQuery}
            />
          }
        />

        <FilterChips
          chips={chips}
          active={status}
          param="status"
          pathname="/invoices"
          extraQuery={filterQuery}
        />

        <InvoicesTable
          rows={rows}
          selectedId={id ?? null}
          query={query}
          sort={sort}
          dir={dir}
        />
      </Panel>

      {id && (
        <InvoiceDrawer
          id={id}
          closeHref={{ pathname: "/invoices", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
