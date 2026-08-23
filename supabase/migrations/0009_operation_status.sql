-- ============================================================================
-- 0009: Daily operations status — Phase 1 (schema + validation trigger only)
-- ============================================================================
-- Real statuses replace the endKm-derived pseudo-status the UI has been
-- computing on its own (see operations-table.tsx, operation-drawer.tsx,
-- filters.ts, day-board — all five independently did `endKm === null`).
--
-- This migration ships with a compatibility shim in operations/actions.ts
-- (same commit) that sets status_id explicitly from today's form data —
-- 'completed' when ending_odometer_km is present, 'operating' otherwise —
-- so the *existing* "New operation" form keeps working unchanged. Without
-- that shim, the validation trigger below would reject every submission
-- from the current form the moment this migration runs, since the new
-- default ('planned') requires driver_id/KM to be null and the current
-- form always supplies them.
--
-- The real status picker, and the fuller UI, are later phases.

insert into lookup_categories (key, label) values
  ('operation_status', 'Operation Status');

insert into lookups (category, code, label_en, sort_order) values
  ('operation_status','planned',            'Planned',              1),
  ('operation_status','operating',          'Operating',            2),
  ('operation_status','completed',          'Completed',            3),
  ('operation_status','cancelled_by_vendor','Cancelled By Vendor',  4),
  ('operation_status','cancelled_by_tmf',   'Cancelled By TMF',     5),
  ('operation_status','cancelled_by_ope',   'Cancelled By OPE',     6),
  ('operation_status','under_maintenance',  'Under Maintenance',    7);

-- ---- schema: relax what's required at creation, add status_id -------------

alter table daily_vehicle_operations
  alter column driver_id drop not null,
  alter column starting_odometer_km drop not null;

alter table daily_vehicle_operations
  add column status_id uuid references lookups(id);

-- backfill existing rows before status_id becomes required — completed
-- when both readings exist, operating when only the start does, exactly
-- matching what the UI has been deriving from endKm all along
update daily_vehicle_operations o
   set status_id = (
     select id from lookups
      where category = 'operation_status'
        and code = case when o.ending_odometer_km is not null
                         then 'completed' else 'operating' end
   )
 where status_id is null;

create or replace function fn_default_operation_status()
returns uuid language sql stable as $$
  select id from lookups where category = 'operation_status' and code = 'planned';
$$;

alter table daily_vehicle_operations
  alter column status_id set not null,
  alter column status_id set default fn_default_operation_status();

alter table daily_vehicle_operations
  add constraint daily_vehicle_operations_status_lookup
  check (lookup_in(status_id, 'operation_status'));

-- ---- validation trigger: three tiers ---------------------------------------
-- Planned and the four non-operating statuses (Cancelled x3, Under
-- Maintenance) require driver/KM/percentage to all be null. Operating
-- requires a starting KM and forbids an ending KM (that's what makes it
-- "not finished yet" rather than Completed). Completed requires both.
-- Reuses fn_lookup_code from 0004 rather than a new near-duplicate.

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

  elsif status_code = 'completed' then
    if new.driver_id is null then
      raise exception 'operation_requires_driver' using errcode = 'P0001';
    end if;
    if new.starting_odometer_km is null or new.ending_odometer_km is null then
      raise exception 'completed_requires_both_km' using errcode = 'P0001';
    end if;

  else
    -- planned / cancelled_by_vendor / cancelled_by_tmf / cancelled_by_ope /
    -- under_maintenance
    if new.driver_id is not null or new.starting_odometer_km is not null
       or new.ending_odometer_km is not null or new.operating_percentage is not null then
      raise exception 'non_operating_status_requires_blank_fields' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

create trigger trg_validate_operation_status
  before insert or update on daily_vehicle_operations
  for each row execute function fn_validate_operation_status();
