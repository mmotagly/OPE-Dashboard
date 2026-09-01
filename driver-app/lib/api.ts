import { supabase } from "./supabase";
import { API_BASE_URL } from "./env";

/**
 * Mirrors `DriverAssignment` in the main app's `src/lib/driver-assignment.ts`
 * — kept as a separate declaration (this is a separate npm package, not a
 * shared workspace) rather than a shared types package, which would be
 * overkill for one small shape. If that server-side type changes, this one
 * needs updating by hand.
 */
export type DriverAssignment = {
  operationId: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  shiftCode: string;
  shiftLabel: string;
};

export type AssignmentResponse = {
  driver: { id: string; driverCode: string; driverName: string };
  assignments: DriverAssignment[];
};

export type PingPayload = {
  operationId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh?: number | null;
  headingDeg?: number | null;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchAssignments(): Promise<AssignmentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/driver/me/assignment`, {
    headers: await authHeader(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/**
 * Returns false (never throws) on failure — the background location task
 * treats that as "keep this ping queued, try again next tick" rather than
 * crashing the task. See lib/location-task.ts.
 */
export async function sendPing(payload: PingPayload): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/gps/driver/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
