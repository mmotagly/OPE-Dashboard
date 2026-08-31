"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { guardMaster, isDenied } from "@/lib/master";
import { dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import {
  parseCameraBridgeForm,
  parseCameraForm,
  type CameraBridgeInput,
  type CameraInput,
} from "./schema";

const BRIDGE_UNIQUE = { bridge_code: "bridgeCode" };
const CAMERA_UNIQUE = { camera_code: "cameraCode" };

const bridgeRow = (input: CameraBridgeInput) => ({
  bridge_code: input.bridgeCode,
  site_name: input.siteName,
  base_url: input.baseUrl,
  is_active: input.isActive,
});

const cameraRow = (input: CameraInput) => ({
  camera_code: input.cameraCode,
  bridge_id: input.bridgeId,
  isapi_channel: input.isapiChannel,
  vehicle_id: input.locationType === "vehicle" ? input.vehicleId : null,
  station_id: input.locationType === "station" ? input.stationId : null,
  supports_live: input.supportsLive,
  supports_counting: input.supportsCounting,
  is_active: input.isActive,
});

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ---------------- bridges ---------------- */

export async function createCameraBridge(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseCameraBridgeForm(formData);
  if (!parsed.success) return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("camera_bridges")
    .insert(bridgeRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, BRIDGE_UNIQUE);

  revalidatePath("/[locale]/cameras", "page");
  return redirect({
    href: { pathname: "/cameras", query: { entity: "bridges", selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateCameraBridge(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseCameraBridgeForm(formData);
  if (!parsed.success) return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("camera_bridges").update(bridgeRow(parsed.data)).eq("id", id);

  if (error) return dbErrorToState(error, BRIDGE_UNIQUE);

  revalidatePath("/[locale]/cameras", "page");
  return redirect({
    href: { pathname: "/cameras", query: { entity: "bridges", selected: id } },
    locale: gate.locale,
  });
}

/* ---------------- cameras ---------------- */

export async function createCamera(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseCameraForm(formData);
  if (!parsed.success) return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("cameras")
    .insert(cameraRow(parsed.data))
    .select("id")
    .single();

  if (error) return dbErrorToState(error, CAMERA_UNIQUE);

  revalidatePath("/[locale]/cameras", "page");
  return redirect({
    href: { pathname: "/cameras", query: { selected: data.id } },
    locale: gate.locale,
  });
}

export async function updateCamera(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardMaster();
  if (isDenied(gate)) return gate;

  const parsed = parseCameraForm(formData);
  if (!parsed.success) return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("cameras").update(cameraRow(parsed.data)).eq("id", id);

  if (error) return dbErrorToState(error, CAMERA_UNIQUE);

  revalidatePath("/[locale]/cameras", "page");
  return redirect({
    href: { pathname: "/cameras", query: { selected: id } },
    locale: gate.locale,
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
