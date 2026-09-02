import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, isSuper, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import {
  loadRfr,
  loadRfrIssues,
  loadRfrOptions,
  loadRfrWorkOrders,
  loadStageVisits,
  loadStages,
} from "../queries";
import { railState, stagePillTone } from "../stage-tone";
import { RfrDetailBody } from "../rfr-drawer";
import type { Stage } from "@/components/ui/stage-rail";

/**
 * Standalone full-page view — reached by clicking an RFR's number in the
 * list, as opposed to clicking anywhere else in the row (which still opens
 * the overlay Drawer at /rfrs?id=...). Same detail content (RfrDetailBody),
 * different chrome (DetailPage vs. Drawer). See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export default async function RfrDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);
  const isSuperAdmin = isSuper(user.role);

  const t = await getTranslations("rfr");
  const tCommon = await getTranslations("common");

  const rfr = await loadRfr(id);
  if (!rfr) notFound();

  const [issues, workOrders, visits, options, stages] = await Promise.all([
    loadRfrIssues(rfr.id),
    loadRfrWorkOrders(rfr.id),
    loadStageVisits(rfr.id),
    loadRfrOptions(),
    loadStages(),
  ]);

  const visited = new Set(visits.map((v) => v.stageId));
  const rail: Stage[] = stages.map((s) => ({
    code: s.code,
    label: s.labelEn,
    state: railState(s.code, s.id === rfr.stageId, visited.has(s.id)),
  }));

  return (
    <div className="font-inter contents">
      <DetailPage
        code={rfr.rfrNumber}
        sub={`${rfr.vehicleCode} · ${rfr.plateNumber} · ${rfr.requestAt.slice(0, 16).replace("T", " ")}`}
        pill={
          rfr.stageLabel ? (
            <Pill tone={stagePillTone(rfr.stageCode)}>{rfr.stageLabel}</Pill>
          ) : undefined
        }
        backHref="/rfrs"
        backLabel={t("title")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/rfrs", query: { mode: "edit", id: rfr.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <RfrDetailBody
          rfr={rfr}
          issues={issues}
          workOrders={workOrders}
          options={options}
          stages={stages}
          rail={rail}
          canEdit={canEdit}
          isSuperAdmin={isSuperAdmin}
        />
      </DetailPage>
    </div>
  );
}
