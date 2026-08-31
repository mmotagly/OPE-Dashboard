import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client — bypasses RLS entirely. Only for server code with no
 * logged-in user to act as: GPS ingestion (webhook/poll routes) and the
 * camera bridge proxy (roadmap items 2-4), both called by external systems
 * rather than an authenticated app session. `createClient()` in server.ts
 * (cookie-based, RLS-scoped to the real user) stays the default for
 * everything else — reach for this only where that genuinely doesn't apply.
 *
 * Never import this into a Client Component or anything that could ship to
 * the browser: SUPABASE_SERVICE_ROLE_KEY has full database access.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — required for server-to-server ingestion routes.",
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
