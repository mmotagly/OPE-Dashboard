import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/service";

/**
 * Auth for the driver companion app (GPS phase, migration 0021). A driver's
 * Supabase session satisfies none of the RLS policies in 0001_init.sql — no
 * profiles row, no app_role, by design (see 0021's header: drivers aren't
 * staff and shouldn't be shoehorned into can_read()/can_write_ops()). So
 * every driver-facing route validates the caller's bearer token itself and
 * reads via the service-role client, the same pattern already used for GPS
 * ingestion and the camera bridge — never RLS for this actor.
 */

export type AuthenticatedDriver = {
  id: string;
  driverCode: string;
  driverName: string;
};

/**
 * Resolves the caller of a driver-app request from its `Authorization:
 * Bearer <token>` header. Two steps, deliberately not one: `auth.getUser`
 * only proves the token is a real, current Supabase session — it says
 * nothing about whether that person is a provisioned driver. The
 * `drivers.auth_user_id` lookup is what actually authorizes them for this
 * app; a staff member's valid session (e.g. a stolen/misused token) still
 * resolves to nothing here, since no profiles row is ever linked that way.
 */
export async function resolveDriver(request: Request): Promise<AuthenticatedDriver | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: userResult, error: userError } = await anon.auth.getUser(token);
  if (userError || !userResult.user) return null;

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from("drivers")
    .select("id, driver_code, driver_name")
    .eq("auth_user_id", userResult.user.id)
    .maybeSingle();
  if (error || !data) return null;

  return { id: data.id, driverCode: data.driver_code, driverName: data.driver_name };
}
