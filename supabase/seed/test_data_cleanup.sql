-- ============================================================================
-- TEST DATA CLEANUP — Pyramids Ops
-- ============================================================================
-- Removes everything test_data.sql created, identified purely by the
-- TEST- prefix on each entity's own code field (or, for tables with no code
-- of their own — vehicle_part_schedules, scorecard_sections/lines,
-- vendor_scorecards, vendor_invoices — by joining back to a TEST- vendor or
-- vehicle). Safe to run even if the seed only partially completed.
--
-- Most child tables here are ON DELETE CASCADE from what's explicitly
-- deleted below (rfr_issues/rfr_stage_history from rfrs, work_order_parts
-- from work_orders, vehicle_part_schedules/vendor_scorecards's whole
-- section/line tree from vehicles/vendors, route_stations from routes) —
-- they're not listed as separate DELETEs, they just go away on their own.
-- Order matters for the ones that are NOT cascaded (rfrs/vehicles/drivers
-- restrict their parent from deleting first) — this is that order.
--
-- One non-obvious exception, found the hard way: vehicle_part_schedules
-- also has a second FK, last_work_order_id -> work_orders, with no
-- cascade. It isn't set by a plain INSERT — fn_recalc_pm_schedules sets it
-- after the fact for any vehicle whose completed work order replaced a
-- PM-tracked part — so it's easy to miss by reading the seed script alone.
-- Cleared with an explicit UPDATE below, right before work_orders is
-- deleted.

begin;

-- vendor_invoices has no cascade from either vendors or vendor_scorecards
-- (it references both), so it has to go first or it blocks both later.
delete from vendor_invoices
where vendor_id in (select id from vendors where vendor_code like 'TEST-%');

-- charging_sessions.vehicle_id is `not null references vehicles(id)` with
-- the default RESTRICT — must go before vehicles. charger_id restricts
-- chargers the same way, so chargers has to wait until this is gone too.
delete from charging_sessions
where charging_session_code like 'TEST-%';

delete from chargers
where charger_code like 'TEST-%';

-- vehicle_part_schedules.last_work_order_id restricts work_orders (no
-- cascade) — fn_recalc_pm_schedules (called inside fn_init_pm_schedules)
-- sets it automatically for any vehicle whose completed work order
-- replaced a PM-tracked part, which the seed's brakes/tires/compressor
-- work orders do. Must clear this before deleting work_orders, or that
-- delete fails with a foreign key violation on this column specifically.
update vehicle_part_schedules
set last_work_order_id = null
where last_work_order_id in (select id from work_orders where work_order_number like 'TEST-%');

-- work_orders restricts rfrs (on delete restrict) — must go before rfrs.
-- work_order_parts cascades from this automatically.
delete from work_orders
where work_order_number like 'TEST-%';

-- rfrs restricts vehicles — must go before vehicles.
-- rfr_issues and rfr_stage_history cascade from this automatically.
delete from rfrs
where rfr_number like 'TEST-%';

-- daily_vehicle_operations restricts vehicles/drivers/routes — must go
-- before all three.
delete from daily_vehicle_operations
where operation_code like 'TEST-%';

-- vehicles restricts vendors and drivers — must go before both.
-- vehicle_part_schedules cascades from this automatically.
delete from vehicles
where vehicle_code like 'TEST-%';

-- routes restricts nothing further needed here, but must go before
-- stations (route_stations cascades from routes, and route_stations itself
-- restricts stations, so stations has to wait until route_stations is gone).
delete from routes
where route_code like 'TEST-%';

delete from stations
where station_code like 'TEST-%';

-- drivers restricts vendors — must go before vendors. Must go after
-- vehicles (default_driver_id) and daily_vehicle_operations (driver_id).
delete from drivers
where driver_code like 'TEST-%';

-- vendors last. vendor_scorecards (and its scorecard_sections/
-- scorecard_lines) cascades from this automatically.
delete from vendors
where vendor_code like 'TEST-%';

do $$
begin
  raise notice 'Test data cleanup complete. Remaining TEST- rows (should all be 0):';
  raise notice '  vendors:            %', (select count(*) from vendors where vendor_code like 'TEST-%');
  raise notice '  drivers:            %', (select count(*) from drivers where driver_code like 'TEST-%');
  raise notice '  vehicles:           %', (select count(*) from vehicles where vehicle_code like 'TEST-%');
  raise notice '  routes:             %', (select count(*) from routes where route_code like 'TEST-%');
  raise notice '  stations:           %', (select count(*) from stations where station_code like 'TEST-%');
  raise notice '  daily operations:   %', (select count(*) from daily_vehicle_operations where operation_code like 'TEST-%');
  raise notice '  RFRs:               %', (select count(*) from rfrs where rfr_number like 'TEST-%');
  raise notice '  work orders:        %', (select count(*) from work_orders where work_order_number like 'TEST-%');
  raise notice '  chargers:           %', (select count(*) from chargers where charger_code like 'TEST-%');
  raise notice '  charging sessions:  %', (select count(*) from charging_sessions where charging_session_code like 'TEST-%');
end $$;

commit;
