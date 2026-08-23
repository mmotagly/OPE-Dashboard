-- ============================================================================
-- 0012: Daily operations status — Completed is terminal, mirroring RFR stages
-- ============================================================================
-- Same shape as fn_validate_rfr_stage_transition / trg_rfr_stage_transition
-- in 0004_rfr_stage_transitions.sql: once a row is Completed, only
-- super_admin may move it to a different status (to fix a genuine mistake).
-- Fires only when status_id actually changes, so editing any other field on
-- a Completed record (remarks, driver tips, a typo fix) is unaffected.

create or replace function fn_validate_operation_status_locked()
returns trigger language plpgsql as $$
declare
  from_code text := fn_lookup_code(old.status_id);
begin
  if is_super() then
    return new;
  end if;

  if from_code = 'completed' then
    raise exception 'operation_status_locked' using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger trg_operation_status_locked before update of status_id
  on daily_vehicle_operations
  for each row
  when (old.status_id is distinct from new.status_id)
  execute function fn_validate_operation_status_locked();
