import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { StageRail, type Stage } from "@/components/ui/stage-rail";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { km } from "@/lib/format";
import type { LookupOption } from "@/lib/lookups";
import {
  EMPTY_RFR_FORM,
  loadRfr,
  loadRfrIssues,
  loadRfrOptions,
  loadRfrWorkOrders,
  loadStageVisits,
  toRfrFormValues,
} from "./queries";
import { railState, stagePillTone } from "./stage-tone";
import { IssueList } from "./issue-list";
import { StageActions } from "./stage-actions";
import { RfrForm } from "./rfr-form";

export async function RfrDrawer({
  mode,
  id,
  stages,
  closeHref,
  canEdit,
  isSuperAdmin,
}: {
  mode: "view" | "new" | "edit";
  id?: string;
  stages: LookupOption[];
  closeHref: CloseHref;
  canEdit: boolean;
  isSuperAdmin: boolean;
}) {
  const t = await getTranslations("rfr");
  const tCommon = await getTranslations("common");

  if (mode === "new" || mode === "edit") {
    const [options, rfr] = await Promise.all([
      loadRfrOptions(),
      mode === "edit" && id ? loadRfr(id) : null,
    ]);

    if (mode === "edit" && !rfr) {
      return (
        <Drawer code={t("editRfr")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    const initial = rfr ? await toRfrFormValues(rfr) : EMPTY_RFR_FORM;

    return (
      <Drawer
        code={rfr ? `${t("editRfr")} · ${rfr.rfrNumber}` : t("newRfr")}
        sub={rfr ? `${rfr.vehicleCode} · ${rfr.plateNumber}` : undefined}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <RfrForm
          mode={rfr ? "edit" : "create"}
          rfrId={rfr?.id}
          options={options}
          initial={initial}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  const rfr = id ? await loadRfr(id) : null;

  if (!rfr) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const [issues, workOrders, visits, options] = await Promise.all([
    loadRfrIssues(rfr.id),
    loadRfrWorkOrders(rfr.id),
    loadStageVisits(rfr.id),
    loadRfrOptions(),
  ]);

  const visited = new Set(visits.map((v) => v.stageId));
  const rail: Stage[] = stages.map((s) => ({
    code: s.code,
    label: s.labelEn,
    state: railState(s.code, s.id === rfr.stageId, visited.has(s.id)),
  }));

  return (
    <Drawer
      code={rfr.rfrNumber}
      sub={`${rfr.vehicleCode} · ${rfr.plateNumber} · ${rfr.requestAt.slice(0, 16).replace("T", " ")}`}
      pill={
        rfr.stageLabel ? (
          <Pill tone={stagePillTone(rfr.stageCode)}>{rfr.stageLabel}</Pill>
        ) : undefined
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{ pathname: "/rfrs", query: { ...closeHref.query, mode: "edit", id: rfr.id } }}
            className="rounded-[10px] border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={t("stage")}>
        {canEdit ? (
          <StageActions
            rfrId={rfr.id}
            stages={stages}
            skipReasons={options.skipReasons}
            rail={rail}
            currentStageCode={rfr.stageCode ?? ""}
            isSuperAdmin={isSuperAdmin}
          />
        ) : (
          <StageRail stages={rail} />
        )}
      </Section>

      <Section title={t("accessTime")}>
        {/*
          Both the number and its formatting come from the access_minutes /
          access_display computed columns on rfrs (fn_rfr_access_minutes +
          fn_format_minutes). Nothing is recomputed here — only the tone,
          which says whether the clock is ticking.
        */}
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`tnum text-2xl font-semibold tracking-[-0.02em] ${
              rfr.clockRunning ? "text-stop" : ""
            }`}
          >
            {rfr.accessDisplay}
          </span>
          <Micro tone={rfr.clockRunning ? "stop" : "neutral"}>
            {rfr.clockRunning ? t("clockRunning") : t("clockPaused")}
          </Micro>
        </div>
        <p className="mt-2 text-[10.5px] text-ink-3">{t("clockNote")}</p>
      </Section>

      <Section title={t("request")}>
        <KeyValue>
          <Row label={t("vehicle")}>
            {rfr.vehicleCode}
            <span className="ms-2 text-[12px] text-ink-3">{rfr.plateNumber}</span>
          </Row>
          <Row label={t("driver")} hint={t("auto")}>
            {rfr.driverName ?? "—"}
            {rfr.driverCode && (
              <span className="ms-2 text-[12px] text-ink-3">{rfr.driverCode}</span>
            )}
          </Row>
          <Row label={t("kmRecord")} hint={t("auto")}>
            <span className="tnum">{km(rfr.odometerKm)}</span>
          </Row>
          <Row label={t("location")} muted>
            {rfr.vehicleLocation}
          </Row>
          <Row label={t("raisedBy")} muted>
            {rfr.raisedBy ?? "—"}
          </Row>
          {rfr.skipReasonLabel && (
            <Row label={t("skipReason")}>
              <Micro tone="stop">{rfr.skipReasonLabel}</Micro>
            </Row>
          )}
        </KeyValue>

        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{rfr.description}</p>
      </Section>

      <Section title={t("issues")}>
        <IssueList
          rfrId={rfr.id}
          issues={issues}
          skipReasons={options.skipReasons}
          canEdit={canEdit}
        />
      </Section>

      <Section title={t("workOrders")}>
        {/* A work order has no standalone create — it starts here, against
            this request, and the form opens with the request as context. */}
        {canEdit && (
          <Link
            href={{ pathname: "/work-orders", query: { mode: "new", rfr: rfr.id } }}
            className="mb-3 inline-flex rounded-[10px] border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise"
          >
            {t("createWorkOrder")}
          </Link>
        )}

        {workOrders.length === 0 ? (
          <p className="text-[13px] text-ink-3">{t("noWorkOrders")}</p>
        ) : (
          <ul className="grid gap-2">
            {workOrders.map((w) => (
              <li
                key={w.id}
                className="rounded-[10px] border border-hairline bg-canvas px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Link
                    href={{ pathname: "/work-orders", query: { id: w.id } }}
                    className="tnum text-[13.5px] font-medium hover:underline"
                  >
                    {w.workOrderNumber}
                  </Link>
                  {w.issueTypeLabel && (
                    <span className="text-[12.5px] text-ink-2">{w.issueTypeLabel}</span>
                  )}
                  <span className="ms-auto">
                    {w.isSkipped ? (
                      <Micro tone="stop">{t("woSkipped")}</Micro>
                    ) : w.repairEndAt ? (
                      <Micro tone="go">{t("woDone")}</Micro>
                    ) : w.repairStartAt ? (
                      <Micro tone="warn">{t("woInRepair")}</Micro>
                    ) : (
                      <Micro>{t("woNotStarted")}</Micro>
                    )}
                  </span>
                </div>
                {w.engineerName && (
                  <p className="mt-1 text-[12px] text-ink-3">{w.engineerName}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Drawer>
  );
}
