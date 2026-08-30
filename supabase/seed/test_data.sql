-- ============================================================================
-- TEST DATA SEED — Pyramids Ops
-- ============================================================================
-- Generates a realistic dataset across every module: 5 vendors, 12 drivers,
-- 15 vehicles, 2 routes, ~4 months of daily operations (~2,000+ rows), 25
-- RFRs across all 7 stages (some deliberately aged past the 48h alert
-- threshold), ~11 work orders, engineered periodic-maintenance states
-- (overdue/due_now/due_soon), 5 vendors' worth of KPI scorecard history
-- with distinct trend shapes, and invoices.
--
-- Every entity is tagged TEST- on its natural code field. Nothing here
-- alters or depends on any specific pre-existing row — purely additive.
-- Run once. Run supabase/seed/test_data_cleanup.sql first if you need to
-- regenerate; the guard below aborts loudly instead of silently
-- duplicating if TEST- data is already present.
--
-- Run in the Supabase SQL editor. All figures (invoice amounts, KPI
-- totals, PM status, RFR access time) are produced by the app's own
-- functions/triggers — this script never computes app-domain math itself,
-- it only decides what raw facts (dates, statuses, achieved points) to
-- feed in.

begin;

do $$
begin
  if exists (select 1 from vendors where vendor_code like 'TEST-%') then
    raise exception 'Test data already present (a vendor with a TEST- code exists). Run test_data_cleanup.sql first.';
  end if;
end $$;

-- ---- reference caches -------------------------------------------------------

create temp table tmp_lookups on commit drop as
select category || ':' || code as key, id
from lookups;

create temp table tmp_profiles on commit drop as
select
  (select id from profiles where role = 'super_admin' and is_active
     order by created_at limit 1) as super_admin_id,
  (select id from profiles where is_engineer and is_active
     order by created_at limit 1) as engineer_id;

-- ============================================================================
-- 1. VENDORS
-- ============================================================================
-- 3 Rentals (per_bus_day, no KPI), 2 Owned (per_avg_bus_month, apply_kpi).
-- Never is_company — that stays whatever the real company vendor row is.

create temp table tmp_test_vendors (
  seq int, id uuid, vendor_code text, billing_basis text, apply_kpi boolean
) on commit drop;

with rows as (
  select * from (values
    (1, 'TEST-VEN-01', 'Test Rentals Co. A',  'rentals', 'per_bus_day',      950.00::numeric,  false),
    (2, 'TEST-VEN-02', 'Test Rentals Co. B',  'rentals', 'per_bus_day',     1100.00::numeric,  false),
    (3, 'TEST-VEN-03', 'Test Rentals Co. C',  'rentals', 'per_bus_day',      880.00::numeric,  false),
    (4, 'TEST-VEN-04', 'Test Fleet Owners A', 'owned',   'per_avg_bus_month', 22000.00::numeric, true),
    (5, 'TEST-VEN-05', 'Test Fleet Owners B', 'owned',   'per_avg_bus_month', 19500.00::numeric, true)
  ) as t(seq, vendor_code, vendor_name, vtype_code, billing_basis, rate_amount, apply_kpi)
),
ins as (
  insert into vendors
    (vendor_code, vendor_name, vendor_type_id, is_company, contact_person,
     mobile_number, email_address, billing_basis, rate_amount, apply_kpi, status_id)
  select
    r.vendor_code, r.vendor_name,
    (select id from tmp_lookups where key = 'vendor_type:' || r.vtype_code),
    false,
    'Test Contact ' || r.seq,
    '+20 100 000 0' || lpad(r.seq::text, 2, '0'),
    'test.vendor' || r.seq || '@example.test',
    r.billing_basis, r.rate_amount, r.apply_kpi,
    (select id from tmp_lookups where key = 'generic_status:active')
  from rows r
  returning id, vendor_code
)
insert into tmp_test_vendors (seq, id, vendor_code, billing_basis, apply_kpi)
select r.seq, ins.id, ins.vendor_code, r.billing_basis, r.apply_kpi
from ins join rows r on r.vendor_code = ins.vendor_code;

-- ============================================================================
-- 2. DRIVERS
-- ============================================================================
-- 10 vendor-affiliated (3/2/2/2/1 across the 5 test vendors), 2 company-direct.

create temp table tmp_test_drivers (
  seq int, id uuid, driver_code text, vendor_seq int
) on commit drop;

with rows as (
  select seq,
         case
           when seq <= 3 then 1 when seq <= 5 then 2 when seq <= 7 then 3
           when seq <= 9 then 4 when seq <= 10 then 5 else null
         end as vendor_seq
  from generate_series(1, 12) as seq
),
ins as (
  insert into drivers
    (driver_code, driver_name, mobile_number, hiring_date, license_grade_id,
     vendor_id, status_id)
  select
    'TEST-DRV-' || lpad(r.seq::text, 3, '0'),
    'Test Driver ' || lpad(r.seq::text, 2, '0'),
    '+20 101 000 0' || lpad(r.seq::text, 2, '0'),
    current_date - (200 + r.seq * 17),
    (select id from tmp_lookups where key = 'license_grade:first_class'),
    (select tv.id from tmp_test_vendors tv where tv.seq = r.vendor_seq),
    (select id from tmp_lookups where key = 'generic_status:active')
  from rows r
  returning id, driver_code
)
insert into tmp_test_drivers (seq, id, driver_code, vendor_seq)
select r.seq, ins.id, ins.driver_code, r.vendor_seq
from ins join rows r on 'TEST-DRV-' || lpad(r.seq::text, 3, '0') = ins.driver_code;

-- ============================================================================
-- 3. VEHICLES
-- ============================================================================
-- 3 per vendor (15 total), alternating diesel/electric, default driver drawn
-- from the same vendor's drivers (cycling if a vendor has fewer than 3).

create temp table tmp_test_vehicles (
  seq int, id uuid, vehicle_code text, vendor_seq int, default_driver_id uuid
) on commit drop;

with rows as (
  select
    v.seq as vendor_seq, n as within_vendor_n,
    (v.seq - 1) * 3 + n as seq,
    'TEST-BUS-' || lpad(((v.seq - 1) * 3 + n)::text, 3, '0') as vehicle_code
  from tmp_test_vendors v
  cross join generate_series(1, 3) as n
),
driver_pick as (
  select r.seq, r.vendor_seq,
         (select d.id from tmp_test_drivers d
           where d.vendor_seq = r.vendor_seq
           order by d.seq
           offset ((r.within_vendor_n - 1) % greatest(1, (
             select count(*) from tmp_test_drivers d2 where d2.vendor_seq = r.vendor_seq
           )))
           limit 1) as driver_id
  from rows r
),
ins as (
  insert into vehicles
    (vehicle_code, plate_number, vehicle_type_id, fuel_type_id, vendor_id,
     battery_capacity_kwh, license_expiry_date, default_driver_id, status_id)
  select
    r.vehicle_code,
    'TEST-' || lpad(r.seq::text, 4, '0'),
    case when r.seq % 2 = 0
         then (select id from tmp_lookups where key = 'vehicle_type:electric_bus')
         else (select id from tmp_lookups where key = 'vehicle_type:diesel_bus') end,
    case when r.seq % 2 = 0
         then (select id from tmp_lookups where key = 'fuel_type:electric')
         else (select id from tmp_lookups where key = 'fuel_type:diesel') end,
    (select id from tmp_test_vendors tv where tv.seq = r.vendor_seq),
    case when r.seq % 2 = 0 then 300.00 else null end,
    current_date + 365,
    dp.driver_id,
    (select id from tmp_lookups where key = 'generic_status:active')
  from rows r join driver_pick dp on dp.seq = r.seq
  returning id, vehicle_code
)
insert into tmp_test_vehicles (seq, id, vehicle_code, vendor_seq, default_driver_id)
select r.seq, ins.id, ins.vehicle_code, r.vendor_seq, dp.driver_id
from ins
join rows r on r.vehicle_code = ins.vehicle_code
join driver_pick dp on dp.seq = r.seq;

-- ============================================================================
-- 4. ROUTES + STATIONS
-- ============================================================================

create temp table tmp_test_routes (seq int, id uuid, route_code text) on commit drop;

with rows as (
  select * from (values
    (1, 'TEST-RT-1', 'Test Pyramids Loop A', 12.5::numeric, 3),
    (2, 'TEST-RT-2', 'Test Sphinx Loop B',     9.0::numeric, 2)
  ) as t(seq, route_code, route_name, distance_km, n_stations)
),
ins as (
  insert into routes (route_code, route_name, route_distance_km, number_of_stations, status_id)
  select r.route_code, r.route_name, r.distance_km, r.n_stations,
         (select id from tmp_lookups where key = 'generic_status:active')
  from rows r
  returning id, route_code
)
insert into tmp_test_routes (seq, id, route_code)
select r.seq, ins.id, ins.route_code from ins join rows r on r.route_code = ins.route_code;

create temp table tmp_test_stations (seq int, id uuid, station_code text) on commit drop;

with ins as (
  insert into stations (station_code, station_name, status_id)
  select 'TEST-ST-' || seq, 'Test Station ' || seq,
         (select id from tmp_lookups where key = 'generic_status:active')
  from generate_series(1, 5) as seq
  returning id, station_code
)
insert into tmp_test_stations (seq, id, station_code)
select (split_part(station_code, '-', 3))::int, id, station_code from ins;

insert into route_stations (route_id, station_id, sequence_number)
select (select id from tmp_test_routes where seq = 1), s.id, s.seq
from tmp_test_stations s where s.seq in (1, 2, 3);

insert into route_stations (route_id, station_id, sequence_number)
select (select id from tmp_test_routes where seq = 2), s.id, s.seq - 3
from tmp_test_stations s where s.seq in (4, 5);

-- ============================================================================
-- 5. DAILY OPERATIONS — ~4 months history, set-based (no loop)
-- ============================================================================
-- CURRENT_DATE - 120 .. CURRENT_DATE + 5. Past dates: weighted random status
-- (mostly Completed, some Operating/Cancelled x3/Under Maintenance). Future
-- dates: Planned only. ~78% fill on past dates, ~35% on future ones — real
-- fleets have gaps. KM accumulates per vehicle via a running window sum over
-- Completed rows only, so it stays monotonic and only Completed rows "cost"
-- distance — exactly mirroring what the validation trigger (0013) requires
-- per status: Operating needs start-KM/start-battery and forbids end-KM/
-- end-battery; Completed needs all six fields; every other status forbids
-- all six.

create temp table tmp_vehicle_base on commit drop as
select id as vehicle_id, vehicle_code, default_driver_id,
       round((1500 + random() * 4000)::numeric, 2) as base_km
from tmp_test_vehicles;

with calendar as (
  select generate_series(current_date - 120, current_date + 5, interval '1 day')::date as op_date
),
shifts as (
  select unnest(array['morning', 'night']) as shift_code
),
grid as (
  select
    vb.vehicle_id, vb.vehicle_code, vb.default_driver_id, vb.base_km,
    c.op_date, s.shift_code,
    random() as keep_roll,
    case
      when c.op_date > current_date then 'planned'
      else (array[
        'completed','completed','completed','completed','completed','completed',
        'operating',
        'cancelled_by_vendor','cancelled_by_tmf','cancelled_by_ope',
        'under_maintenance'
      ])[1 + floor(random() * 11)::int]
    end as status_code,
    round((40 + random() * 220)::numeric, 2) as candidate_distance
  from tmp_vehicle_base vb
  cross join calendar c
  cross join shifts s
),
filtered as (
  select * from grid
  where (op_date <= current_date and keep_roll < 0.78)
     or (op_date > current_date and keep_roll < 0.35)
),
timed as (
  select
    f.*,
    case when status_code = 'completed' then candidate_distance else 0 end as distance,
    coalesce(sum(case when status_code = 'completed' then candidate_distance else 0 end)
      over (partition by vehicle_id order by op_date, shift_code
            rows between unbounded preceding and 1 preceding), 0) as km_before_offset
  from filtered f
)
insert into daily_vehicle_operations
  (operation_code, operation_date, vehicle_id, driver_id, route_id, status_id,
   operating_percentage, starting_odometer_km, ending_odometer_km,
   starting_battery_pct, ending_battery_pct, shift_type_id, driver_tips)
select
  'TEST-OP-' || t.vehicle_code || '-' || to_char(t.op_date, 'YYYYMMDD') || '-' || left(t.shift_code, 1),
  t.op_date,
  t.vehicle_id,
  case when t.status_code in ('operating', 'completed') then
    case when random() < 0.85 then t.default_driver_id
         else (select id from tmp_test_drivers order by random() limit 1) end
  else null end,
  case when t.status_code in ('operating', 'completed') and random() < 0.7
       then (select id from tmp_test_routes order by random() limit 1)
       else null end,
  (select id from tmp_lookups where key = 'operation_status:' || t.status_code),
  case when t.status_code = 'completed' then round((70 + random() * 30)::numeric, 1) else null end,
  case when t.status_code in ('operating', 'completed')
       then round(t.base_km + t.km_before_offset, 2) else null end,
  case when t.status_code = 'completed'
       then round(t.base_km + t.km_before_offset + t.distance, 2) else null end,
  case when t.status_code in ('operating', 'completed') then round((55 + random() * 40)::numeric, 1) else null end,
  case when t.status_code = 'completed' then round((10 + random() * 35)::numeric, 1) else null end,
  (select id from tmp_lookups where key = 'shift_type:' || t.shift_code),
  case when t.status_code = 'completed' then round((random() * 40)::numeric, 2) else 0 end
from timed t;

-- ============================================================================
-- 6. RFRs — all 7 stages, 25 total, 8 of them go on to Completed
-- ============================================================================
-- request_hours_ago / active_hours_ago / completed_hours_ago are all "hours
-- before now" (bigger = further in the past); request > active > completed
-- chronologically. Rows 4-7 are the deliberately-aged Active ones (>48h);
-- rows 8-9 are fresh Active (<48h) — this is what exercises the RFR-aging
-- alert (app_settings.rfr_aging_alert_hours = 48, migration 0016).

create temp table tmp_test_rfrs (
  seq int, vehicle_seq int, final_stage text,
  request_hours_ago numeric, active_hours_ago numeric, completed_hours_ago numeric,
  skip_reason_code text, description text, vehicle_location text, issue_codes text[],
  rfr_id uuid, vehicle_id uuid, request_at_ts timestamptz
) on commit drop;

insert into tmp_test_rfrs
  (seq, vehicle_seq, final_stage, request_hours_ago, active_hours_ago, completed_hours_ago,
   skip_reason_code, description, vehicle_location, issue_codes)
values
  (1, 1,  'pending', 20,   null, null, null, 'Test: AC not cooling properly',        'Depot',     array['air_conditioning']),
  (2, 3,  'pending', 8,    null, null, null, 'Test: Front door sticking',            'Station 2', array['doors']),
  (3, 5,  'pending', 30,   null, null, null, 'Test: Dashboard warning light',        'Depot',     array['electrical']),
  (4, 2,  'active',  70,   65,   null, null, 'Test: Brake pedal soft, needs inspection', 'Depot', array['brakes']),
  (5, 4,  'active',  90,   84,   null, null, 'Test: Compressor noise on startup',    'Depot',     array['compressor']),
  (6, 6,  'active', 110,  100,   null, null, 'Test: Suspension clunking over bumps', 'Station 1', array['suspension']),
  (7, 8,  'active',  75,   60,   null, null, 'Test: Interior seat damage',           'Depot',     array['interior']),
  (8, 7,  'active',  15,   10,   null, null, 'Test: Speaker system cutting out',     'Depot',     array['speakers']),
  (9, 9,  'active',   8,    4,   null, null, 'Test: Monitor flickering',             'Station 2', array['monitors_displays']),
  (10, 10, 'skipped_next_trip', 12, null, null, null, 'Test: Minor bodywork scratch',   'Depot', array['bodywork']),
  (11, 11, 'skipped_next_trip', 18, null, null, null, 'Test: Paint touch-up needed',    'Depot', array['painting']),
  (12, 12, 'skipped_next_pm',   25, null, null, null, 'Test: Tire tread wear noted',    'Depot', array['tires']),
  (13, 13, 'skipped_next_pm',   40, null, null, null, 'Test: Steering slightly loose',  'Depot', array['suspension']),
  (14, 14, 'skipped',           60, null, null, 'spare_part_unavailability', 'Test: Audio head unit fault',       'Depot', array['audio_system']),
  (15, 15, 'skipped',          100, null, null, 'high_workload',             'Test: Engine overhaul assessment',  'Depot', array['engine_overhaul']),
  (16, 1,  'rolled_over', 130, null, null, null, 'Test: Electrical fault intermittent', 'Depot', array['electrical']),
  (17, 2,  'rolled_over', 150, null, null, null, 'Test: AC compressor rattling',        'Depot', array['air_conditioning']),
  (18, 3,  'completed', 400,  390,  340, null, 'Test: Brake pads worn, replaced',       'Depot', array['brakes']),
  (19, 4,  'completed', 500,  495,  460, null, 'Test: Tires replaced, uneven wear',     'Depot', array['tires']),
  (20, 5,  'completed', 600,  590,  520, null, 'Test: Door mechanism repaired',         'Depot', array['doors']),
  (21, 6,  'completed', 700,  690,  650, null, 'Test: AC recharge and filter change',   'Depot', array['air_conditioning']),
  (22, 7,  'completed', 800,  780,  700, null, 'Test: Suspension bushings replaced',    'Depot', array['suspension']),
  (23, 8,  'completed', 900,  880,  800, null, 'Test: Full electrical inspection',      'Depot', array['electrical']),
  (24, 9,  'completed', 1000, 980,  900, null, 'Test: Compressor overhaul',             'Depot', array['compressor']),
  (25, 10, 'completed', 1100, 1080, 1000, null, 'Test: Interior refresh + bodywork',    'Depot', array['interior', 'bodywork']);

update tmp_test_rfrs t
set vehicle_id = v.id,
    request_at_ts = now() - (t.request_hours_ago || ' hours')::interval
from tmp_test_vehicles v
where v.seq = t.vehicle_seq;

with ins as (
  insert into rfrs
    (rfr_number, request_at, vehicle_id, vehicle_location, description, stage_id,
     skip_reason_id, completed_at, created_by)
  select
    'TEST-RFR-' || lpad(t.seq::text, 4, '0'),
    t.request_at_ts, t.vehicle_id, t.vehicle_location, t.description,
    (select id from tmp_lookups where key = 'rfr_stage:' || t.final_stage),
    case when t.skip_reason_code is not null
         then (select id from tmp_lookups where key = 'skip_reason:' || t.skip_reason_code)
         else null end,
    case when t.final_stage = 'completed'
         then now() - (t.completed_hours_ago || ' hours')::interval
         else null end,
    (select super_admin_id from tmp_profiles)
  from tmp_test_rfrs t
  returning id, rfr_number
)
update tmp_test_rfrs t set rfr_id = ins.id
from ins where ins.rfr_number = 'TEST-RFR-' || lpad(t.seq::text, 4, '0');

-- issues per RFR
insert into rfr_issues (rfr_id, issue_type_id)
select t.rfr_id, (select id from tmp_lookups where key = 'issue_type:' || code)
from tmp_test_rfrs t, unnest(t.issue_codes) as code;

-- ---- stage_history: build a coherent, backdated timeline per RFR ----------
-- fn_rfr_log_stage (0001) already logged one row per RFR at changed_at=now()
-- for its final stage. This corrects that row's timestamp and, for anything
-- that isn't itself Pending, backfills the earlier Pending (and, for
-- Completed, Active) row(s) — exactly what fn_rfr_access_minutes reads.

update rfr_stage_history h
set changed_at = case
  when t.final_stage = 'pending'   then t.request_at_ts
  when t.final_stage = 'active'    then now() - (t.active_hours_ago || ' hours')::interval
  when t.final_stage = 'completed' then now() - (t.completed_hours_ago || ' hours')::interval
  else t.request_at_ts + interval '2 hours'
end
from tmp_test_rfrs t
where h.rfr_id = t.rfr_id
  and h.stage_id = (select id from tmp_lookups where key = 'rfr_stage:' || t.final_stage);

insert into rfr_stage_history (rfr_id, stage_id, changed_at)
select rfr_id, (select id from tmp_lookups where key = 'rfr_stage:pending'), request_at_ts
from tmp_test_rfrs
where final_stage <> 'pending';

insert into rfr_stage_history (rfr_id, stage_id, changed_at)
select rfr_id, (select id from tmp_lookups where key = 'rfr_stage:active'),
       now() - (active_hours_ago || ' hours')::interval
from tmp_test_rfrs
where final_stage = 'completed';

-- Rolled Over is only reachable from Active in the real transition graph
-- (fn_rfr_stage_transition_allowed, 0004) — never directly from Pending.
-- This script writes rfr_stage_history directly rather than going through
-- that trigger (which only guards actual rfrs.stage_id UPDATEs), so nothing
-- would break either way, but the backdated history should still tell a
-- graph-consistent story: Pending -> Active (+1h) -> Rolled Over (+2h).
insert into rfr_stage_history (rfr_id, stage_id, changed_at)
select rfr_id, (select id from tmp_lookups where key = 'rfr_stage:active'),
       request_at_ts + interval '1 hour'
from tmp_test_rfrs
where final_stage = 'rolled_over';

-- ============================================================================
-- 7. WORK ORDERS — tied to the 8 Completed RFRs (11 total: 3 get a 2nd one)
-- ============================================================================
-- repair_start_at lands 5h before the RFR's "completed" mark, repair_end_at
-- 1h before it — comfortably after the backdated Active transition in every
-- one of these rows (checked against the seed values above), so
-- fn_rfr_access_minutes' stop-at-repair-start logic engages correctly rather
-- than running the active segment all the way to the completed timestamp.

create temp table tmp_wo_issue_part (issue_code text, part_code text) on commit drop;
insert into tmp_wo_issue_part values
  ('brakes', 'FRONT_BRAKE_PADS'), ('tires', 'TIRES'),
  ('compressor', 'COMPRESSOR_OIL'), ('suspension', 'SHOCK_ABSORBER'),
  ('electrical', 'LOW_VOLTAGE_BATTERY'), ('engine_overhaul', 'THE_OIL');

with completed as (
  select t.*, t.issue_codes[1] as primary_issue,
         now() - ((t.completed_hours_ago + 5) || ' hours')::interval as repair_start,
         now() - ((t.completed_hours_ago + 1) || ' hours')::interval as repair_end
  from tmp_test_rfrs t
  where t.final_stage = 'completed'
),
wo_rows as (
  select c.*, 1 as wo_n from completed c
  union all
  select c.*, 2 as wo_n from completed c where c.seq in (18, 19, 25)
),
numbered as (
  select row_number() over (order by seq, wo_n) as wo_seq, w.*
  from wo_rows w
),
ins as (
  insert into work_orders
    (work_order_number, rfr_id, assigned_engineer_id, maintenance_type_id,
     issue_type_id, maintenance_category_id, repair_start_at, repair_end_at,
     maintenance_center_id, technician_1, is_skipped, vehicle_status_after_id,
     description, created_by)
  select
    'TEST-WO-' || lpad(n.wo_seq::text, 4, '0'),
    n.rfr_id,
    (select engineer_id from tmp_profiles),
    (select id from tmp_lookups where key = 'maintenance_type:corrective'),
    (select id from tmp_lookups where key = 'issue_type:' || n.primary_issue),
    (select id from tmp_lookups where key = 'maintenance_category:mechanical'),
    n.repair_start, n.repair_end,
    (select id from maintenance_centers where center_code = 'OPE'),
    'Test Technician ' || n.wo_seq,
    false,
    (select id from tmp_lookups where key = 'vehicle_status_after:ready_for_operation'),
    'Test work order for ' || n.description,
    (select super_admin_id from tmp_profiles)
  from numbered n
  returning id, work_order_number, rfr_id
)
insert into work_order_parts (work_order_id, part_id, quantity)
select ins.id, p.id, 1
from ins
join tmp_test_rfrs t on t.rfr_id = ins.rfr_id
join tmp_wo_issue_part twp on twp.issue_code = t.issue_codes[1]
join parts p on p.part_code = twp.part_code;

-- ============================================================================
-- 8. PERIODIC MAINTENANCE — init for all 15 vehicles, engineer 10 of them
-- ============================================================================

select fn_init_pm_schedules(id) from tmp_test_vehicles;

create temp table tmp_pm_targets (vehicle_seq int, part_code text, target_remaining numeric) on commit drop;
insert into tmp_pm_targets values
  (1, 'EXT_AIR_FILTER', -300),  -- overdue by 300km
  (2, 'CHECKLIST',       -150), -- overdue by 150km
  (3, 'EXT_AIR_FILTER',  -50),  -- overdue by 50km
  (10, 'CHECKLIST',      -20),  -- overdue by 20km
  (4, 'CHECKLIST',        80),  -- due_now (<=200 remaining)
  (5, 'EXT_AIR_FILTER',  150),  -- due_now
  (9, 'EXT_AIR_FILTER',   30),  -- due_now
  (6, 'CHECKLIST',       350),  -- due_soon (<=500 remaining)
  (7, 'EXT_AIR_FILTER',  420),  -- due_soon
  (8, 'CHECKLIST',       480);  -- due_soon

update vehicle_part_schedules vps
set last_service_km = greatest(0, round(vh.current_odometer_km + t.target_remaining - p.pm_interval_km, 2))
from tmp_pm_targets t
join tmp_test_vehicles ttv on ttv.seq = t.vehicle_seq
join vehicles vh on vh.id = ttv.id
join parts p on p.part_code = t.part_code
where vps.vehicle_id = vh.id and vps.part_id = p.id;

-- Vehicles 11-15 are left untouched — never_serviced from fn_init_pm_schedules,
-- a real and valid state the module needs to show too.

-- ============================================================================
-- 9. VENDOR KPI SCORECARDS — one template per vendor, several monthly snapshots
-- ============================================================================
-- Identical KPI framework across test vendors (CLAUDE.md allows per-vendor
-- customisation but doesn't require it) — 3 sections summing to 100 weight,
-- 2 lines per section summing to 100 (each section's own 0-100 scale, per
-- v_scorecard_totals: section score % = sum of that section's line points
-- / 100 — see the comment at the lines VALUES list below).

with tpl as (
  insert into vendor_scorecards (vendor_id, period_month, status, created_by)
  select tv.id, null, 'draft', (select super_admin_id from tmp_profiles)
  from tmp_test_vendors tv
  returning id, vendor_id
),
sections as (
  insert into scorecard_sections (scorecard_id, section_name, section_weight, sort_order)
  select tpl.id, s.name, s.weight, s.sort
  from tpl
  cross join (values
    ('Safety & Compliance', 40, 1),
    ('Service Quality',     35, 2),
    ('Vehicle Condition',   25, 3)
  ) as s(name, weight, sort)
  returning id, scorecard_id, section_name
)
insert into scorecard_lines (section_id, kpi_name, metric_weight, sort_order)
select sec.id, l.name, l.weight, l.sort
from sections sec
join (values
  -- Each section's own lines sum to 100, not to the section's weight —
  -- v_scorecard_totals computes section score % as (sum of that section's
  -- line points) / 100, then blends sections via section_weight afterward.
  -- Summing lines to the section's weight instead (the first version of
  -- this script did) silently caps every section's score near
  -- section_weight% of the intended achieved fraction. See STATUS.md.
  ('Safety & Compliance', 'Incident-Free Operation',      60, 1),
  ('Safety & Compliance', 'Driver Conduct Compliance',    40, 2),
  ('Service Quality',     'On-board Cleanliness',         55, 1),
  ('Service Quality',     'Passenger Feedback Score',     45, 2),
  ('Vehicle Condition',   'PM Compliance',                50, 1),
  ('Vehicle Condition',   'Breakdown Rate',                50, 2)
) as l(section_name, name, weight, sort) on l.section_name = sec.section_name;

-- ---- open monthly snapshots + set achieved points --------------------------

create temp table tmp_scorecard_months (vendor_seq int, month_offset int, target_fraction numeric, status text) on commit drop;
insert into tmp_scorecard_months values
  -- stable ~78%
  (1, 3, 0.76, 'approved'), (1, 2, 0.79, 'approved'), (1, 1, 0.77, 'approved'), (1, 0, 0.80, 'submitted'),
  -- declining, 92% -> 55%
  (2, 3, 0.92, 'approved'), (2, 2, 0.82, 'approved'), (2, 1, 0.68, 'approved'), (2, 0, 0.55, 'submitted'),
  -- improving, 50% -> 90%
  (3, 3, 0.50, 'approved'), (3, 2, 0.63, 'approved'), (3, 1, 0.77, 'approved'), (3, 0, 0.90, 'submitted'),
  -- up then down
  (4, 3, 0.60, 'approved'), (4, 2, 0.85, 'approved'), (4, 1, 0.90, 'approved'), (4, 0, 0.65, 'submitted'),
  -- only 2 months — tests the "insufficient history" trend case
  (5, 1, 0.74, 'approved'), (5, 0, 0.76, 'submitted');

do $$
declare
  r record;
  v_scorecard_id uuid;
  v_month date;
begin
  for r in select * from tmp_scorecard_months loop
    v_month := date_trunc('month', current_date - (r.month_offset || ' months')::interval)::date;
    v_scorecard_id := fn_open_month(
      (select id from tmp_test_vendors where seq = r.vendor_seq),
      v_month
    );

    update scorecard_lines l
    set achieved_points = round(l.metric_weight * r.target_fraction * (0.9 + random() * 0.2)::numeric, 2)
    from scorecard_sections sec
    where l.section_id = sec.id and sec.scorecard_id = v_scorecard_id;

    update vendor_scorecards
    set status = r.status,
        approved_by = case when r.status = 'approved' then (select super_admin_id from tmp_profiles) else null end,
        approved_at = case when r.status = 'approved' then now() else null end
    where id = v_scorecard_id;
  end loop;
end $$;

-- ============================================================================
-- 10. INVOICES — fn_generate_invoice per vendor/month/shift with real data
-- ============================================================================
-- Vendor 5 only has scorecards for offsets 0/1 (see above), so it's only
-- invoiced for those two months — invoicing an apply_kpi vendor for a month
-- with no scorecard raises 'No scorecard for this vendor/month'.

do $$
declare
  tv record;
  month_offset int;
  v_month date;
  shift_code text;
begin
  for tv in select * from tmp_test_vendors loop
    for month_offset in
      select unnest(case when tv.seq = 5 then array[0, 1] else array[0, 1, 2, 3] end)
    loop
      v_month := date_trunc('month', current_date - (month_offset || ' months')::interval)::date;
      foreach shift_code in array array['morning', 'night'] loop
        perform fn_generate_invoice(
          tv.id, v_month,
          (select id from tmp_lookups where key = 'shift_type:' || shift_code)
        );
      end loop;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

do $$
begin
  raise notice 'Test data seed complete:';
  raise notice '  vendors:            %', (select count(*) from vendors where vendor_code like 'TEST-%');
  raise notice '  drivers:            %', (select count(*) from drivers where driver_code like 'TEST-%');
  raise notice '  vehicles:           %', (select count(*) from vehicles where vehicle_code like 'TEST-%');
  raise notice '  routes:             %', (select count(*) from routes where route_code like 'TEST-%');
  raise notice '  daily operations:   %', (select count(*) from daily_vehicle_operations where operation_code like 'TEST-%');
  raise notice '  RFRs:               %', (select count(*) from rfrs where rfr_number like 'TEST-%');
  raise notice '  work orders:        %', (select count(*) from work_orders where work_order_number like 'TEST-%');
  raise notice '  PM schedules:       %', (select count(*) from vehicle_part_schedules vps join vehicles v on v.id = vps.vehicle_id where v.vehicle_code like 'TEST-%');
  raise notice '  scorecards:         %', (select count(*) from vendor_scorecards sc join vendors v on v.id = sc.vendor_id where v.vendor_code like 'TEST-%');
  raise notice '  invoices:           %', (select count(*) from vendor_invoices vi join vendors v on v.id = vi.vendor_id where v.vendor_code like 'TEST-%');
end $$;

commit;
