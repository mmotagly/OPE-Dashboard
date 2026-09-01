"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * Driver-app camera streaming, web viewer half (roadmap item 10). A staff
 * member watching a driver's live phone camera for one operation — the
 * driver-app half publishes into the exact same room
 * (`op-<operationId>`), minted by the same /api/livekit/token route with a
 * publish-only grant instead of this component's subscribe-only one.
 *
 * Not auto-connected: fetching a token and opening a WebRTC connection for
 * every operation row a staff member happens to view would be wasteful
 * (and noisy — an RFR/PM-page-style "always-on" widget isn't how live
 * camera watching should work). A deliberate "Watch live" tap.
 */
export function CameraViewer({ operationId }: { operationId: string }) {
  const t = useTranslations("operations");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "connected"; token: string; url: string }
  >({ kind: "idle" });

  async function connect() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? t("cameraUnavailable") });
        return;
      }
      setState({ kind: "connected", token: body.token, url: body.url });
    } catch {
      setState({ kind: "error", message: t("cameraUnavailable") });
    }
  }

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={state.kind === "loading"}
        className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise disabled:opacity-60"
      >
        {state.kind === "loading" ? t("connecting") : t("watchLive")}
      </button>
    );
  }

  if (state.kind === "error") {
    return <p className="text-[12.5px] text-stop-text">{state.message}</p>;
  }

  return (
    <LiveKitRoom
      serverUrl={state.url}
      token={state.token}
      connect
      data-lk-theme="default"
      style={{ height: 260, borderRadius: 10, overflow: "hidden" }}
      onDisconnected={() => setState({ kind: "idle" })}
    >
      <CameraGrid emptyLabel={t("waitingForStream")} />
    </LiveKitRoom>
  );
}

function CameraGrid({ emptyLabel }: { emptyLabel: string }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });

  if (tracks.length === 0) {
    return (
      <div className="grid h-full place-items-center bg-raise text-[12px] text-ink-3">
        {emptyLabel}
      </div>
    );
  }

  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  );
}
