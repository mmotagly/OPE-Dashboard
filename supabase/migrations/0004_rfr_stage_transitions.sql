-- ============================================================================
-- 0004: RFR stage-transition graph
-- ============================================================================
-- The stage rail now writes rfrs.stage_id directly (no separate confirm
-- step), so the transition rules that used to be implicit move here as the
-- authoritative gate. The TypeScript copy —
-- src/app/[locale]/(app)/rfrs/stage-rules.ts — exists only to grey out
-- invalid targets in the rail and fail fast with a translated message; keep
-- both in sync by hand if the graph changes.
--
-- Rules:
--   Pending                     -> Active, Skipped Next Trip/PM, Skipped
--   Active                      -> Skipped Next Trip/PM, Skipped,
--                                   Rolled Over, Completed  (not Pending)
--   Skipped (any) / Rolled Over -> Active only
--   Completed                   -> nothing, for anyone except super_admin
--
-- super_admin bypasses this graph entirely (to fix mistakes), but that does
-- NOT extend to the skip-reason-required or completed-needs-finished-
-- work-order preconditions — those stay enforced for every role in
-- changeStage(), unchanged by this migration.

create or replace function fn_lookup_code(p_id uuid)
returns text language sql stable as $$
  select code from lookups where id = p_id;
$$;

create or replace function fn_rfr_stage_transition_allowed(p_from text, p_to text)
returns boolean language sql stable as $$
  select
    (p_from = 'pending' and p_to in ('active','skipped_next_trip','skipped_next_pm','skipped'))
    or (p_from = 'active' and p_to in
        ('skipped_next_trip','skipped_next_pm','skipped','rolled_over','completed'))
    or (p_from in ('skipped_next_trip','skipped_next_pm','skipped','rolled_over')
        and p_to = 'active');
$$;

create or replace function fn_validate_rfr_stage_transition()
returns trigger language plpgsql as $$
declare
  from_code text := fn_lookup_code(old.stage_id);
  to_code   text := fn_lookup_code(new.stage_id);
begin
  if is_super() then
    return new;
  end if;

  if from_code = 'completed' then
    raise exception 'rfr_stage_locked' using errcode = 'P0001';
  end if;

  if not fn_rfr_stage_transition_allowed(from_code, to_code) then
    raise exception 'rfr_stage_invalid_transition' using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger trg_rfr_stage_transition before update of stage_id on rfrs
  for each row
  when (old.stage_id is distinct from new.stage_id)
  execute function fn_validate_rfr_stage_transition();
