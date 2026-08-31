-- Camera integration: general (live + playback) and counter cams
-- (ROADMAP_NEXT.md items 3 and 4, 2026-09-01 autonomous session). Schema
-- only — written and NOT run against the live database, same hard stop as
-- every other autonomous session.
--
-- Both items share one bridge/agent architecture (item 4 explicitly says
-- so: "once the local bridge/agent from item #3 exists, adding
-- counter-cam data collection is a much smaller additional step"), so one
-- migration covers both. Confirmed technical foundation: Hikvision
-- cameras, ISAPI (HTTP/REST) for playback/config and counting, RTSP for
-- live streaming, reachable only on the local network at the depot — never
-- the public internet, and never called directly from a browser (the
-- roadmap is explicit on this point). See bridge/README.md for the
-- reference local-bridge implementation and its own API contract; this
-- schema is provider/hardware-agnostic the same way vehicle_gps_pings is —
-- it stores what the bridge reports, not how it got it.

-- ---- camera device registry ------------------------------------------------

-- One bridge per site — a small always-on service physically on the same
-- LAN as the cameras (see bridge/README.md). `base_url` is how the main
-- app reaches it (through the site's VPN/tunnel, never a raw port-forward
-- to the camera itself); the shared secret both sides use to authenticate
-- each other lives in an env var (CAMERA_BRIDGE_SHARED_SECRET), not this
-- table — one secret per deployment is enough at this scale (one depot).
create table camera_bridges (
  id           uuid primary key default gen_random_uuid(),
  bridge_code  text not null unique,
  site_name    text not null,
  base_url     text,                 -- null until the site's networking is set up
  last_seen_at timestamptz,          -- last successful health check from the app
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_camera_bridges_updated before update on camera_bridges
  for each row execute function set_updated_at();

-- One row per physical camera/channel. `vehicle_id` for an in-bus dashcam,
-- `station_id` for a fixed depot/gate camera — a camera is one or the
-- other, never both, which the check enforces the same way the app's other
-- "exactly one of" fields do.
create table cameras (
  id              uuid primary key default gen_random_uuid(),
  camera_code     text not null unique,
  bridge_id       uuid not null references camera_bridges(id),
  isapi_channel   int not null,       -- Hikvision channel number on that bridge/NVR
  vehicle_id      uuid references vehicles(id),
  station_id      uuid references stations(id),
  supports_live   boolean not null default true,
  supports_counting boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(vehicle_id, station_id) = 1)
);
create index on cameras (bridge_id);
create trigger trg_cameras_updated before update on cameras
  for each row execute function set_updated_at();

-- ---- general cameras: playback requests ------------------------------------

-- A playback request is asynchronous (the bridge queries the camera's own
-- ISAPI recording search, which is not instant), so it's a row with a
-- status rather than a synchronous API response. `clip_reference` is
-- whatever the bridge returns to identify the result — a URI, a token, or
-- similar; deliberately opaque here since the bridge's own storage/serving
-- strategy for a fetched clip is not yet decided (see bridge/README.md).
create table camera_clip_requests (
  id            uuid primary key default gen_random_uuid(),
  camera_id     uuid not null references cameras(id),
  requested_by  uuid references profiles(id) default auth.uid(),
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  status        text not null default 'pending'
      check (status in ('pending','ready','failed')),
  clip_reference text,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (window_end > window_start)
);
create index on camera_clip_requests (camera_id, created_at desc);
create trigger trg_camera_clip_requests_updated before update on camera_clip_requests
  for each row execute function set_updated_at();

-- ---- counter cams -----------------------------------------------------------

-- One row per counting interval the bridge reports (Hikvision's
-- SearchRegionTargetNumberCounting returns periodic enter/exit totals, not
-- one row per person) — raw and provider-shaped, same spirit as
-- vehicle_gps_pings.raw_payload. `operation_id` is left nullable and
-- unresolved by any trigger: reconciling a raw time window to one of a
-- vehicle's two shifts needs an explicit shift-time policy that doesn't
-- exist yet (shift_type is just a Morning/Night lookup with no time
-- boundaries) — a real decision to make once real counting data exists,
-- not a gap to paper over with a guess now.
create table bus_passenger_counts (
  id            uuid primary key default gen_random_uuid(),
  camera_id     uuid not null references cameras(id),
  vehicle_id    uuid not null references vehicles(id),
  operation_id  uuid references daily_vehicle_operations(id),
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  enter_count   int not null default 0,
  exit_count    int not null default 0,
  raw_payload   jsonb,
  created_at    timestamptz not null default now(),
  check (window_end > window_start)
);
create index on bus_passenger_counts (vehicle_id, window_start desc);
create index on bus_passenger_counts (operation_id);

-- ---- RLS --------------------------------------------------------------------

alter table camera_bridges       enable row level security;
alter table cameras              enable row level security;
alter table camera_clip_requests enable row level security;
alter table bus_passenger_counts enable row level security;

-- Device registry is master data: everyone reads, supervisor+ writes —
-- same bucket as vehicles/drivers/routes.
create policy p_camera_bridges_read  on camera_bridges for select using (can_read());
create policy p_camera_bridges_write on camera_bridges for all using (can_write_master()) with check (can_write_master());
create policy p_cameras_read  on cameras for select using (can_read());
create policy p_cameras_write on cameras for all using (can_write_master()) with check (can_write_master());

-- Playback requests and counts are operational activity — same bucket as
-- daily_vehicle_operations: everyone reads, data_admin/supervisor/super
-- write. Real count ingestion (from the bridge) writes through the
-- service-role client the same way GPS ingestion does, bypassing RLS.
create policy p_camera_clip_requests_read  on camera_clip_requests for select using (can_read());
create policy p_camera_clip_requests_write on camera_clip_requests for all using (can_write_ops()) with check (can_write_ops());
create policy p_bus_passenger_counts_read  on bus_passenger_counts for select using (can_read());
create policy p_bus_passenger_counts_write on bus_passenger_counts for all using (can_write_ops()) with check (can_write_ops());
