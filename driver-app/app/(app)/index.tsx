import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { supabase } from "../../lib/supabase";
import { fetchAssignments, type DriverAssignment, type AssignmentResponse } from "../../lib/api";
import {
  requestForegroundPermission,
  requestBackgroundPermission,
  startTracking,
  stopTracking,
  isTracking,
} from "../../lib/location-task";
import { colors } from "../../lib/theme";

/**
 * The one screen this v1 app has. State machine mirrors what
 * GET /api/driver/me/assignment can return: no rows today, exactly one, or
 * more than one (both shifts assigned — the driver picks, since this
 * schema has no clock-derived "current shift" to guess from; see
 * lib/driver-assignment.ts on the server side).
 */
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unassigned" }
  | { kind: "choose"; assignments: DriverAssignment[] }
  | { kind: "ready"; assignment: DriverAssignment };

export default function ShiftScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [driver, setDriver] = useState<AssignmentResponse["driver"] | null>(null);
  const [tracking, setTracking] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // Covers the whole permission-request round trip in beginShift(), which
  // can include a real hand-off to Android's own Settings screen for
  // background location — without this the Start Shift button (or a shift
  // card) just sits there with zero feedback for however long that takes.
  const [starting, setStarting] = useState(false);
  // Non-null while showing the background-location explainer — foreground
  // permission is already granted, we're waiting on the driver to tap
  // Continue before asking for background, since the very next step is
  // Android's own "Allow all the time" Settings hand-off (no in-app
  // dialog) and landing on that cold, with zero context, reads as
  // suspicious enough that people decline it.
  const [pendingAssignment, setPendingAssignment] = useState<DriverAssignment | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetchAssignments();
      setDriver(res.driver);
      if (res.assignments.length === 0) setState({ kind: "unassigned" });
      else if (res.assignments.length === 1) setState({ kind: "ready", assignment: res.assignments[0] });
      else setState({ kind: "choose", assignments: res.assignments });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load" });
    }
  }, []);

  useEffect(() => {
    load();
    isTracking().then(setTracking);
  }, [load]);

  async function beginShift(assignment: DriverAssignment) {
    setPermissionError(null);
    setStarting(true);
    try {
      const fg = await requestForegroundPermission();
      if (fg !== "granted") {
        setPermissionError("Location permission is required to start tracking.");
        return;
      }
      // Foreground alone is enough to explain background next — hand off
      // to the explainer screen rather than requesting it immediately.
      setPendingAssignment(assignment);
    } finally {
      setStarting(false);
    }
  }

  async function confirmBackgroundPermission() {
    const assignment = pendingAssignment;
    if (!assignment) return;
    setStarting(true);
    try {
      const bg = await requestBackgroundPermission();
      if (bg !== "granted") {
        setPermissionError(
          'Background location must be set to "Allow all the time" — tracking stops the moment ' +
            "the app is minimized or the screen locks otherwise. Open Settings below to change it.",
        );
        setPendingAssignment(null);
        return;
      }

      await startTracking(assignment.operationId);
      setTracking(true);
      setState({ kind: "ready", assignment });
      setPendingAssignment(null);
    } finally {
      setStarting(false);
    }
  }

  async function endShift() {
    await stopTracking();
    setTracking(false);
  }

  if (pendingAssignment) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Keep sharing location in the background?</Text>
        <Text style={styles.subtitle}>
          Your screen won't stay on for a whole shift — to keep dispatch seeing{" "}
          {pendingAssignment.vehicleCode} on the live map while the app is minimized or your phone
          is locked, the next screen needs "Allow all the time," not just "while using the app."
        </Text>
        <Text style={styles.subtitle}>
          You'll see Android's own permission screen next — pick "Allow all the time," then use
          the back arrow to come right back here.
        </Text>

        <Pressable
          style={[styles.button, starting && styles.buttonDisabled]}
          onPress={confirmBackgroundPermission}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color={colors.canvas} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.buttonSecondary}
          onPress={() => setPendingAssignment(null)}
          disabled={starting}
        >
          <Text style={styles.buttonSecondaryText}>Not now</Text>
        </Pressable>
      </View>
    );
  }

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
        <Pressable style={styles.buttonSecondary} onPress={load}>
          <Text style={styles.buttonSecondaryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (state.kind === "unassigned") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No shift today</Text>
        <Text style={styles.subtitle}>
          You're not assigned to a vehicle today yet. Check with dispatch, then refresh.
        </Text>
        <Pressable style={styles.buttonSecondary} onPress={load}>
          <Text style={styles.buttonSecondaryText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  if (state.kind === "choose") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Which shift are you starting?</Text>
        <Text style={styles.subtitle}>You're assigned to both shifts today — pick the one starting now.</Text>
        {state.assignments.map((a) => (
          <Pressable
            key={a.operationId}
            style={[styles.card, starting && styles.cardDisabled]}
            onPress={() => beginShift(a)}
            disabled={starting}
          >
            <Text style={styles.cardTitle}>{a.shiftLabel}</Text>
            <Text style={styles.cardSubtitle}>
              {a.vehicleCode} · {a.plateNumber}
            </Text>
          </Pressable>
        ))}
        {starting ? (
          <View style={styles.startingRow}>
            <ActivityIndicator color={colors.ink2} />
            <Text style={styles.subtitle}>Requesting location permission…</Text>
          </View>
        ) : null}
        {permissionError ? <Text style={styles.error}>{permissionError}</Text> : null}
      </View>
    );
  }

  const { assignment } = state;
  return (
    <View style={styles.container}>
      {driver ? <Text style={styles.subtitle}>{driver.driverName}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{assignment.shiftLabel}</Text>
        <Text style={styles.cardSubtitle}>
          {assignment.vehicleCode} · {assignment.plateNumber}
        </Text>
      </View>

      {permissionError ? <Text style={styles.error}>{permissionError}</Text> : null}

      {tracking ? (
        <>
          {/* Amber, not green — this is CLAUDE.md's documented one-off:
              amber marks "still running" so it reads apart from a
              completed/finished state at a glance, not just from the text. */}
          <Text style={styles.statusOn}>● Tracking active</Text>
          <Pressable style={styles.buttonDanger} onPress={endShift}>
            <Text style={styles.buttonDangerText}>Stop shift</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.button, starting && styles.buttonDisabled]}
          onPress={() => beginShift(assignment)}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color={colors.canvas} />
          ) : (
            <Text style={styles.buttonText}>Start shift</Text>
          )}
        </Pressable>
      )}

      {permissionError ? (
        <Pressable style={styles.buttonSecondary} onPress={() => Linking.openSettings()}>
          <Text style={styles.buttonSecondaryText}>Open app settings</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: 20, gap: 16 },
  center: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  subtitle: { color: colors.ink2, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  cardSubtitle: { color: colors.ink2, fontSize: 13, marginTop: 4 },
  cardDisabled: { opacity: 0.6 },
  startingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: { backgroundColor: colors.ink, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.canvas, fontWeight: "600" },
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
  statusOn: { color: colors.warn, fontSize: 14, fontWeight: "500" },
  error: { color: colors.stop, fontSize: 13 },
  signOut: { marginTop: "auto", alignItems: "center", padding: 12 },
  signOutText: { color: colors.ink3, fontSize: 13 },
});
