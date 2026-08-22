/**
 * The RFR stage-transition graph. Mirrors the authoritative DB trigger —
 * fn_validate_rfr_stage_transition in
 * supabase/migrations/0004_rfr_stage_transitions.sql — which is the real
 * gate. This copy exists only to grey out invalid targets in the stage rail
 * and fail fast with a translated message before the write; keep both in
 * sync by hand if the graph changes.
 */
const GRAPH: Record<string, readonly string[]> = {
  pending: ["active", "skipped_next_trip", "skipped_next_pm", "skipped"],
  active: ["skipped_next_trip", "skipped_next_pm", "skipped", "rolled_over", "completed"],
  skipped_next_trip: ["active"],
  skipped_next_pm: ["active"],
  skipped: ["active"],
  rolled_over: ["active"],
  completed: [],
};

/**
 * super_admin bypasses the graph entirely (to fix mistakes), but this never
 * touches the separate skip-reason-required or
 * completed-needs-finished-work-order preconditions — those stay enforced
 * for every role in changeStage().
 */
export function canTransition(
  fromCode: string,
  toCode: string,
  isSuperAdmin: boolean,
): boolean {
  if (fromCode === toCode) return false;
  if (isSuperAdmin) return true;
  return GRAPH[fromCode]?.includes(toCode) ?? false;
}
