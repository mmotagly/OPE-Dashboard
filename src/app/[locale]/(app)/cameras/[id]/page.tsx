import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadCamera, loadCameraBridge } from "../queries";
import { CameraBridgeDetailBody, CameraDetailBody } from "../camera-drawer";

const editButton =
  "rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90";

/**
 * Standalone full-page view — reached by clicking a camera's or bridge's
 * code in the list, as opposed to clicking anywhere else in the row (which
 * still opens the overlay Drawer at /cameras?id=...). Which entity is shown
 * follows `?entity=`, same as the Drawer follows the table's own `entity`
 * filter. Same detail content (CameraDetailBody / CameraBridgeDetailBody),
 * different chrome (DetailPage vs. Drawer). See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export default async function CameraOrBridgeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ entity?: string }>;
}) {
  const { locale, id } = await params;
  const { entity } = await searchParams;
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const t = await getTranslations("cameras");
  const tCommon = await getTranslations("common");

  if (entity === "bridge") {
    const bridge = await loadCameraBridge(id);
    if (!bridge) notFound();

    return (
      <div className="font-inter contents">
        <DetailPage
          code={bridge.bridgeCode}
          sub={bridge.siteName}
          pill={
            <Pill tone={bridge.isActive ? "go" : "idle"}>
              {bridge.isActive ? t("active") : t("inactive")}
            </Pill>
          }
          backHref="/cameras"
          backLabel={t("bridgesTitle")}
          actions={
            canEdit ? (
              <Link
                href={{
                  pathname: "/cameras",
                  query: { entity: "bridges", mode: "edit", id: bridge.id },
                }}
                className={editButton}
              >
                {tCommon("edit")}
              </Link>
            ) : undefined
          }
        >
          <CameraBridgeDetailBody bridge={bridge} />
        </DetailPage>
      </div>
    );
  }

  const camera = await loadCamera(id);
  if (!camera) notFound();

  return (
    <div className="font-inter contents">
      <DetailPage
        code={camera.cameraCode}
        sub={camera.vehicleCode ?? camera.stationName ?? undefined}
        pill={
          <Pill tone={camera.isActive ? "go" : "idle"}>
            {camera.isActive ? t("active") : t("inactive")}
          </Pill>
        }
        backHref="/cameras"
        backLabel={t("camerasTitle")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/cameras", query: { mode: "edit", id: camera.id } }}
              className={editButton}
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <CameraDetailBody camera={camera} />
      </DetailPage>
    </div>
  );
}
