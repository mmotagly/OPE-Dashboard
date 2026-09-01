import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { sendPing, type PingPayload } from "./api";

export const LOCATION_TASK_NAME = "driver-app-location-task";

/**
 * Which shift a ping belongs to, persisted (not just held in a module
 * variable) — Android can respawn the JS engine specifically to run this
 * background task, with no guarantee the module-scope state from
 * startTracking() is still around. A plain in-memory variable would make
 * tracking silently stop reporting after any such respawn, which is a much
 * worse failure than the bounded retry queue below losing a few pings — so
 * this one piece of state is worth the extra SecureStore round trip on
 * every callback, even though the queue itself intentionally isn't durable
 * (see the note on MAX_QUEUE).
 */
const ACTIVE_OPERATION_KEY = "driver-app-active-operation-id";

/**
 * Bounded, in-memory, not persisted across an app/engine restart — a
 * deliberate v1 scope line, not an oversight. It smooths over transient
 * signal loss (a dead zone on the plateau) without taking on a durable
 * on-device queue (SQLite, survives reboot) before field-testing shows
 * whether that's actually needed. Oldest pings drop first once the cap is
 * hit, so a long outage degrades to "coarser trail," not an ever-growing
 * backlog.
 */
const MAX_QUEUE = 20;
let queue: PingPayload[] = [];

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[location-task]", error.message);
    return;
  }

  const operationId = await SecureStore.getItemAsync(ACTIVE_OPERATION_KEY);
  if (!operationId) return; // stopTracking() ran (or this is a stale callback) — drop

  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations.at(-1);
  if (!latest) return;

  queue.push({
    operationId,
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    recordedAt: new Date(latest.timestamp).toISOString(),
    speedKmh: latest.coords.speed != null ? latest.coords.speed * 3.6 : null,
    headingDeg: latest.coords.heading,
  });
  if (queue.length > MAX_QUEUE) queue.shift();

  // Oldest-first, stop at the first failure rather than racing every queued
  // ping at once — keeps delivery order and avoids hammering the API the
  // moment connectivity returns after a long dead zone.
  while (queue.length > 0) {
    const ok = await sendPing(queue[0]);
    if (!ok) break;
    queue.shift();
  }
});

export type PermissionResult = "granted" | "denied" | "unavailable";

export async function requestForegroundPermission(): Promise<PermissionResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted" ? "granted" : "denied";
}

/** Only meaningful after foreground permission is already granted — Android
 * won't grant background on a phone that hasn't granted foreground first,
 * and on Android 11+ this hands off to the system Settings screen rather
 * than an in-app dialog. Call requestForegroundPermission() first. */
export async function requestBackgroundPermission(): Promise<PermissionResult> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted" ? "granted" : "denied";
}

export async function startTracking(operationId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_OPERATION_KEY, operationId);
  queue = [];

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    // Balanced can be satisfied from cell/Wi-Fi positioning alone, without
    // ever acquiring a real GPS fix — that's a multi-km error, not just a
    // lower-resolution one. High forces the fused provider to prefer GPS.
    accuracy: Location.Accuracy.High,
    timeInterval: 20_000,
    distanceInterval: 30,
    foregroundService: {
      notificationTitle: "Pyramids Shuttle — tracking active",
      notificationBody: "Sharing your location with dispatch for this shift",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopTracking(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_OPERATION_KEY);
  queue = [];
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}
