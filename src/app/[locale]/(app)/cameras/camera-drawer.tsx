import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import {
  EMPTY_CAMERA_BRIDGE_FORM,
  EMPTY_CAMERA_FORM,
  loadCamera,
  loadCameraBridge,
  loadCameraOptions,
  toCameraBridgeFormValues,
  toCameraFormValues,
  type CameraEntity,
} from "./queries";
import { CameraBridgeForm, CameraForm } from "./camera-form";

const editButton =
  "rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90";

/**
 * Cameras and bridges share this page/drawer the same way routes/stations do
 * — `entity` in the URL says which.
 */
export async function CameraDrawer({
  entity,
  mode,
  id,
  closeHref,
  canEdit,
}: {
  entity: CameraEntity;
  mode: "view" | "new" | "edit";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("cameras");
  const tCommon = await getTranslations("common");

  const isBridges = entity === "bridges";

  if (mode === "new" || mode === "edit") {
    if (isBridges) {
      const bridge = mode === "edit" && id ? await loadCameraBridge(id) : null;
      if (mode === "edit" && !bridge) {
        return (
          <Drawer code={t("editBridge")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
            <Empty title={t("notFound")} hint={t("notFoundHint")} />
          </Drawer>
        );
      }
      return (
        <Drawer
          code={bridge ? `${t("editBridge")} · ${bridge.bridgeCode}` : t("newBridge")}
          sub={bridge?.siteName}
          closeHref={closeHref}
          closeLabel={tCommon("cancel")}
        >
          <CameraBridgeForm
            mode={bridge ? "edit" : "create"}
            bridgeId={bridge?.id}
            initial={bridge ? toCameraBridgeFormValues(bridge) : EMPTY_CAMERA_BRIDGE_FORM}
            backTo={closeHref.query}
          />
        </Drawer>
      );
    }

    const options = await loadCameraOptions();
    const camera = mode === "edit" && id ? await loadCamera(id) : null;
    if (mode === "edit" && !camera) {
      return (
        <Drawer code={t("editCamera")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }
    return (
      <Drawer
        code={camera ? `${t("editCamera")} · ${camera.cameraCode}` : t("newCamera")}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <CameraForm
          mode={camera ? "edit" : "create"}
          cameraId={camera?.id}
          options={options}
          initial={camera ? toCameraFormValues(camera) : EMPTY_CAMERA_FORM}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  /* ---- view ---- */

  if (isBridges) {
    const bridge = id ? await loadCameraBridge(id) : null;
    if (!bridge) {
      return (
        <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
        </Drawer>
      );
    }
    return (
      <Drawer
        code={bridge.bridgeCode}
        sub={bridge.siteName}
        pill={<Pill tone={bridge.isActive ? "go" : "idle"}>{bridge.isActive ? t("active") : t("inactive")}</Pill>}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
        footer={
          canEdit ? (
            <Link
              href={{ pathname: "/cameras", query: { entity: "bridges", mode: "edit", id: bridge.id } }}
              className={editButton}
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <Section title={t("record")}>
          <KeyValue>
            <Row label={t("field.baseUrl")}>{bridge.baseUrl ?? "—"}</Row>
            <Row label={t("field.cameraCount")} muted>
              <span className="tnum">{bridge.cameraCount}</span>
            </Row>
            <Row label={t("field.lastSeen")} muted>
              {bridge.lastSeenAt ? new Date(bridge.lastSeenAt).toLocaleString() : t("neverSeen")}
            </Row>
          </KeyValue>
        </Section>
      </Drawer>
    );
  }

  const camera = id ? await loadCamera(id) : null;
  if (!camera) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  return (
    <Drawer
      code={camera.cameraCode}
      sub={camera.vehicleCode ?? camera.stationName ?? undefined}
      pill={<Pill tone={camera.isActive ? "go" : "idle"}>{camera.isActive ? t("active") : t("inactive")}</Pill>}
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link href={{ pathname: "/cameras", query: { mode: "edit", id: camera.id } }} className={editButton}>
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.bridge")}>{camera.bridgeCode}</Row>
          <Row label={t("field.isapiChannel")} muted>
            <span className="tnum">{camera.isapiChannel}</span>
          </Row>
          <Row label={t("field.capabilities")} muted>
            <span className="flex justify-end gap-1.5">
              {camera.supportsLive && <Pill tone="idle">{t("live")}</Pill>}
              {camera.supportsCounting && <Pill tone="idle">{t("counting")}</Pill>}
            </span>
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("liveAndPlayback")}>
        <p className="text-[12.5px] text-ink-3">{t("bridgeProxyHint")}</p>
      </Section>
    </Drawer>
  );
}
