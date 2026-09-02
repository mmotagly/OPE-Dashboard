import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import {
  loadRepeatIndex,
  loadWorkOrder,
  loadWorkOrderOptions,
  type WorkOrderStatus,
} from "../queries";
import { WorkOrderDetailBody } from "../work-order-drawer";

const STATUS_TONE: Record<WorkOrderStatus, "go" | "warn" | "stop" | "idle"> = {
  completed: "go",
  inProgress: "warn",
  skipped: "stop",
  notStarted: "idle",
};

/**
 * Standalone full-page view — reached by clicking a work order's number in
 * the list, as opposed to clicking anywhere else in the row (which still
 * opens the overlay Drawer at /work-orders?id=...). Same detail content
 * (WorkOrderDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);

  const t = await getTranslations("workOrder");
  const tCommon = await getTranslations("common");

  const workOrder = await loadWorkOrder(id);
  if (!workOrder) notFound();

  const [repeat, options] = await Promise.all([
    loadRepeatIndex(workOrder.id),
    loadWorkOrderOptions(),
  ]);

  const parts = options.parts.filter((p) => workOrder.partIds.includes(p.id));

  return (
    <div className="font-inter contents">
      <DetailPage
        code={workOrder.workOrderNumber}
        sub={`${workOrder.rfrNumber} · ${workOrder.vehicleCode} · ${workOrder.plateNumber}`}
        pill={
          <Pill tone={STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Pill>
        }
        backHref="/work-orders"
        backLabel={t("title")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/work-orders", query: { mode: "edit", id: workOrder.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <WorkOrderDetailBody workOrder={workOrder} parts={parts} repeat={repeat} />
      </DetailPage>
    </div>
  );
}
