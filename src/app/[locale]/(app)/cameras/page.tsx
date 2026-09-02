import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FilterChips, type Chip } from "@/components/ui/filter-chips";
import { loadCameraBridges, loadCameras, type CameraEntity } from "./queries";
import { CameraBridgesTable, CamerasTable } from "./cameras-table";
import { CameraDrawer } from "./camera-drawer";

const newButton =
  "rounded-control border border-accent-fill bg-accent-fill px-3 py-1.5 text-button font-medium text-on-accent transition-opacity hover:opacity-90";

/**
 * Camera device registry (roadmap items 3-4). Cameras and bridges share the
 * page/drawer the way routes/stations do. Master data — supervisor and
 * above write, matching CLAUDE.md section 6 item 6.
 */
export default async function CamerasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const one = (key: string) => {
    const value = sp[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const id = one("id") || undefined;
  const mode = one("mode");
  const entity: CameraEntity = one("entity") === "bridges" ? "bridges" : "cameras";
  const isBridges = entity === "bridges";

  const t = await getTranslations("cameras");
  const tNav = await getTranslations("nav");
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const [cameras, bridges] = await Promise.all([loadCameras(), loadCameraBridges()]);

  const chips: Chip[] = [
    { value: "", label: t("camerasTab"), count: cameras.length },
    { value: "bridges", label: t("bridgesTab"), count: bridges.length },
  ];

  const baseQuery: Record<string, string> = {};
  if (isBridges) baseQuery.entity = "bridges";
  const query = { ...baseQuery };

  const drawerMode =
    canEdit && mode === "new"
      ? "new"
      : canEdit && mode === "edit" && id
        ? "edit"
        : id
          ? "view"
          : null;

  const newLabel = isBridges ? t("newBridge") : t("newCamera");

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("gpsAndCameras")}
          title={isBridges ? t("bridgesTitle") : t("camerasTitle")}
          actions={
            canEdit ? (
              <Link href={{ pathname: "/cameras", query: { ...query, mode: "new" } }} className={newButton}>
                {newLabel}
              </Link>
            ) : undefined
          }
        />

        <FilterChips chips={chips} active={isBridges ? "bridges" : ""} param="entity" pathname="/cameras" extraQuery={{}} />

        {isBridges ? (
          <CameraBridgesTable rows={bridges} selectedId={id ?? null} query={query} />
        ) : (
          <CamerasTable rows={cameras} selectedId={id ?? null} query={query} />
        )}
      </Panel>

      {drawerMode && (
        <CameraDrawer
          entity={entity}
          mode={drawerMode}
          id={id}
          closeHref={{ pathname: "/cameras", query }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
