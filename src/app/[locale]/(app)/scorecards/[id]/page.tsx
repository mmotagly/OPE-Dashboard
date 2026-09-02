import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canSeeMoney, isSuper, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadScorecard, loadSections, type ScorecardStatus } from "../queries";
import { ScorecardDetailBody } from "../scorecard-drawer";
import { StatusActions } from "../status-actions";

const STATUS_TONE: Record<ScorecardStatus, "go" | "warn" | "stop" | "idle"> = {
  approved: "go",
  submitted: "warn",
  reopened: "warn",
  draft: "idle",
};

/**
 * Standalone full-page view — reached by clicking a row's vendor code in
 * the list, as opposed to clicking anywhere else in the row (which still
 * opens the overlay Drawer at /scorecards?id=...). Same detail content
 * (ScorecardDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function ScorecardDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  if (!canSeeMoney(user.role)) notFound();
  const canEdit = isSuper(user.role);

  const t = await getTranslations("scorecard");

  const scorecard = await loadScorecard(id);
  if (!scorecard) notFound();

  const sections = await loadSections(scorecard.id);

  return (
    <div className="font-inter contents">
      <DetailPage
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
        backHref="/scorecards"
        backLabel={t("title")}
        actions={
          !scorecard.isTemplate && canEdit ? (
            <StatusActions scorecardId={scorecard.id} status={scorecard.status} />
          ) : undefined
        }
      >
        <ScorecardDetailBody scorecard={scorecard} sections={sections} canEdit={canEdit} />
      </DetailPage>
    </div>
  );
}
