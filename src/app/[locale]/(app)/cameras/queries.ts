import { createClient } from "@/lib/supabase/server";

/** The page lists one of two entities; `entity` in the URL says which. */
export type CameraEntity = "cameras" | "bridges";

export type CameraBridgeRow = {
  id: string;
  bridgeCode: string;
  siteName: string;
  baseUrl: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  cameraCount: number;
};

export type CameraRow = {
  id: string;
  cameraCode: string;
  bridgeId: string;
  bridgeCode: string;
  isapiChannel: number;
  vehicleId: string | null;
  vehicleCode: string | null;
  stationId: string | null;
  stationName: string | null;
  supportsLive: boolean;
  supportsCounting: boolean;
  isActive: boolean;
};

export type CameraBridgeFormValues = {
  bridgeCode: string;
  siteName: string;
  baseUrl: string;
  isActive: boolean;
};

export type CameraFormValues = {
  cameraCode: string;
  bridgeId: string;
  isapiChannel: string;
  locationType: "vehicle" | "station";
  vehicleId: string;
  stationId: string;
  supportsLive: boolean;
  supportsCounting: boolean;
  isActive: boolean;
};

export type CameraOptions = {
  bridges: { id: string; bridgeCode: string; siteName: string }[];
  vehicles: { id: string; vehicleCode: string }[];
  stations: { id: string; stationCode: string; stationName: string }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function loadCameraBridges(): Promise<CameraBridgeRow[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("camera_bridges")
    .select("id, bridge_code, site_name, base_url, last_seen_at, is_active, cameras ( id )")
    .order("bridge_code");

  return (data ?? []).map((b: any) => ({
    id: b.id,
    bridgeCode: b.bridge_code,
    siteName: b.site_name,
    baseUrl: b.base_url,
    lastSeenAt: b.last_seen_at,
    isActive: b.is_active,
    cameraCount: Array.isArray(b.cameras) ? b.cameras.length : 0,
  }));
}

export async function loadCameraBridge(id: string): Promise<CameraBridgeRow | null> {
  const rows = await loadCameraBridges();
  return rows.find((r) => r.id === id) ?? null;
}

export async function loadCameras(): Promise<CameraRow[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("cameras")
    .select(
      `id, camera_code, bridge_id, isapi_channel, vehicle_id, station_id,
       supports_live, supports_counting, is_active,
       camera_bridges ( bridge_code ),
       vehicles ( vehicle_code ),
       stations ( station_name )`,
    )
    .order("camera_code");

  return (data ?? []).map((c: any) => {
    const bridge = Array.isArray(c.camera_bridges) ? c.camera_bridges[0] : c.camera_bridges;
    const vehicle = Array.isArray(c.vehicles) ? c.vehicles[0] : c.vehicles;
    const station = Array.isArray(c.stations) ? c.stations[0] : c.stations;
    return {
      id: c.id,
      cameraCode: c.camera_code,
      bridgeId: c.bridge_id,
      bridgeCode: bridge?.bridge_code ?? "—",
      isapiChannel: c.isapi_channel,
      vehicleId: c.vehicle_id,
      vehicleCode: vehicle?.vehicle_code ?? null,
      stationId: c.station_id,
      stationName: station?.station_name ?? null,
      supportsLive: c.supports_live,
      supportsCounting: c.supports_counting,
      isActive: c.is_active,
    };
  });
}

export async function loadCamera(id: string): Promise<CameraRow | null> {
  const rows = await loadCameras();
  return rows.find((r) => r.id === id) ?? null;
}

export async function loadCameraOptions(): Promise<CameraOptions> {
  const supabase = await createClient();
  const [bridges, vehicles, stations] = await Promise.all([
    (supabase as any).from("camera_bridges").select("id, bridge_code, site_name").order("bridge_code"),
    supabase.from("vehicles").select("id, vehicle_code").order("vehicle_code"),
    supabase.from("stations").select("id, station_code, station_name").order("station_code"),
  ]);

  return {
    bridges: (bridges.data ?? []).map((b: any) => ({
      id: b.id,
      bridgeCode: b.bridge_code,
      siteName: b.site_name,
    })),
    vehicles: (vehicles.data ?? []).map((v) => ({ id: v.id, vehicleCode: v.vehicle_code })),
    stations: (stations.data ?? []).map((s) => ({
      id: s.id,
      stationCode: s.station_code,
      stationName: s.station_name,
    })),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function toCameraBridgeFormValues(row: CameraBridgeRow): CameraBridgeFormValues {
  return {
    bridgeCode: row.bridgeCode,
    siteName: row.siteName,
    baseUrl: row.baseUrl ?? "",
    isActive: row.isActive,
  };
}

export function toCameraFormValues(row: CameraRow): CameraFormValues {
  return {
    cameraCode: row.cameraCode,
    bridgeId: row.bridgeId,
    isapiChannel: String(row.isapiChannel),
    locationType: row.vehicleId ? "vehicle" : "station",
    vehicleId: row.vehicleId ?? "",
    stationId: row.stationId ?? "",
    supportsLive: row.supportsLive,
    supportsCounting: row.supportsCounting,
    isActive: row.isActive,
  };
}

export const EMPTY_CAMERA_BRIDGE_FORM: CameraBridgeFormValues = {
  bridgeCode: "",
  siteName: "",
  baseUrl: "",
  isActive: true,
};

export const EMPTY_CAMERA_FORM: CameraFormValues = {
  cameraCode: "",
  bridgeId: "",
  isapiChannel: "1",
  locationType: "vehicle",
  vehicleId: "",
  stationId: "",
  supportsLive: true,
  supportsCounting: false,
  isActive: true,
};
