import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadVendor } from "../queries";
import { VendorDetailBody } from "../vendor-drawer";

/**
 * Standalone full-page view — reached by clicking a vendor's code in the
 * list, as opposed to clicking anywhere else in the row (which still opens
 * the overlay Drawer at /vendors?id=...). Same detail content
 * (VendorDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");

  const vendor = await loadVendor(id);
  if (!vendor) notFound();

  return (
    <div className="font-inter contents">
      <DetailPage
        code={vendor.vendorCode}
        sub={vendor.vendorName}
        pill={
          <>
            {vendor.isCompany && <Pill tone="ghost">{t("companyVendor")}</Pill>}
            {vendor.statusLabel && (
              <Pill tone={vendor.statusCode === "active" ? "go" : "idle"}>
                {vendor.statusLabel}
              </Pill>
            )}
          </>
        }
        backHref="/vendors"
        backLabel={t("vendorsTitle")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/vendors", query: { mode: "edit", id: vendor.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <VendorDetailBody vendor={vendor} />
      </DetailPage>
    </div>
  );
}
