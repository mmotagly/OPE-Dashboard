import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteOps, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadChargingSession } from "../queries";
import { ChargingDetailBody } from "../charging-drawer";

/**
 * Standalone full-page view — reached by clicking a session's code in the
 * list, as opposed to clicking anywhere else in the row (which still opens
 * the overlay Drawer at /charging?id=...). Same detail content
 * (ChargingDetailBody), different chrome (DetailPage vs. Drawer). See
 * CLAUDE.md's row-click-vs-code-link convention.
 */
export default async function ChargingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteOps(user.role);

  const t = await getTranslations("charging");
  const tCommon = await getTranslations("common");

  const session = await loadChargingSession(id);
  if (!session) notFound();

  return (
    <div className="font-inter contents">
      <DetailPage
        code={session.sessionCode}
        sub={`${session.vehicleCode} · ${session.plateNumber}`}
        pill={<Pill tone="idle">{session.plugsUsed}</Pill>}
        backHref="/charging"
        backLabel={t("title")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/charging", query: { mode: "edit", id: session.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <ChargingDetailBody session={session} />
      </DetailPage>
    </div>
  );
}
