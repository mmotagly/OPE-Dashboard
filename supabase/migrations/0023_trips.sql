-- ============================================================================
-- 0023  TRIPS  (real scheduled-trip tracking on top of the routes/stations
--        reference data — supersedes 0001's "No Trips module" decision)
-- ----------------------------------------------------------------------------
-- `routes` / `stations` / `route_stations` stay exactly as they were: fixed
-- reference data (a route's ordered stops, its manually-entered "standard"
-- target leg/round-trip time). This migration adds the actual, timestamped
-- record of a vehicle running a route on a given shift, one row per trip,
-- with per-station departure times — potentially 10+ trips per vehicle per
-- day, entered fast via a batch grid (see the trips module UI), not one at
-- a time.
--
-- Design choices, spelled out because they aren't obvious from the columns:
--
--   * A trip always belongs to a `daily_vehicle_operations` row (its shift).
--     `vehicle_id`/`trip_date` are copied from it by trigger — same pattern
--     as `daily_vehicle_operations.vendor_id` following the vehicle — purely
--     to avoid a join on every list/filter/index. `route_id` is chosen per
--     trip, independently of whatever route (if any) is set on the shift:
--     the "routes never change mid-shift" rule in CLAUDE.md predates trips
--     existing at all and described that single summary field, not this.
--
--   * `trip_stops` is one row per station visit, not one row per direction.
--     The return leg reuses the SAME route_stations rows as the outbound leg
--     (a route has one fixed station sequence) — direction just says which
--     way `sequence_number` is read forwards or backwards. A trigger checks
--     a stop's station actually belongs to its trip's route.
--
--   * Leg time / round-trip time are never stored — computed on read from
--     `trip_stops`, exactly like access time / PM status / repeat index
--     elsewhere in this schema. `trip_round_trip_minutes` is null whenever
--     there is no return leg, per spec (outbound-only trips show no
--     round-trip value at all, not a round trip equal to the leg time).
--
--   * `source` ('manual' | 'gps') exists on both tables so a future GPS
--     integration can populate the same columns — including backfilling
--     individual stops of an otherwise-manual trip — without a schema
--     change. Nothing reads or writes 'gps' yet; this is future-proofing
--     only, per explicit request.
--
--   * Headway (fn_trip_headway_report) is a fleet-wide, per-station,
--     per-direction average of each trip's gap to its nearest neighbour in
--     time — not the more common "average gap between consecutive trips".
--     Direction is a partition key: a stop passed outbound and the same
--     physical stop passed on the way back are different dispatch events
--     for anyone waiting there, at a stop, not a platform, on a tourist
--     shuttle system. A day boundary always breaks adjacency — yesterday's
--     last trip is never "adjacent" to today's first.
-- ============================================================================

-- ---- trips ------------------------------------------------------------------

create table trips (
  id            uuid primary key default gen_random_uuid(),
  trip_code     text not null unique,
  operation_id  uuid not null references daily_vehicle_operations(id) on delete cascade,
  vehicle_id    uuid not null references vehicles(id),
  trip_date     date not null,
  route_id      uuid not null references routes(id),
  source        text not null default 'manual' check (source in ('manual','gps')),
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_trips_updated before update on trips
  for each row execute function set_updated_at();
create index on trips (vehicle_id, trip_date desc);
create index on trips (route_id, trip_date);
create index on trips (operation_id);

-- vehicle_id / trip_date always follow the linked shift, never entered directly
create or replace function fn_trip_set_context()
returns trigger language plpgsql as $$
declare v_vehicle uuid; v_date date;
begin
  select o.vehicle_id, o.operation_date into v_vehicle, v_date
  from daily_vehicle_operations o
  where o.id = new.operation_id;

  if not found then
    raise exception 'Invalid operation_id for trip';
  end if;

  new.vehicle_id := v_vehicle;
  new.trip_date  := v_date;
  return new;
end $$;
create trigger trg_trip_set_context before insert or update of operation_id on trips
  for each row execute function fn_trip_set_context();

-- ---- trip_stops ---------------------------------------------------------

create table trip_stops (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  direction        text not null check (direction in ('outbound','return')),
  route_station_id uuid not null references route_stations(id),
  departure_at     timestamptz not null,
  source           text not null default 'manual' check (source in ('manual','gps')),
  recorded_by      uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (trip_id, direction, route_station_id)
);
create trigger trg_trip_stops_updated before update on trip_stops
  for each row execute function set_updated_at();
create index on trip_stops (trip_id);
create index on trip_stops (route_station_id);

-- a stop's station must belong to its own trip's route
create or replace function fn_trip_stop_check_route()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
    from route_stations rs
    join trips t on t.id = new.trip_id
    where rs.id = new.route_station_id
      and rs.route_id = t.route_id
  ) then
    raise exception 'That station is not on this trip''s route';
  end if;
  return new;
end $$;
create trigger trg_trip_stop_check_route before insert or update on trip_stops
  for each row execute function fn_trip_stop_check_route();

-- ---- leg / round-trip time (computed, never stored) ------------------------

-- Last station's departure time minus the first's, ordered by the route's
-- fixed sequence (forwards for outbound, backwards for return) — not by
-- entry order and not by clock time, so a mis-keyed out-of-order entry can't
-- silently invert the calculation. Null if fewer than 2 stops are recorded
-- for that direction.
create or replace function fn_trip_leg_minutes(p_trip_id uuid, p_direction text)
returns numeric language sql stable as $$
  with stops as (
    select ts.departure_at,
           row_number() over (
             order by case when p_direction = 'outbound' then rs.sequence_number
                            else -rs.sequence_number end
           ) as rn,
           count(*) over () as n
    from trip_stops ts
    join route_stations rs on rs.id = ts.route_station_id
    where ts.trip_id = p_trip_id and ts.direction = p_direction
  )
  select case when coalesce(max(n), 0) < 2 then null
         else extract(epoch from (
           max(departure_at) filter (where rn = n) -
           max(departure_at) filter (where rn = 1)
         )) / 60.0
         end
  from stops;
$$;

create or replace function trip_outbound_leg_minutes(t trips) returns numeric
language sql stable as $$ select fn_trip_leg_minutes(t.id, 'outbound'); $$;

create or replace function trip_return_leg_minutes(t trips) returns numeric
language sql stable as $$ select fn_trip_leg_minutes(t.id, 'return'); $$;

-- null whenever there is no return leg — an outbound-only trip has a leg
-- time but deliberately no round-trip value at all.
create or replace function trip_round_trip_minutes(t trips) returns numeric
language sql stable as $$
  select case
    when trip_outbound_leg_minutes(t) is null or trip_return_leg_minutes(t) is null
    then null
    else trip_outbound_leg_minutes(t) + trip_return_leg_minutes(t)
  end;
$$;

create or replace function trip_outbound_leg_display(t trips) returns text
language sql stable as $$ select fn_format_minutes(trip_outbound_leg_minutes(t)); $$;

create or replace function trip_return_leg_display(t trips) returns text
language sql stable as $$ select fn_format_minutes(trip_return_leg_minutes(t)); $$;

create or replace function trip_round_trip_display(t trips) returns text
language sql stable as $$ select fn_format_minutes(trip_round_trip_minutes(t)); $$;

-- ---- list-ready summary ------------------------------------------------

create view v_trip_summary as
select
  t.id as trip_id,
  t.trip_code,
  t.vehicle_id,
  v.vehicle_code,
  v.plate_number,
  t.route_id,
  r.route_code,
  r.route_name,
  t.operation_id,
  o.operation_date,
  o.shift_type_id,
  t.trip_date,
  t.source,
  exists (
    select 1 from trip_stops ts where ts.trip_id = t.id and ts.direction = 'return'
  ) as has_return,
  (
    select min(ts.departure_at) from trip_stops ts
    where ts.trip_id = t.id and ts.direction = 'outbound'
  ) as outbound_start_at,
  trip_outbound_leg_minutes(t) as outbound_leg_minutes,
  trip_outbound_leg_display(t) as outbound_leg_display,
  trip_return_leg_minutes(t)   as return_leg_minutes,
  trip_return_leg_display(t)   as return_leg_display,
  trip_round_trip_minutes(t)   as round_trip_minutes,
  trip_round_trip_display(t)   as round_trip_display,
  t.created_at
from trips t
join vehicles v on v.id = t.vehicle_id
join routes r   on r.id = t.route_id
join daily_vehicle_operations o on o.id = t.operation_id;

-- ---- per-operation aggregate (the Daily Operations integration) -----------

create or replace function fn_operation_trip_summary(p_operation_id uuid)
returns table (
  trip_count int,
  avg_outbound_leg_minutes numeric,
  avg_return_leg_minutes numeric,
  avg_round_trip_minutes numeric
) language sql stable as $$
  select
    count(*)::int,
    avg(trip_outbound_leg_minutes(t)),
    avg(trip_return_leg_minutes(t)),
    avg(trip_round_trip_minutes(t))
  from trips t
  where t.operation_id = p_operation_id;
$$;

-- ---- headway ----------------------------------------------------------

-- One row per recorded departure, with its gap (in minutes) to whichever
-- neighbouring departure at the same station/route/day/direction is
-- closer in time. Postgres's least()/greatest() ignore nulls unless every
-- argument is null, which is exactly the boundary behaviour wanted here: a
-- day's first or last departure at a station has only one neighbour, so it
-- uses that single gap rather than coming out null.
create view v_trip_headway_points as
select
  ts.id as trip_stop_id,
  t.route_id,
  rs.station_id,
  st.station_code,
  st.station_name,
  t.trip_date,
  ts.direction,
  ts.departure_at,
  least(
    extract(epoch from (ts.departure_at - lag(ts.departure_at) over w)) / 60.0,
    extract(epoch from (lead(ts.departure_at) over w - ts.departure_at)) / 60.0
  ) as headway_minutes
from trip_stops ts
join trips t          on t.id = ts.trip_id
join route_stations rs on rs.id = ts.route_station_id
join stations st       on st.id = rs.station_id
window w as (
  partition by t.route_id, rs.station_id, t.trip_date, ts.direction
  order by ts.departure_at
);

-- Pools every individual nearest-gap datapoint across the requested date
-- range (not an average of daily averages, which would misweight
-- light-traffic days) and reports it per station and direction.
create or replace function fn_trip_headway_report(p_route_id uuid, p_from date, p_to date)
returns table (
  station_id uuid,
  station_code text,
  station_name text,
  direction text,
  avg_headway_minutes numeric,
  avg_headway_display text,
  sample_count int
) language sql stable as $$
  select
    station_id, station_code, station_name, direction,
    avg(headway_minutes),
    fn_format_minutes(avg(headway_minutes)),
    count(headway_minutes)::int
  from v_trip_headway_points
  where route_id = p_route_id
    and trip_date between p_from and p_to
  group by station_id, station_code, station_name, direction
  order by station_code, direction;
$$;

-- ---- RLS: same group as daily_vehicle_operations / charging_sessions -------

alter table trips      enable row level security;
alter table trip_stops enable row level security;

create policy p_trips_read   on trips      for select using (can_read());
create policy p_trips_write  on trips      for all    using (can_write_ops()) with check (can_write_ops());
create policy p_trip_stops_read  on trip_stops for select using (can_read());
create policy p_trip_stops_write on trip_stops for all    using (can_write_ops()) with check (can_write_ops());
