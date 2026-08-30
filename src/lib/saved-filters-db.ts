import { createClient } from "@/lib/supabase/server";

/**
 * Small indirection so every saved-filters query goes through one place,
 * rather than each caller repeating `createClient()` + `.from("saved_filters")`.
 */
export async function savedFiltersTable() {
  const supabase = await createClient();
  return supabase.from("saved_filters");
}
