-- ============================================================================
-- 0010: Daily operations status — Phase 2 (status-aware "latest" lookups)
-- ============================================================================
-- 0009 introduced operation rows that legitimately carry no driver/KM data
-- (planned, the three cancelled_by_* variants, under_maintenance — all
-- required by fn_validate_operation_status to have driver_id,
-- starting_odometer_km and ending_odometer_km all null).
--
-- Four functions pick "the operation row with the latest date for this
-- vehicle" to answer "what's the last known driver/KM," with no filter on
-- whether that row actually has the data. Before 0009 that was safe — every
-- row necessarily had real data. Now it isn't: if the latest-dated row for a
-- vehicle is one of the no-data statuses, these silently return null instead
-- of falling back to the last row that actually has data.
--
-- Concretely, before this fix:
--   - inserting a Planned row for tomorrow flips vehicles.current_odometer_km
--     to null app-wide, even though yesterday's Completed row has good data
--   - filing an RFR when the latest-dated row is Planned/Cancelled/Under
--     Maintenance auto-fills a null driver and null odometer
--   - closing a work order whose repair day's operation is Under Maintenance
--     (a very plausible day for a repair) makes last_service_km stop
--     advancing, regressing that part toward overdue/never_serviced
--
-- Fix: filter each query to rows where the field being read is actually
-- populated, rather than to "latest row regardless of status" — i.e. "last
-- row with real data," which is what these functions always meant before
-- 0009 added rows that can lack it. This is data-presence filtering, not a
-- status whitelist, so it stays correct if more statuses are added later.
--
-- Pure read-path fix. Nothing here touches which operations are billable,
-- bus-day counts, or KPI/invoice math.

create or replace function fn_last_driver_for_vehicle(p_vehicle_id uuid, p_date date)
returns uuid language sql stable as $$
  select o.driver_id from daily_vehicle_operations o
  where o.vehicle_id = p_vehicle_id and o.operation_date <= p_date
    and o.driver_id is not null
  order by o.operation_date desc, o.created_at desc limit 1;
$$;

create or replace function fn_last_odometer_for_vehicle(p_vehicle_id uuid, p_date date)
returns numeric language sql stable as $$
  select o.starting_odometer_km from daily_vehicle_operations o
  where o.vehicle_id = p_vehicle_id and o.operation_date <= p_date
    and o.starting_odometer_km is not null
  order by o.operation_date desc, o.created_at desc limit 1;
$$;

create or replace function fn_odometer_on_date(p_vehicle_id uuid, p_date date)
returns numeric language sql stable as $$
  select coalesce(o.ending_odometer_km, o.starting_odometer_km)
  from daily_vehicle_operations o
  where o.vehicle_id = p_vehicle_id and o.operation_date <= p_date
    and coalesce(o.ending_odometer_km, o.starting_odometer_km) is not null
  order by o.operation_date desc, o.created_at desc limit 1;
$$;

create or replace function fn_sync_vehicle_odometer()
returns trigger language plpgsql as $$
declare v_km numeric; v_date date;
begin
  select coalesce(o.ending_odometer_km, o.starting_odometer_km), o.operation_date
    into v_km, v_date
  from daily_vehicle_operations o
  where o.vehicle_id = new.vehicle_id
    and coalesce(o.ending_odometer_km, o.starting_odometer_km) is not null
  order by o.operation_date desc, o.created_at desc
  limit 1;

  update vehicles
     set current_odometer_km = v_km, current_odometer_date = v_date
   where id = new.vehicle_id;
  return new;
end $$;
