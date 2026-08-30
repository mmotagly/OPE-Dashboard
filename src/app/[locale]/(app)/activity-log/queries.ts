import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the activity log. `super_admin` only — the page refuses
 * everyone else, matching Settings' own scoping (same "Administration" area).
 * Reads v_audit_log (supabase/migrations/0015_audit_log.sql), never computes
 * anything here — the view already resolves the actor's name.
 *
 * `v_audit_log` ships in migration 0015, newer than the checked-in generated
 * types, so the typed client does not know it exists yet — same gap and same
 * one-line-wide `as any` bridge as `saved_filters` in
 * src/lib/saved-filters-db.ts. Running the migration and regenerating types
 * makes the cast removable.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type EntityType = "rfr" | "operation" | "invoice";

export type AuditLogRow = {
  id: string;
  entityType: EntityType | string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

const LIMIT = 300;

export async function loadAuditLog(entityType: string): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  let query = (supabase as any)
    .from("v_audit_log")
    .select("id, entity_type, entity_id, action, actor_id, actor_name, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    action: r.action as string,
    actorId: (r.actor_id ?? null) as string | null,
    actorName: (r.actor_name ?? null) as string | null,
    detail: (r.detail ?? {}) as Record<string, unknown>,
    createdAt: r.created_at as string,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
