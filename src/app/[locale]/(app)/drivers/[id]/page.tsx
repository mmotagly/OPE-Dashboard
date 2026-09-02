import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadDriver } from "../queries";
import { DriverDetailBody } from "../driver-drawer";

/**
 * Standalone full-page view — reached by clicking a driver's code in the
 * list, as opposed to clicking anywhere else in the row (which still opens
 * the overlay Drawer at /drivers?id=...). Same detail content
 * (DriverDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");

  const driver = await loadDriver(id);
  if (!driver) notFound();

  return (
    <div className="font-inter contents">
      <DetailPage
        code={driver.driverCode}
        sub={`${driver.driverName} · ${driver.vendorName ?? t("companyDriver")}`}
        pill={
          driver.statusLabel ? (
            <Pill tone={driver.statusCode === "active" ? "go" : "idle"}>
              {driver.statusLabel}
            </Pill>
          ) : undefined
        }
        backHref="/drivers"
        backLabel={t("driversTitle")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/drivers", query: { mode: "edit", id: driver.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <DriverDetailBody driver={driver} />
      </DetailPage>
    </div>
  );
}
