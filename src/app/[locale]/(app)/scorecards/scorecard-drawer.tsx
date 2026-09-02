import { getTranslations } from "next-intl/server";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import { percent } from "@/lib/format";
import {
  loadScorecard,
  loadSections,
  type ScorecardRow,
  type ScorecardSection,
  type ScorecardStatus,
  type VendorOption,
} from "./queries";
import { AchievedEditor } from "./achieved-editor";
import { TemplateEditor } from "./template-editor";
import { StatusActions } from "./status-actions";

const STATUS_TONE: Record<ScorecardStatus, "go" | "warn" | "stop" | "idle"> = {
  approved: "go",
  submitted: "warn",
  reopened: "warn",
  draft: "idle",
};

/**
 * View-mode body, factored out so `/scorecards/[id]` (reached by clicking
 * a row's vendor code, as opposed to elsewhere in the row) can render the
 * exact same content as the Drawer without duplicating it. See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export async function ScorecardDetailBody({
  scorecard,
  sections,
  canEdit,
}: {
  scorecard: ScorecardRow;
  sections: ScorecardSection[];
  canEdit: boolean;
}) {
  const t = await getTranslations("scorecard");

  if (scorecard.isTemplate) {
    return (
      <Section title={t("kpiSet")}>
        <p className="mb-3 text-[12.5px] text-ink-3">{t("templateNote")}</p>
        <TemplateEditor scorecardId={scorecard.id} sections={sections} canEdit={canEdit} />
      </Section>
    );
  }

  return (
    <>
      <Section title={t("totalAchieved")}>
        {/*
          From v_scorecard_totals — the weighted total is the database's and
          is never recomputed here. It refreshes when points are saved.
        */}
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="tnum text-2xl font-semibold tracking-[-0.02em]">
            {scorecard.totalAchievedPct === null
              ? "—"
              : percent(scorecard.totalAchievedPct)}
          </span>
          <span className="text-[12.5px] text-ink-3">{t("totalFromView")}</span>
        </div>
      </Section>

      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.vendor")}>{scorecard.vendorName}</Row>
          <Row label={t("field.periodMonth")}>
            <span className="tnum">{scorecard.periodMonth?.slice(0, 7) ?? "—"}</span>
          </Row>
          <Row label={t("field.status")}>{t(`status.${scorecard.status}`)}</Row>
          <Row label={t("field.approvedBy")} muted>
            {scorecard.approvedBy ?? "—"}
          </Row>
          <Row label={t("field.approvedAt")} muted>
            {scorecard.approvedAt ? (
              <span className="tnum">
                {scorecard.approvedAt.slice(0, 16).replace("T", " ")}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.sectionsWeight")} muted>
            {scorecard.sectionsWeightTotal === null ? (
              "—"
            ) : (
              <span className="tnum">{percent(scorecard.sectionsWeightTotal, 0)}</span>
            )}
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("kpiSet")}>
        <AchievedEditor
          scorecardId={scorecard.id}
          sections={sections}
          canEdit={canEdit && scorecard.status !== "approved"}
        />
        {scorecard.status === "approved" && (
          <p className="mt-2.5 text-[10.5px] text-ink-3">{t("approvedLocked")}</p>
        )}
      </Section>
    </>
  );
}

export async function ScorecardDrawer({
  mode,
  id,
  closeHref,
  canEdit,
  vendorsWithoutTemplate = [],
}: {
  mode: "view" | "new";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
  /** Create mode only — vendors that do not already have a template. */
  vendorsWithoutTemplate?: VendorOption[];
}) {
  const t = await getTranslations("scorecard");
  const tCommon = await getTranslations("common");

  // A new template starts empty; the vendor is chosen inside the editor, and
  // the scorecard row is inserted with the first save.
  if (mode === "new") {
    return (
      <Drawer
        code={t("newTemplate")}
        sub={t("newTemplateHint")}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <Section title={t("kpiSet")}>
          <TemplateEditor
            sections={[]}
            canEdit={canEdit}
            vendorsWithoutTemplate={vendorsWithoutTemplate}
          />
        </Section>
      </Drawer>
    );
  }

  const scorecard = id ? await loadScorecard(id) : null;

  if (!scorecard) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  const sections = await loadSections(scorecard.id);

  return (
    <Drawer
      code={scorecard.vendorCode}
      sub={
        scorecard.isTemplate
          ? `${scorecard.vendorName} · ${t("template")}`
          : `${scorecard.vendorName} · ${scorecard.periodMonth?.slice(0, 7) ?? ""}`
      }
      pill={
        scorecard.isTemplate ? (
          <Pill tone="ghost">{t("template")}</Pill>
        ) : (
          <Pill tone={STATUS_TONE[scorecard.status]}>{t(`status.${scorecard.status}`)}</Pill>
        )
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        !scorecard.isTemplate && canEdit ? (
          <StatusActions scorecardId={scorecard.id} status={scorecard.status} />
        ) : undefined
      }
    >
      <ScorecardDetailBody scorecard={scorecard} sections={sections} canEdit={canEdit} />
    </Drawer>
  );
}
