import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import {
  EMPTY_WORK_ORDER_FORM,
  loadRepeatIndex,
  loadRfrContext,
  loadWorkOrder,
  loadWorkOrderOptions,
  toWorkOrderFormValues,
  type WorkOrderStatus,
} from "./queries";
import { WorkOrderForm } from "./work-order-form";

const STATUS_TONE: Record<WorkOrderStatus, "go" | "warn" | "stop" | "idle"> = {
  completed: "go",
  inProgress: "warn",
  skipped: "stop",
  notStarted: "idle",
};

const stamp = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : null);

export async function WorkOrderDrawer({
  mode,
  id,
  rfrId,
  closeHref,
  canEdit,
}: {
  mode: "view" | "new" | "edit";
  id?: string;
  /** Only for `new` — a work order is always raised against a request. */
  rfrId?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("workOrder");
  const tCommon = await getTranslations("common");
  const tRfr = await getTranslations("rfr");

  if (mode === "new" || mode === "edit") {
    const existing = mode === "edit" && id ? await loadWorkOrder(id) : null;

    if (mode === "edit" && !existing) {
      return (
        <Drawer code={t("edit")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    const contextId = existing?.rfrId ?? rfrId;
    const [options, rfr] = await Promise.all([
      loadWorkOrderOptions(),
      contextId ? loadRfrContext(contextId) : null,
    ]);

    // Without a request there is nothing to raise the order against.
    if (!rfr) {
      return (
        <Drawer code={t("new")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("needsRfr")} hint={t("needsRfrHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={existing ? `${t("edit")} · ${existing.workOrderNumber}` : t("new")}
        sub={`${rfr.rfrNumber} · ${rfr.vehicleCode}`}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <WorkOrderForm
          mode={existing ? "edit" : "create"}
          workOrderId={existing?.id}
          rfr={rfr}
          options={options}
          initial={existing ? toWorkOrderFormValues(existing) : EMPTY_WORK_ORDER_FORM}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  const workOrder = id ? await loadWorkOrder(id) : null;

  if (!workOrder) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const [repeat, options] = await Promise.all([
    loadRepeatIndex(workOrder.id),
    loadWorkOrderOptions(),
  ]);

  const parts = options.parts.filter((p) => workOrder.partIds.includes(p.id));

  return (
    <Drawer
      code={workOrder.workOrderNumber}
      sub={`${workOrder.rfrNumber} · ${workOrder.vehicleCode} · ${workOrder.plateNumber}`}
      pill={
        <Pill tone={STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Pill>
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{
              pathname: "/work-orders",
              query: { ...closeHref.query, mode: "edit", id: workOrder.id },
            }}
            className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={t("repair")}>
        <KeyValue>
          <Row label={t("field.engineer")}>{workOrder.engineerName ?? "—"}</Row>
          <Row label={t("field.centre")} muted>
            {workOrder.centreName ?? "—"}
          </Row>
          <Row label={t("field.maintenanceType")} muted>
            {workOrder.maintenanceTypeLabel ?? "—"}
          </Row>
          <Row label={t("field.issueType")}>{workOrder.issueTypeLabel ?? "—"}</Row>
          <Row label={t("field.category")} muted>
            {workOrder.maintenanceCategoryLabel ?? "—"}
          </Row>
          <Row label={t("field.repairStart")}>
            {stamp(workOrder.repairStartAt) ? (
              <span className="tnum">{stamp(workOrder.repairStartAt)}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.repairEnd")}>
            {stamp(workOrder.repairEndAt) ? (
              <span className="tnum">{stamp(workOrder.repairEndAt)}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.vehicleStatusAfter")} muted>
            {workOrder.vehicleStatusAfterLabel ?? "—"}
          </Row>
          <Row label={t("field.technicians")} muted>
            {workOrder.technicians.length > 0 ? workOrder.technicians.join(", ") : "—"}
          </Row>
        </KeyValue>

        {workOrder.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            {workOrder.description}
          </p>
        )}
      </Section>

      <Section title={t("replacedParts")}>
        {parts.length === 0 ? (
          <p className="text-[13px] text-ink-3">{t("noParts")}</p>
        ) : (
          <ul className="grid gap-2">
            {parts.map((part) => (
              <li
                key={part.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-[13.5px]">{part.partName}</span>
                {part.isPmItem && (
                  <span className="ms-auto">
                    <Micro bar={false}>{t("pmItem")}</Micro>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {workOrder.repairEndAt && parts.some((p) => p.isPmItem) && (
          <p className="mt-2.5 text-[10.5px] text-ink-3">{t("pmAdvancedNote")}</p>
        )}
      </Section>

      <Section title={t("repeatIndex")}>
        {/* Straight from v_work_order_repeat_index — never recounted here. */}
        {repeat ? (
          <div className="flex flex-wrap gap-5">
            {(
              [
                ["10", repeat.d10],
                ["20", repeat.d20],
                ["30", repeat.d30],
                ["50", repeat.d50],
              ] as const
            ).map(([days, value]) => (
              <div key={days}>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {t("withinDays", { days })}
                </div>
                <div
                  className={`tnum mt-0.5 text-xl font-semibold tracking-[-0.02em] ${
                    value > 0 ? "text-warn" : ""
                  }`}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">{t("noRepeatIndex")}</p>
        )}
      </Section>

      {workOrder.isSkipped && (
        <Section title={t("field.skipReason")}>
          <Micro tone="stop">{workOrder.skipReasonLabel ?? "—"}</Micro>
          {workOrder.skipNotes && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              {workOrder.skipNotes}
            </p>
          )}
        </Section>
      )}

      <Section title={tRfr("title")}>
        <Link
          href={{ pathname: "/rfrs", query: { id: workOrder.rfrId } }}
          className="tnum text-[13.5px] font-medium text-ink hover:underline"
        >
          {workOrder.rfrNumber}
        </Link>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {workOrder.vehicleCode} · {workOrder.plateNumber}
        </p>
      </Section>
    </Drawer>
  );
}
