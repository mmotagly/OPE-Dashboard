import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";

/**
 * Auth for Route Handlers (export routes, roadmap item 7) — `requireUser`
 * in auth.ts needs a `locale` for its redirect and lives under `[locale]`,
 * neither of which applies to a route under `src/app/api/`, which is
 * locale-agnostic. Returns null rather than redirecting; callers turn that
 * into a 401. RLS on every underlying table still enforces per-row
 * visibility regardless — this is a cheap up-front reject, not the only
 * gate.
 */
export async function getRouteUser(): Promise<{ id: string; role: AppRole } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single<{ role: AppRole; is_active: boolean }>();

  if (!profile || !profile.is_active) return null;
  return { id: user.id, role: profile.role };
}
