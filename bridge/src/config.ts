import { readFileSync } from "node:fs";
import "dotenv/config";

/**
 * Per-camera connection details. Deliberately a JSON file rather than one
 * env var per camera — the fleet has an unknown-but-growing number of
 * cameras, and `CAMERA_1_IP`, `CAMERA_2_IP`, ... doesn't scale. Real IPs
 * and ISAPI credentials go in `cameras.config.json` (gitignored — see
 * `cameras.config.example.json` for the shape); this file is the one
 * genuine config slot in the whole bridge; nothing here is guessed or
 * faked.
 *
 * `camera_code` here must match the `camera_code` column on the `cameras`
 * table in the main app's database — that's how a request for "camera
 * BUS-014-CAM1" gets routed to the right IP/channel.
 */
export type CameraConfig = {
  cameraCode: string;
  ip: string;
  port: number;
  isapiUsername: string;
  isapiPassword: string;
  channel: number;
};

type RawFile = {
  cameras: {
    camera_code: string;
    ip: string;
    port?: number;
    isapi_username: string;
    isapi_password: string;
    channel: number;
  }[];
};

function loadCameras(): CameraConfig[] {
  const path = process.env.CAMERAS_CONFIG_PATH ?? "./cameras.config.json";
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as RawFile;
    return raw.cameras.map((c) => ({
      cameraCode: c.camera_code,
      ip: c.ip,
      port: c.port ?? 80,
      isapiUsername: c.isapi_username,
      isapiPassword: c.isapi_password,
      channel: c.channel,
    }));
  } catch {
    // No config file yet — the honest state before any real camera is on
    // site. Every route below reports "camera not configured" rather than
    // crashing the server.
    return [];
  }
}

const cameras = loadCameras();

export function findCamera(cameraCode: string): CameraConfig | undefined {
  return cameras.find((c) => c.cameraCode === cameraCode);
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  // Shared secret the main app sends on every request — must match
  // CAMERA_BRIDGE_SHARED_SECRET in the main app's own env. Unset means
  // every request is rejected (fails closed), same convention as the GPS
  // webhook route.
  sharedSecret: process.env.BRIDGE_SHARED_SECRET,
};
