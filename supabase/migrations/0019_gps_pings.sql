-- GPS integration (ROADMAP_NEXT.md item 2, 2026-09-01 autonomous session).
-- Schema only — written and NOT run against the live database. Same hard
-- stop as every other autonomous session: migrations are prepared here,
-- never executed, until the user runs them in the Supabase SQL editor.
--
-- Provider-agnostic on purpose. Neither candidate provider's API is
-- confirmed yet (Etit vs. Zhongtong — see ROADMAP_NEXT.md item 2). This
-- table's shape doesn't depend on which one lands: the adapter layer in
-- src/lib/gps/adapters/*.ts is the only piece of the app that changes per
-- provider, and it normalizes into exactly this row shape.
--
-- Deliberately NOT wired into fn_validate_operation_status or any
-- Operating %-replaces-manual-entry logic. CLAUDE.md section 8 and
-- ROADMAP_NEXT.md item 2 both call that out as a real behavior change
-- deserving its own discussion once real GPS accuracy can be judged —
-- this migration only lands the raw ping data.

create table vehicle_gps_pings (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicles(id),
  -- when the device took the reading, vs. when our ingestion received it —
  -- kept separate because a queued/retried webhook delivery can lag.
  recorded_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  latitude     numeric(9,6) not null,
  longitude    numeric(9,6) not null,
  speed_kmh    numeric(6,2),
  heading_deg  numeric(5,1),
  -- if the provider reports an odometer reading. Deliberately separate from
  -- vehicles.current_odometer_km, which CLAUDE.md section 2 reserves for
  -- trg_sync_odometer off the manually-entered operation row — a raw GPS
  -- odometer ping never writes there directly.
  odometer_km  numeric(12,2),
  ignition_on  boolean,
  provider     text not null,             -- 'etit' | 'zhongtong' | ...
  -- the untouched provider payload, for debugging/replay once a real
  -- adapter is wired in — cheap insurance while the exact fields either
  -- provider actually sends are still unknown.
  raw_payload  jsonb,
  created_at   timestamptz not null default now()
);

create index on vehicle_gps_pings (vehicle_id, recorded_at desc);
create index on vehicle_gps_pings (provider, recorded_at desc);

alter table vehicle_gps_pings enable row level security;

-- Same "operations" bucket as daily_vehicle_operations (CLAUDE.md-listed
-- roles): everyone reads, data_admin/supervisor/super_admin write. In
-- practice real ingestion (webhook/poll routes) writes through the
-- service-role client in src/lib/supabase/service.ts, which bypasses RLS
-- entirely — these policies govern what an authenticated app user could
-- do, not the ingestion path itself.
create policy p_vehicle_gps_pings_read  on vehicle_gps_pings for select using (can_read());
create policy p_vehicle_gps_pings_write on vehicle_gps_pings for all using (can_write_ops()) with check (can_write_ops());

-- Latest known position per vehicle — what a fleet-location view actually
-- wants, so it's a view rather than every caller writing the same
-- distinct-on query. Vehicles with no pings yet (the expected state until
-- a provider is wired in) simply don't appear.
create or replace view v_vehicle_latest_gps as
select distinct on (p.vehicle_id)
  p.vehicle_id,
  v.vehicle_code,
  v.plate_number,
  p.recorded_at,
  p.latitude,
  p.longitude,
  p.speed_kmh,
  p.heading_deg,
  p.ignition_on,
  p.provider
from vehicle_gps_pings p
join vehicles v on v.id = p.vehicle_id
order by p.vehicle_id, p.recorded_at desc;
