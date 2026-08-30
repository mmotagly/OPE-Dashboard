import { createClient } from "@/lib/supabase/server";

/**
 * Read side of the activity log. `super_admin` only — the page refuses
 * everyone else, matching Settings' own scoping (same "Administration" area).
 * Reads v_audit_log (supabase/migrations/0015_audit_log.sql), never computes
 * anything here — the view already resolves the actor's name.
 */

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

  let query = supabase
    .from("v_audit_log")
    .select("id, entity_type, entity_id, action, actor_id, actor_name, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;
  if (error) throw error;

  // Every column is non-null in practice — audit_log's own columns are all
  // `not null` except actor_id (0015), the view just can't express that in
  // its generated types, since PostgREST types every view column nullable.
  return (data ?? []).map((r) => ({
    id: r.id!,
    entityType: r.entity_type!,
    entityId: r.entity_id!,
    action: r.action!,
    actorId: r.actor_id,
    actorName: r.actor_name,
    detail: (r.detail ?? {}) as Record<string, unknown>,
    createdAt: r.created_at!,
  }));
}
