import { z } from "zod";
import { checkbox, optionalId, optionalText, readFields, requiredText, requiredNumber } from "@/lib/forms";

export const cameraBridgeSchema = z.object({
  bridgeCode: requiredText(60),
  siteName: requiredText(200),
  baseUrl: optionalText(500),
  isActive: checkbox,
});

export type CameraBridgeInput = z.infer<typeof cameraBridgeSchema>;

export const CAMERA_BRIDGE_FIELDS = ["bridgeCode", "siteName", "baseUrl", "isActive"] as const;

export const parseCameraBridgeForm = (formData: FormData) =>
  cameraBridgeSchema.safeParse(readFields(formData, CAMERA_BRIDGE_FIELDS));

/** Exactly one of vehicleId/stationId, matching the DB's `num_nonnulls` check. */
export const cameraSchema = z
  .object({
    cameraCode: requiredText(60),
    bridgeId: optionalId,
    isapiChannel: requiredNumber,
    locationType: z.enum(["vehicle", "station"], { errorMap: () => ({ message: "required" }) }),
    vehicleId: optionalId,
    stationId: optionalId,
    supportsLive: checkbox,
    supportsCounting: checkbox,
    isActive: checkbox,
  })
  .refine((v) => v.bridgeId !== null, { message: "required", path: ["bridgeId"] })
  .refine((v) => (v.locationType === "vehicle" ? v.vehicleId !== null : v.stationId !== null), {
    message: "required",
    path: ["locationType"],
  });

export type CameraInput = z.infer<typeof cameraSchema>;

export const CAMERA_FIELDS = [
  "cameraCode",
  "bridgeId",
  "isapiChannel",
  "locationType",
  "vehicleId",
  "stationId",
  "supportsLive",
  "supportsCounting",
  "isActive",
] as const;

export const parseCameraForm = (formData: FormData) =>
  cameraSchema.safeParse(readFields(formData, CAMERA_FIELDS));
