import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LiveKitRoom, useLocalParticipant, VideoTrack, AudioSession } from "@livekit/react-native";
import { Track } from "livekit-client";
import { fetchLiveKitToken, type LiveKitCredentials } from "../../lib/api";
import { colors } from "../../lib/theme";

/**
 * Camera streaming, driver-app half (roadmap item 10). Reached from the
 * shift screen's "Camera" button, only while tracking is active — the
 * operationId it's given is the exact same one GPS pings already use, so
 * the server-side authorization (POST /api/livekit/token) is the same
 * "is this genuinely today's assignment" check the ping route does, not a
 * new trust boundary.
 *
 * Not yet verified against a real LiveKit server — there is no
 * LIVEKIT_URL/API_KEY/API_SECRET configured anywhere (STATUS.md has the
 * exact activation steps). Written and typechecked, but until that config
 * exists this screen can only ever reach the token route's 503.
 */
export default function CameraScreen() {
  const { operationId } = useLocalSearchParams<{ operationId?: string }>();
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; creds: LiveKitCredentials }
  >({ kind: "loading" });

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (!operationId) {
      setState({ kind: "error", message: "No active shift to stream for." });
      return;
    }
    fetchLiveKitToken(operationId)
      .then((creds) => setState({ kind: "ready", creds }))
      .catch((e) =>
        setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to connect" }),
      );
  }, [operationId]);

  if (state.kind === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{state.message}</Text>
        <Pressable style={styles.buttonSecondary} onPress={() => router.back()}>
          <Text style={styles.buttonSecondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={state.creds.url}
      token={state.creds.token}
      connect
      audio
      video
      onDisconnected={() => router.back()}
    >
      <View style={styles.container}>
        <LocalPreview />
        <Pressable style={styles.buttonDanger} onPress={() => router.back()}>
          <Text style={styles.buttonDangerText}>Stop streaming</Text>
        </Pressable>
      </View>
    </LiveKitRoom>
  );
}

function LocalPreview() {
  const { localParticipant, isCameraEnabled, cameraTrack } = useLocalParticipant();

  return (
    <View style={styles.preview}>
      {isCameraEnabled && cameraTrack ? (
        <VideoTrack
          trackRef={{ participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }}
          style={styles.video}
        />
      ) : (
        <ActivityIndicator color={colors.ink} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: 16, gap: 16 },
  center: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  preview: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
  buttonDanger: { backgroundColor: colors.stop, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonDangerText: { color: colors.ink, fontWeight: "600" },
  buttonSecondary: {
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  buttonSecondaryText: { color: colors.ink2, fontWeight: "500" },
  error: { color: colors.stop, fontSize: 13, textAlign: "center" },
});
