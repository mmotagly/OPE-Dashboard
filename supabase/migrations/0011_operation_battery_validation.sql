-- ============================================================================
-- 0011: Daily operations status — battery % follows the same status rules as KM
-- ============================================================================
-- Starting/ending battery % had no status-conditional validation at all —
-- fn_validate_operation_status (0009) only ever checked driver/KM/operating %.
-- Same three-tier shape as the KM checks: Operating requires a starting
-- reading and forbids an ending one; Completed requires both; every other
-- status forbids both, folded into that branch's existing "must be blank"
-- check alongside driver/KM/operating %.

create or replace function fn_validate_operation_status()
returns trigger language plpgsql as $$
declare
  status_code text := fn_lookup_code(new.status_id);
begin
  if status_code = 'operating' then
    if new.driver_id is null then
      raise exception 'operation_requires_driver' using errcode = 'P0001';
    end if;
    if new.starting_odometer_km is null then
      raise exception 'operating_requires_start_km' using errcode = 'P0001';
    end if;
    if new.ending_odometer_km is not null then
      raise exception 'operating_forbids_end_km' using errcode = 'P0001';
    end if;
    if new.starting_battery_pct is null then
      raise exception 'operating_requires_start_battery' using errcode = 'P0001';
    end if;
    if new.ending_battery_pct is not null then
      raise exception 'operating_forbids_end_battery' using errcode = 'P0001';
    end if;

  elsif status_code = 'completed' then
    if new.driver_id is null then
      raise exception 'operation_requires_driver' using errcode = 'P0001';
    end if;
    if new.starting_odometer_km is null or new.ending_odometer_km is null then
      raise exception 'completed_requires_both_km' using errcode = 'P0001';
    end if;
    if new.starting_battery_pct is null or new.ending_battery_pct is null then
      raise exception 'completed_requires_both_battery' using errcode = 'P0001';
    end if;

  else
    -- planned / cancelled_by_vendor / cancelled_by_tmf / cancelled_by_ope /
    -- under_maintenance
    if new.driver_id is not null or new.starting_odometer_km is not null
       or new.ending_odometer_km is not null or new.operating_percentage is not null
       or new.starting_battery_pct is not null or new.ending_battery_pct is not null then
      raise exception 'non_operating_status_requires_blank_fields' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;
