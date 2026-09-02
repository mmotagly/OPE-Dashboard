import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { operationTone, statusLabel } from "@/lib/format";
import { loadLatestGpsPing } from "@/lib/gps/latest-ping";
import { loadNearestPm, loadOperation, loadPickerOptions } from "../queries";
import { OperationDetailBody } from "../operation-drawer";

/**
 * Standalone full-page view — reached by clicking an operation's code in
 * the list, as opposed to clicking anywhere else in the row (which still
 * opens the overlay Drawer at /operations?id=...). Same detail content
 * (OperationDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);

  const t = await getTranslations("operations");
  const tCommon = await getTranslations("common");
  const tStatus = await getTranslations("status");

  const operation = await loadOperation(id);
  if (!operation) notFound();

  const status = operation.statusCode
    ? { code: operation.statusCode, labelEn: operation.statusLabel ?? operation.statusCode }
    : null;
  const showsLocation =
    operation.statusCode === "operating" || operation.statusCode === "completed";

  const [pickers, pm, ping] = await Promise.all([
    loadPickerOptions(),
    operation.vehicleId ? loadNearestPm(operation.vehicleId) : Promise.resolve(null),
    operation.vehicleId && showsLocation
      ? loadLatestGpsPing(operation.vehicleId)
      : Promise.resolve(null),
  ]);

  return (
    <div className="font-inter contents">
      <DetailPage
        code={operation.vehicleCode}
        sub={`${operation.plate} · ${operation.code}`}
        pill={
          status && (
            <Pill tone={operationTone(status.code)}>{statusLabel(tStatus, status)}</Pill>
          )
        }
        backHref="/operations"
        backLabel={t("title")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/operations", query: { mode: "edit", id: operation.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <OperationDetailBody
          operation={operation}
          shifts={pickers.shifts}
          pm={pm}
          ping={ping}
        />
      </DetailPage>
    </div>
  );
}
