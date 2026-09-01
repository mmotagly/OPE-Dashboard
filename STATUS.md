# OPE Dashboard — Current Status

Living status document. Unlike `HANDOVER.md` (a one-time ownership-transfer
snapshot) this file is meant to be updated as work lands, so any session on
any machine can `git pull` and know exactly where things stand. Read
`CLAUDE.md` first for domain rules; this file is state, not spec.

Last updated: 2026-09-01.

---

## Autonomous overnight session (2026-09-01/02, user asleep, pre-authorized)

Ten-item work list, ordered easiest/lowest-risk to hardest/highest-risk so a
usage-limit interruption defers the riskiest item first. Each item is its
own commit, pushed as it completes — see git log for the exact set. Full
write-up of everything in this session goes at the point this comment is
replaced (end of session); this entry starts with item 9's plan, written
before implementing it, per instruction.

### Item 9 plan — vehicle location map in Daily Operations

**Goal**: inside the Daily Operations drawer's view mode, show the
vehicle's current GPS position on a small live map. Degrade gracefully
("no location data available") when the vehicle has no GPS ping yet — the
expected state for most vehicles until GPS integration (roadmap item 2) has
real hardware wired in. Only render the section at all for `operating` or
`completed` status — a `planned` or `cancelled_*` operation has no
meaningful "current location" to show.

**Library choice**: Leaflet + `react-leaflet`, tiles from OpenStreetMap.
Deliberately not Google Maps or Mapbox — both need an API key tied to a
billing account, which is exactly the kind of external-account commitment
this session is not authorized to create (same guardrail item 10 states
explicitly for the camera work; applying the same judgment here even though
it wasn't stated for this item). OSM's tile server is free for this
dashboard's real usage pattern (an internal tool, a handful of staff,
opened occasionally) — it does carry a usage policy that would matter if
this dashboard's traffic ever grew large, worth knowing but not a blocker
now.

**Data source**: `v_vehicle_latest_gps` (migration `0019`, already run) —
the exact same view `/fleet-location` already reads. New shared helper
`src/lib/gps/latest-ping.ts` (`loadLatestGpsPing(vehicleId)`) rather than
duplicating fleet-location's inline query, since this is now two callers.

**Rendering**: Leaflet needs `window` at module load, which breaks Next.js
SSR unless the map component is loaded with `next/dynamic(..., { ssr:
false })` — and `ssr: false` is only legal inside a Client Component
boundary in the App Router, not called directly from a Server Component.
So: `VehicleMap` (the actual Leaflet map, "use client") is loaded through a
small `VehicleMapLoader` Client Component wrapper that does the dynamic
import; `OperationDrawer` (a Server Component, unchanged in that respect)
renders `VehicleMapLoader` directly with plain lat/lng/recordedAt props.

**New deps**: `leaflet`, `react-leaflet`, `@types/leaflet` (dev).

**Built as planned above**, verified (typecheck/lint/build all clean).
Marker color matches the operation's own status tone (`operationTone`) —
amber while operating, green once completed — consistent with the rest of
the app's color-as-information rule rather than a generic map pin.

### Item 10 — camera streaming, LiveKit architecture

Built per the earlier LiveKit-based plan, up to the account-creation
boundary the instructions drew — real code on both ends, genuinely unable
to be end-to-end tested tonight since it needs a LiveKit server that
doesn't exist yet.

**Web side** (`src/app/api/livekit/token/route.ts`,
`src/components/ui/camera-viewer.tsx`): a token-minting route with two
grants — a driver (Bearer token) gets a publish-only grant into
`op-<operationId>`, re-validated against today's actual assignment exactly
like `/api/gps/driver/ping` already does (never trust a client-claimed
operationId); a staff member (cookie session) gets a subscribe-only grant,
gated by the same RLS-scoped operation lookup every other staff read goes
through. `CameraViewer` in the operations drawer, shown only while
`statusCode === "operating"`, is a deliberate tap-to-connect ("Watch
live") rather than auto-connecting — opening a WebRTC connection for every
operation row a staff member happens to glance at would be real waste and
noise.

**Driver app** (`app/(app)/camera.tsx`, reached from a new "Camera" button
on the shift screen, shown only while tracking is active): connects via
`@livekit/react-native`, auto-publishing camera+mic on connect, showing a
local preview. Installed `@livekit/react-native`, `@livekit/react-native-webrtc`,
`livekit-client`, `@config-plugins/react-native-webrtc` — checked
carefully given tonight's earlier `react-native-worklets` native-build
saga: `npm install` (including a from-scratch clean reinstall) showed no
ERESOLVE peer-conflict warnings this time (worklets showed one explicitly,
which was the actual signal something was wrong there), `npx expo-doctor`
is 21/21 clean, and `npm run typecheck` passes against LiveKit's real
type definitions, not a guessed API shape — an initial draft using an
online example's API (`participant`, a plain `{participant, source}`
track ref) failed typecheck immediately and was corrected to the actual
exported shape (`localParticipant`, `cameraTrack`, a full `TrackReference`
with `publication`). A real EAS build was still triggered afterward (see
below) rather than stopping at doctor+typecheck, specifically because
tonight already showed once that clean-looking dependency installs can
still break native compilation — cheap enough to check given it doesn't
block anything else while it runs.

**What's needed to activate this — the account/signup step**: a LiveKit
server. Two ways to get one, your call:
- **LiveKit Cloud** (fastest): sign up at livekit.io, create a project,
  copy its URL/API key/API secret.
- **Self-hosted**: run LiveKit's open-source server yourself (Docker image,
  `livekit-server`) — no account needed at all, but you own the ops burden
  (uptime, TURN relay for NAT traversal, updates).

Either way, set three env vars and nothing else changes:
- Web app (Vercel): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Driver app: nothing — it only ever talks to the web app's own
  `/api/livekit/token`, never to LiveKit directly for credentials

Until those three vars are set, `/api/livekit/token` fails closed with a
503 ("LiveKit is not configured") — same fail-closed convention as
`GPS_WEBHOOK_SECRET`/`GPS_PROVIDER`. Nothing was created, signed up for,
or committed to on your behalf.

---

## Autonomous overnight session (2026-09-01, user away ~6h, pre-authorized)

Working through `ROADMAP_NEXT.md`'s four items in priority order: CSV
Import/Export, GPS Integration, General Camera Integration, Counter Cams.
No live-DB migrations run this session (hard stop, same as every prior
autonomous session) — new schema is written as numbered migration files and
flagged pending until the user runs them.

### 1. CSV Import/Export — built and ready (Vehicles, Drivers, Vendors, Routes)

Shared engine: `src/lib/csv.ts` (`parseCsv`, RFC4180-ish, handles quoted
fields/CRLF/BOM) and `src/lib/csv-import.ts` (`csvTextToRecords`,
`loadCodeMap`, `codeMapFromLookups`, `runImport`, `importFromFormData`) — one
generic engine every module's import action calls into, never a parallel
per-module parser. Shared UI: `src/components/ui/csv-import-form.tsx`
(upload + submit + per-row error report, `useActionState`-driven like every
other form in the app).

**Shipped, full round-trip (export -> edit in Excel -> import)**:
- **Vehicles** — `importVehicles` in `vehicles/actions.ts`, resolves
  `vendor_code` / `vehicle_type_code` / `fuel_type_code` /
  `default_driver_code` / `status_code` to ids, then runs the *same*
  `vehicleSchema` + `toRow()` the manual form uses. Export/template routes:
  `/api/export/vehicles`, `/api/import-template/vehicles`.
- **Drivers** — `importDrivers`, resolves `license_grade_code` /
  `vendor_code` / `status_code`. Same routes pattern under `/drivers`.
- **Vendors** — `importVendors`, resolves `vendor_type_code` /
  `status_code`; a row that would create a second `is_company` vendor fails
  just that row (same rule the manual form enforces). Same routes pattern
  under `/vendors`.
- **Routes** — `importRoutes`, resolves `status_code`. **Routes only, not
  stations or the route_stations stop list** — deliberately out of scope,
  see below.

Each module's UI: "Export CSV" (plain download link, reuses the existing
`ExportCsvLink` component from the Operations/Invoices/Scorecards export
work) and "Import CSV" (`?mode=import`, opens the same drawer as
create/edit, URL-driven per CLAUDE.md's form rule) next to the page's
existing "New" button. Import is row-level best-effort: a bad row is
skipped and reported (`Row 14: Unknown vendor_code "X"`), valid rows still
commit — matching the roadmap's explicit "row-level, not batch-level
rejection" requirement.

**Deliberately not built — scope judgment calls, not oversights:**
- **Stations / route_stations (the stop list)** — sequence-numbered and
  relational (`unique(route_id, sequence_number)`, renumbering logic in
  `editRouteStations`), a poor fit for flat-row CSV. The existing
  drag-style stop editor stays the only way to edit a route's stops.
- **Daily Operations, RFRs, Work Orders, Periodic Maintenance, Invoices,
  Scorecards** — every one of these is trigger-driven, multi-step, or
  workflow-gated (stage machines, auto-filled odometer/driver, KPI point
  caps, invoice generation functions) in a way flat-row import would fight
  rather than reuse. Operations, Invoices, and Scorecards already have
  CSV **export** (shipped earlier session); import for these was judged
  not to fit the roadmap's own "reuse existing triggers, never a parallel
  validation path" instruction — a CSV row can't drive a stage transition
  or express "the trigger should auto-fill this." If bulk creation is
  wanted for these later, the existing bulk-planning pattern
  (`operations/bulk-plan-form.tsx`) is the closer-fitting model than CSV.
- Large-file/background-job chunking (the roadmap's flagged open question)
  wasn't needed — all four shipped modules are small master-data tables
  (tens to low hundreds of rows), well inside one server-action request.

### Update (2026-09-01, later) — answers the re-upload/duplicate open question above

Resolves the open question this section originally flagged
("re-uploading a partially-failed import... duplicate-handling
behavior"). Import is now a three-step flow, not a one-shot insert:

1. **Upload** — unchanged.
2. **Preview** — every row is classified against the database *before
   anything is written*: **New** (no existing record with that code),
   **Match** (a record with that code already exists), or **Error**
   (fails validation — shown inline, same as before, just surfaced a
   step earlier). A summary line and a scrollable table show all three.
3. **Decide, then commit** — every **Match** row requires an explicit,
   un-defaulted decision: **Skip**, **Update existing**, or **Create as
   new**. There is deliberately no default (confirmed with the business
   owner) — the "Import N rows" button stays disabled until every match
   row has a choice, so nothing is silently skipped or overwritten.
   "Skip all"/"Update all" bulk buttons speed up resolving many rows at
   once, but remain a deliberate click, never an implicit fallback.
   **New** rows always import automatically — nothing to decide.

**"Create as new"** confronts the real constraint honestly: the code
column has a database `UNIQUE` constraint, so a literal duplicate with
the *same* code is impossible. Choosing it reveals an inline text field
for a replacement code (suggested as `{code}-2`, editable, required)
rather than pretending a true duplicate is possible.

**"Update existing" is a field-level merge, not a full replace** — a
blank cell for an *optional* field leaves the existing value untouched
rather than clearing it. This was a real, considered decision, not the
original plan: a full replace is safe for the primary "export → edit in
Excel → re-import" workflow (every field is already populated by the
export), but would silently destroy data for the plausible case of a
hand-built partial file meant to bulk-correct just one column. Required
fields are never blank-preservable (they can't be blank at all — a row
with one is already an Error before reaching a decision), so this only
touches genuinely optional fields, listed explicitly per module in each
`actions.ts`'s `OPTIONAL_UPDATE_FIELDS`. Deliberately not built: any way
to explicitly *clear* a field via CSV (blank always means "leave alone,"
never "erase") — the existing edit form covers that rare case for now.

Security note built into the re-architecture: **the confirm step never
trusts the client's row classification**, only its explicit per-row
decision. `csvText` is resubmitted and re-parsed/re-validated/
re-classified fresh against the database on commit — if something
changed between preview and confirm (another user created a colliding
record, say), that row fails and shows up in the final report exactly
like any other row failure, rather than silently trusting stale client
state.

Shared engine additions in `src/lib/csv-import.ts`: `buildPreview()`,
`runPreviewedImport()`, `PreviewFormState`/`ImportPreview`/`PreviewRow`
types. Shared UI: `src/components/ui/csv-import-preview.tsx` (new).
Applies uniformly to all four already-shipped modules — one addition to
the shared engine, not four separate builds.

### Investigated (2026-09-01, later still) — a downloaded Vendors template came out malformed

The business owner downloaded a Vendors CSV and found it "malformed":
raw-byte inspection showed the header row and one data row each wrapped
in a single quoted string with literal tab characters between what
should have been separate columns, and the file contained one real
vendor row instead of being blank.

Investigated by reproducing this app's exact `toCsv()`/route logic in
isolation and hex-dumping the output, rather than assuming either way:

- `/api/import-template/vendors` passes a hardcoded empty rows array —
  it cannot emit a data row under any input, template or otherwise. The
  real vendor row must have come from `/api/export/vendors` (working as
  designed — that route's whole job is returning real data), most likely
  the page's "Export CSV" button was clicked instead of "Download
  template" inside the Import CSV drawer — two similar, adjacent
  controls, an easy mix-up.
- Reproducing `toCsv()` directly and hex-dumping the result (both for an
  empty template and for a realistic single-vendor row) produced clean,
  correctly comma-delimited, BOM-prefixed, CRLF-terminated output in
  both cases — no tabs, no spurious quoting. This app's CSV generation
  could not be reproduced to produce the reported byte pattern from any
  input tried.
- Most likely explanation: the file was altered after downloading,
  before it reached this conversation — a well-known class of bug where
  Excel, opening a CSV by double-click, uses the OS's regional "list
  separator" setting rather than assuming comma; on a system where that
  setting isn't a comma, Excel can misparse the file and produce exactly
  this kind of corruption on re-save. Not confirmed as the exact
  mechanism, since there was no way to inspect a file at the moment of
  download.

**Fix applied regardless of exact root cause**, since it's low-cost and
addresses this whole class of bug: `toCsv()` now writes `sep=,` as the
literal first line of every exported/template CSV — a documented
Microsoft Excel-only directive that forces comma-delimited parsing
regardless of the OS's regional settings. `csvTextToRecords()` (the
import side) now strips that same line back out before parsing, so the
export/template → edit → re-import round trip this app is built around
is unaffected whether or not a file carries the directive. Verified with
a full round-trip reproduction (export with the directive → re-parse) —
correct header and row data recovered.

**Not yet independently confirmed**: whether a freshly re-downloaded
file (post-fix) opens cleanly for the business owner — asked them to
verify directly rather than treating this as closed on the strength of
the hex-dump evidence alone.

### 2. GPS Integration — built and ready for provider config

**Migration `supabase/migrations/0019_gps_pings.sql` — run against the
live database, confirmed 2026-09-01** (user ran it; verified from this
side via an anon-key PostgREST probe against `vehicle_gps_pings` and
`v_vehicle_latest_gps` — both return `200 []`, i.e. exist and correctly
show no rows to an unauthenticated caller under RLS). Adds `vehicle_gps_pings`
(provider-agnostic ping storage: vehicle_id, recorded_at, lat/lng, speed,
heading, odometer, ignition, provider, raw_payload) and
`v_vehicle_latest_gps` (latest position per vehicle). RLS follows the same
"operations" bucket as `daily_vehicle_operations` (everyone reads,
data_admin/supervisor/super_admin write) — real ingestion writes through
the service-role client instead, see below.

**Adapter layer** (`src/lib/gps/`): `types.ts` defines the
provider-agnostic `NormalizedGpsPing` shape and `GpsAdapter` interface;
`adapters/etit.ts` and `adapters/zhongtong.ts` are clearly-marked config
slots — each reads its own env vars (`ETIT_API_BASE_URL`/`ETIT_API_KEY`,
`ZHONGTONG_API_BASE_URL`/`ZHONGTONG_API_KEY`), reports `isConfigured()`
honestly, and **throws** rather than guessing when asked to normalize a
payload, since neither provider's real wire format is confirmed yet
(no fake data, no pretend connection, per the explicit instruction this
session started from). `adapters/index.ts` picks the active one from
`GPS_PROVIDER`. Swapping in a real provider later means filling in one
adapter file's two functions — nothing downstream changes.

**Ingestion**: both integration patterns are built, since ROADMAP_NEXT.md
flags the pull-vs-push question as unresolved for both candidates —
`POST /api/gps/webhook` (push, gated by `GPS_WEBHOOK_SECRET` header) and
`POST /api/gps/poll` (pull, meant for a Vercel Cron job, gated by
`CRON_SECRET`, resumes from the last stored ping per provider). Both call
the same `ingestPings()` (`src/lib/gps/ingest.ts`), which writes through a
new `src/lib/supabase/service.ts` service-role client — needed because a
provider's server has no logged-in app user for RLS to check.

**UI**: `/fleet-location` (new nav item under Operations) — a read-only
table of every vehicle with its latest position, speed, ignition, and
last-seen time, "no GPS data" for every vehicle until a provider lands
(the honest, expected state right now). Deliberately a table, not a map —
DESIGN_SYSTEM.md's "lists are tables" rule, and adding a map library is a
real dependency decision better left until there's real position data to
plot. The query gracefully treats a missing `v_vehicle_latest_gps` as "no
data" rather than a 500 — that fallback is no longer load-bearing now
that migration 0019 has run, but stays in place; it costs nothing and
protects against a future rollback/reset of this table.

**Explicitly not built**: any GPS-driven change to
`fn_validate_operation_status`, auto-filled odometer/status, or "Operating
%" — CLAUDE.md and ROADMAP_NEXT.md both call this out as a separate,
later decision. `CLAUDE.md` section 1's stale "GPS is a later phase, do
not build for it" note has been updated to reflect that GPS work is now
in progress, without changing that specific deferral.

### 3. General Camera Integration — built and ready for site config

**Migration `supabase/migrations/0020_cameras.sql` — run against the live
database, confirmed 2026-09-01** (user ran it; verified from this side
via anon-key PostgREST probes against `camera_bridges`, `cameras`,
`camera_clip_requests`, `bus_passenger_counts` — all return `200 []`).
Adds a device registry (`camera_bridges`,
`cameras` — a camera points at exactly one vehicle or one station, never
both) and `camera_clip_requests` (async playback request log, since ISAPI
recording search is not instant). RLS: the registry is master data
(everyone reads, supervisor+ writes); clip requests follow the
"operations" bucket, same as `daily_vehicle_operations`.

**Local bridge/agent — real reference implementation, not a stub**, at
`bridge/` (a separate standalone Node/TypeScript service — its own
`package.json`/`tsconfig.json`, excluded from the main app's
typecheck/lint via `tsconfig.json`'s `exclude` and `eslint.config.mjs`'s
`ignores`, and never deployed to Vercel). Unlike the GPS adapters, this
isn't a config-slot stub: Hikvision's ISAPI protocol is a *confirmed*,
documented HTTP/REST protocol (ROADMAP_NEXT.md item 3), so `bridge/src/
isapi.ts` is a real, working HTTP Digest-auth client (RFC 7616, hand-
rolled with Node's built-in `crypto`, no extra auth dependency) calling
the real `/ISAPI/ContentMgmt/search` (playback) endpoint. Verified: `cd
bridge && npm install && npm run build && npm run typecheck` all pass,
and the server was smoke-tested locally — `/health` returns `{ok:true}`
and every authenticated route correctly 503s with no `BRIDGE_SHARED_SECRET`
configured (fails closed, never open). The one genuinely open item is
documented, not glossed over: turning the raw RTSP live stream into
something a browser can play needs an RTSP→HLS/WebRTC relay that's better
built against real hardware than guessed at now — see `bridge/README.md`'s
"what's still a config slot" section for the honest reasoning.

**Main app side**: `src/lib/cameras/bridge-client.ts` (server-only fetch
wrapper, fails closed without `CAMERA_BRIDGE_SHARED_SECRET`), three proxy
routes under `/api/cameras/[cameraId]/` (`live`, `playback`, `counts` —
counts is item 4, see below) — a browser only ever calls these, never the
bridge or camera directly, per the roadmap's explicit security
instruction. UI: `/cameras` (device registry, master-data table pattern
like Routes/Stations — two entities, one page) under the Fleet nav group.
A camera's drawer shows an honest "requested through the bridge, never
direct" note rather than a fake live-view player.

### 4. Counter Cams — built on the same bridge, ready for site config

Shares migration 0020 (`bus_passenger_counts` — raw enter/exit counts per
camera/window, `operation_id` deliberately left unresolved by any trigger:
matching a raw time window to one of a vehicle's two shifts needs a
shift-time policy that doesn't exist yet, since `shift_type` is just a
Morning/Night lookup with no time boundaries — a real decision for once
real counting data exists, not a gap papered over with a guess). Bridge
reference implementation includes the two real, named ISAPI endpoints
ROADMAP_NEXT.md item 4 already confirmed: `searchPassengerCounts()` calls
`/ISAPI/Event/channels/{id}/SearchRegionTargetNumberCounting`;
`openAlertStream()` opens `/ISAPI/Event/notification/alertStream` for the
real-time push variant (left as a raw `Response` for a future consumer to
frame, rather than guessing at a streaming shape nobody's tested).
`POST /api/cameras/[cameraId]/counts` is the on-demand path (ask the
bridge for a window's counts right now); a scheduled version (auto-poll
per shift) is a small follow-up once there's a real camera/cadence to
tune it against. UI: `/passenger-counts` — read-only, same honest-empty
pattern as `/fleet-location`.

**Explicitly not built**: an RTSP-to-HLS live-view relay (documented as
the one open item in `bridge/README.md`) and any automatic reconciliation
of a passenger-count window to a specific operations shift.

### Update (2026-09-01, business owner check-in)

Confirmed facts from the business owner:
- **GPS**: 16 owned vehicles have Etit devices installed and working
  today. Speed is reported in km/h (matches the unit
  `src/lib/gps/adapters/etit.ts` already assumes — no change needed once
  the adapter is filled in).
- **Cameras**: exact models, firmware versions, and ISAPI
  credentials are being gathered today. People-counting is **confirmed
  licensed and enabled**. **Both live view and playback are needed** —
  not just playback, so `bridge/README.md`'s earlier "live view could
  maybe be skipped if playback+counting cover the need" framing is now
  moot; live view stays a real requirement, just not yet built (see the
  RTSP→HLS relay note above).

Process change, both noted for future sessions: the business owner is
checking Etit's and Zhongtong's own platforms directly (logging in
themselves, looking for API/Developer/Integrations/Webhooks settings) and
will bring back screenshots rather than sharing account credentials —
consistent with this assistant's own rule against handling third-party
login credentials. The itemized list below is written for that
self-check process, not as a message to send a vendor's support team.

**New, primary open question for camera architecture** — this now blocks
further camera work until answered: **does the camera system already
have its own cloud/remote-access platform** (e.g. Hik-Connect or
similar), reachable via a cloud API with no on-site computer needed for
at least some of what it covers? Or **are the cameras reachable only on
the local network**, which is what `bridge/` was built for? Two
scenarios, both worth planning for until confirmed:

- **Scenario A — a cloud platform/API exists.** Live view and/or
  playback (and possibly counting, though see below) could go through
  that cloud API directly from the main app's backend, the same
  adapter-swap pattern already used for GPS
  (`src/lib/gps/adapters/{etit,zhongtong}.ts`) — no dedicated on-site
  computer needed for whatever that API covers.
- **Scenario B — local-network-only.** The bridge already built
  (`bridge/`) is required exactly as designed.

Settling this depends on the business owner confirming **how the cameras
are currently viewed remotely today** (an app? a web portal? nothing —
only viewable on-site?) — due alongside the Hikvision hardware details.

#### Is last night's bridge/ISAPI work wasted if Scenario A turns out true? (answered honestly, not assumed)

**No, not wasted — but it's worth being precise about which parts stay
useful regardless and which are genuinely provider-specific:**

- **Not provider-specific, valuable in either scenario:** the database
  schema (`cameras`, `camera_clip_requests`, `bus_passenger_counts`) and
  — the more important piece — the architectural boundary that a browser
  never talks to the camera or its cloud account directly, always
  through this app's own backend (the three `/api/cameras/[cameraId]/`
  routes). That boundary is correct whether the thing behind it is our
  own bridge or Hikvision's cloud, and doesn't change either way.
- **Provider-specific, the same way the GPS adapters are:** `bridge/`
  itself (the Node service + the ISAPI Digest-auth client) is the
  "local-network" integration path. If Scenario A holds, the fix is to
  add a sibling cloud adapter next to it — not rewrite anything — mirroring
  exactly the pattern already proven for GPS: one small module whose job
  is "normalize this provider's response," swapped in per camera or per
  bridge row.
- **Genuine, hedged expectation — not a confirmed fact**: consumer cloud
  camera platforms (Hik-Connect specifically) are typically built for
  live view and clip playback in a mobile app, and in general tend not to
  expose the more specialized ISAPI features — like
  `SearchRegionTargetNumberCounting`, the people-counting endpoint —
  through a documented public API; that usually stays an on-prem/NVR-only
  feature. So even in the best case for Scenario A, **counter cams very
  plausibly still need the local bridge** regardless of what the cloud
  platform covers for live view/playback.
- **Also plausible**: a cloud service might not cover every camera (older
  units, ones never enrolled) — "some cameras cloud, some local" is a
  realistic outcome, in which case both paths end up needed at once, not
  either/or.

Bottom line: worst case, the `bridge/` deployment itself just doesn't get
run in production for live view/playback — a modest, well-isolated piece
of an already large session, following the same swappable-adapter design
already chosen for GPS. Most likely case, it stays useful either as the
counting path, the fallback for cameras a cloud service doesn't reach, or
both. No further camera code changes were made after this question was
raised, pending the answer.

### What to go get, itemized — hand this directly to each vendor/provider

Everything above is built and waiting for real configuration. Rewritten
below to match the actual process in motion (self-check via login +
screenshots for GPS, not a vendor support ticket) and to reflect what's
already confirmed vs. still pending.

#### GPS — Etit (ETIT-FMS)

**Being self-checked by the business owner directly** (screenshots to
follow, no account access shared). What to look for once logged in:

1. **Any menu/section named API, Developer, Integrations, Webhooks, or
   similar** in ETIT-FMS's own settings — that's the thing to screenshot
   first; if nothing like that exists in the UI, that's a real (if
   negative) answer too.
2. If something exists: **the base URL and how to authenticate** — API
   key in a header, OAuth client credentials, or basic auth. Whichever
   it is, it's one value to put in `ETIT_API_BASE_URL`/`ETIT_API_KEY`.
3. **Push or pull** — a way to register a webhook URL (we'd give
   `https://<our-domain>/api/gps/webhook` and a shared secret), or only a
   pull/polling API (we'd need the endpoint and its rate limit)? Both
   patterns are already built (`/api/gps/webhook` and `/api/gps/poll`) —
   whichever Etit actually supports, that route is ready.
4. **Whatever sample response/payload the platform's own docs or API
   explorer shows** — field names for vehicle/device identifier,
   timestamp, latitude, longitude, and (already confirmed: speed is
   km/h) heading/ignition/odometer if present. That's all
   `src/lib/gps/adapters/etit.ts`'s `normalizeWebhookPayload`/`poll`
   functions need filled in; everything downstream already exists.

~~How many vehicles are on the platform~~ — confirmed: **16 owned
vehicles**, devices installed and working today.

#### GPS — Zhongtong (manufacturer unit)

Same self-check process. The real open question here is more basic than
for Etit: **does any API/Developer/Integrations section exist in
Zhongtong's platform at all** — manufacturer-installed telematics are
often locked to a proprietary app with no integration path, so a
screenshot of "no such option exists" is a legitimate, useful answer. If
something does exist, the same three items as Etit above (auth,
push/pull, payload fields).

Only one provider is needed to go live — `GPS_PROVIDER` in the main app's
env just switches which adapter is active. Given 16 vehicles are already
confirmed working on Etit, Etit is the more likely near-term path unless
Zhongtong turns out to have a notably better API.

#### Cameras (general + counter cams) — being gathered today by the business owner

Most of this list is now "incoming," not "needed" — the business owner is
collecting it directly:

1. **Exact camera model(s) and firmware version(s)** — in progress.
2. **Real IP address, ISAPI port (usually 80), and ISAPI
   username/password for every camera** to be wired in — in progress;
   goes straight into the bridge's `cameras.config.json`
   (`bridge/cameras.config.example.json` shows the exact shape) **if**
   Scenario B (local-only) turns out to be the answer.
3. **Confirm HTTP Digest auth is what each camera actually uses** on
   ISAPI (the bridge assumes this, the common Hikvision default) — a
   one-line fallback already exists in `bridge/src/isapi.ts`'s
   `digestRequest` if a specific device turns out to use Basic auth
   instead.
4. ~~Confirm counting is licensed~~ — **confirmed: licensed and
   enabled.**
5. ~~Decide whether live view is actually needed~~ — **confirmed: yes,
   both live view and playback are needed.** This removes the earlier
   "maybe skip the RTSP relay" framing — it's now a real requirement,
   just not yet built.
6. **The big one, blocking further camera work: how are the cameras
   currently viewed remotely?** (an app, a web portal, nothing — only
   viewable on-site?) This single answer, together with the model/
   firmware details, settles Scenario A vs. B above.

#### Networking/hardware — depends on which scenario is confirmed

**If Scenario B (local-only) is confirmed** — arrange on-site:

1. **A dedicated, always-on computer on the depot's local network** to
   run `bridge/` — a small PC or a Raspberry Pi 4 is plenty for the
   ISAPI calls this bridge makes; more is needed only if the RTSP-to-HLS
   relay work happens. Needs to stay powered/connected continuously and
   reach every camera's IP on the LAN.
2. **A way for the main app (hosted on Vercel) to reach that computer
   without exposing the cameras to the public internet** — a VPN mesh
   (Tailscale/WireGuard) or an authenticated reverse tunnel (e.g.
   Cloudflare Tunnel) are both reasonable; a raw port-forward is
   minimum-viable but a real security tradeoff worth discussing first,
   not a default.
3. **Confirm the depot's internet connection is reliable** — no specific
   bandwidth requirement for the calls this bridge makes today (small,
   infrequent, not video streaming), just basic uptime.

**If Scenario A (cloud platform) covers some or all of it** — the above
still applies for whatever the cloud API doesn't cover (very plausibly
counting, per the reasoning above), just potentially for fewer cameras or
not at all if the cloud platform turns out to cover everything needed.

---

## Autonomous session roadmap (2026-08-30, user away ~3h, pre-authorized)

User asked for the design system contrast fix, then a 7-item roadmap,
worked through in priority order with no per-step approval — only hard
stop is running a migration against the live DB (no credentials for that
anyway; migration files get written and flagged, not run). Updated after
each item ships.

| # | Item | Status |
|---|---|---|
| 0 | Design system contrast fix (`accent-fill` token) | ✅ Done, pushed |
| 1 | Automated tests — RFR stage transitions + operation status | ✅ Done, pushed |
| 2 | Audit log / activity history | ✅ Done, pushed, migration run |
| 3 | Notifications/alerts (PM-overdue, RFR-aging) | ✅ Done, pushed, migration run |
| 4 | Planning Manager dashboard/reporting | ✅ Done, pushed, migration run |
| 5 | Automated PM scheduling reminders | ✅ Done, pushed — reuses `0016` |
| 6 | Vendor KPI performance trend history (see note) | ✅ Done, pushed, migration run |
| 7 | Export to Excel (CSV) / PDF (print) | ✅ Done, pushed — no migration needed |

**Migrations `0015`-`0018` — all four run, confirmed by the user 2026-08-31.**
Types regenerated the same day (`npx supabase gen types typescript
--project-id zvcfnavmrrbcfrszuxie > src/lib/supabase/types.ts`) and every
`as any` bridge this session had added — `v_audit_log`, `v_pm_alerts`,
`v_rfr_aging_alerts`, `v_pm_compliance_summary`, `v_rfr_resolution_summary`,
`v_fleet_utilization_monthly`, `v_vendor_kpi_trend`,
`v_vendor_kpi_section_trend` — removed now that the real types cover them.

Regenerating also surfaced two **older, unrelated** stale-types casts
(predating this session, tied to migration 0014) that had been silently
masking a real bug: `invoices/actions.ts`'s call to `fn_generate_invoice`
was force-cast to the function's old 2-argument type, so — even though the
actual object literal correctly passed all 3 arguments including
`p_shift_type_id` — TypeScript could no longer see that once the real
3-argument signature loaded, and typecheck failed until the cast was
removed. `invoices/queries.ts` had a matching `"shift_type_id" as
"vendor_id"` trick on `v_vendor_monthly_bus_counts` for the same reason,
also cleaned up. Neither was a behavior change — both already worked
correctly at runtime — but both are now type-checked for real instead of
silently trusted.

One further pre-existing cast, **`src/lib/saved-filters-db.ts`'s `as any`
for `saved_filters`** (migration 0002, unrelated to this session), is also
now removable — `saved_filters` is in the regenerated types too — but
wasn't touched since it's outside what this cleanup was asked to cover.

**Judgment calls made this session, flagged for explicit review** (proceeded
on best guess per "don't wait for permission," each one documented at its
source too):

1. **RFR-aging alert threshold (0016) and RFR-resolution dashboard average
   (0017) both use `fn_rfr_access_minutes`.** CLAUDE.md section 8 settles
   that access time is deliberately compared against no target for the
   Lead Time KPI specifically, and neither of these touches the KPI or
   scorecards — but both sit close enough to that settled decision's
   boundary that they're worth a second look, not an assumed-fine reading
   of "well it's a different feature." If either feels like it's
   reintroducing exactly what that decision ruled out, they're each one
   `drop view` / one `app_settings` row away from removal.
2. **"Driver/vendor performance trend" (item 6) was scoped to vendors
   only.** This schema has no per-driver KPI/scorecard concept at all — only
   vendors get scored. Building one would be new business logic invented
   well beyond "add a trend view over scorecards," so it wasn't attempted.
   If driver-level performance tracking is actually wanted, that's a real
   scoping conversation (what would a driver KPI even measure here —
   there's no accident/incident log, no customer feedback table), not a
   quick follow-up.
3. **Two new npm dev dependencies added without asking first**: `vitest`
   (item 1, no test runner existed) and nothing else — every other item
   used only what was already installed. Both are dev-only, zero
   production bundle impact.
4. **Alerts/dashboard/vendor-trends page visibility** was matched to the
   closest existing capability helper (`canSeeMoney` for money-adjacent
   pages, no gate beyond authentication for the PM/RFR alerts themselves
   since RLS already governs what each role's query returns) rather than
   inventing new role rules. Worth confirming these land where you'd
   actually want them, especially the sidebar's new "Administration" entry
   (Activity log, `super_admin` only) and "Overview" entry (Alerts, every
   role).

---

## Test data seed — bug found and fixed (2026-09-01)

`supabase/seed/test_data.sql`'s vendor KPI scorecard template had a real
units bug, found while visually verifying the design system rollout
against seeded data (not a redesign issue): each section's 2 lines were
weighted to sum to that section's own `section_weight` (e.g. Safety &
Compliance = 40, lines 20+20), but `v_scorecard_totals` computes section
score % as `(sum of that section's line points) / 100` — a fixed 100, not
the section's own weight — then blends sections via `section_weight`
afterward. Lines summing to 40 instead of 100 silently capped every
section's score near `section_weight% of the intended fraction` — a vendor
seeded to hit ~90% actually landed around ~31%, and it fed straight into
`fn_generate_invoice`'s `net_amount` for `apply_kpi` vendors too (visibly
wrong invoice totals, not just a scorecard display issue).

Fixed by changing each section's line weights to sum to 100: Safety &
Compliance 60+40, Service Quality 55+45, Vehicle Condition 50+50 (was
20+20, 20+15, 15+10). Since the bug was in the *data*, not just its
display, the fix requires a full reseed — `test_data_cleanup.sql` then
the corrected `test_data.sql` — not a patch over what's already there.

---

## 0. Design system pilot — Daily Operations (shipped, pushed this session)

A visual-only redesign per `DESIGN_SYSTEM.md`, piloted on the Daily Operations
page before rolling out module by module. **Not yet committed/pushed** —
still local, pending final sign-off. No business logic, data fetching,
Supabase queries, or routing changed; no other module's *files* were edited.

- **Token layer** (`src/app/globals.css`): existing CSS variable names kept
  (so the 24+ files already referencing `bg-canvas`, `text-ink`, `bg-go`,
  etc. needed no changes), but every value retargeted to
  `DESIGN_SYSTEM.md`'s palette, with light-mode overrides added under
  `[data-theme="light"]` (dark is default — no cookie means no attribute
  means the base dark values apply, so no existing session's view changes
  unless they opt in). Two new tokens added (`accent`, `accent-bg`) since
  the old `elev` token conflated "generic selected state" with "active nav,"
  incompatible with the new rule that brand accent touches only the logo,
  active nav, and primary buttons. A typography scale (`text-page-title`,
  `text-table-header`, etc.) was added since none existed before — see
  `DESIGN_SYSTEM.md`'s Typography section for the full token list.
- **Manual light/dark toggle**: new `ThemeToggle` client component in the
  sidebar, backed by a `theme` cookie (not `localStorage` — SSR needs to
  read it before first paint to avoid a flash). Read server-side in both
  `[locale]/layout.tsx` (sets `data-theme` on `<html>`) and `(app)/layout.tsx`
  (threads the initial value down to `Topbar`/`Sidebar`/`MobileNav` so the
  toggle renders correctly on first paint with no flash). Verified working
  end-to-end via a real click in the browser, not just cookie injection.
- **Inter font**: loaded globally via `next/font/google` in the root layout
  (self-hosted, zero new npm dependency — same pattern as the existing Rubik
  loader) but only actually applied within Daily Operations' own page markup
  this pass (`font-inter` on a `display: contents` wrapper, so it cascades
  to the page's content without disturbing the app shell's grid layout).
  Everywhere else keeps rendering Rubik.
- **Shared components reskinned in place** (a deliberate, explicit tradeoff
  the user chose over forking a parallel v2 component set, since
  `CLAUDE.md` already has a hard rule against forking a second table/drawer/
  pill style): `Pill` (solid-filled → soft-tinted, matching the design doc's
  status-badge spec and incidentally removing two hardcoded hex values that
  predated this pass), `Button` (`primary` variant is now accent-filled;
  every module's existing single-primary-button-per-form pattern already
  satisfies the "max one primary per screen" rule, so this needed no usage
  changes elsewhere), `Sidebar` (active nav item → `accent`/`accent-bg`,
  typography scale, theme toggle added), `Topbar` (logo badge → accent —
  the only other place brand color is allowed), `DataTable` (header/row
  typography per spec), `Panel`/`PanelHead`/`Section` (radius token,
  typography scale, new optional `eyebrow` prop for the breadcrumb), `Drawer`
  (radius token) `Field` (radius token — used by every module's forms,
  including Operations' own). Because these are genuinely shared, this
  **will visually reskin every module app-wide** the moment it ships, not
  just Daily Operations — accepted explicitly by the user as the tradeoff
  for not forking components, with Daily Operations as what's actually been
  reviewed and screenshotted first.
- **Daily Operations page itself**: page header rebuilt with an eyebrow
  breadcrumb + title (via `PanelHead`'s new `eyebrow` prop) and a single
  accent-filled primary button ("New operation"); "Bulk plan" demoted to
  secondary/neutral, matching "max one primary button per screen." Arbitrary
  `rounded-[10px]` instances within the Operations module's own files
  (`page.tsx`, `operation-form.tsx`, `operation-drawer.tsx`,
  `bulk-plan-form.tsx`) replaced with the `rounded-control` token.
- **Known, accepted seam**: only the specifically-touched shared components
  and Daily Operations' own files got the radius-token/typography-token
  treatment. Every other module's own inline styling (the ~25+ files with
  hardcoded `border-ink bg-ink ... text-on-ink` "New X" buttons, hardcoded
  `rounded-[10px]` elsewhere, etc.) is untouched — those files render with
  the *new retargeted token colors* (automatic, since they reference the
  same CSS variables) but the *old radius/typography* until each module
  gets its own pass. Expect a visible radius/type seam between Operations
  and everything else until the rollout continues.
- **Login page logo badge / card radius — fixed** (follow-up, same day). The
  login page's own hardcoded logo markup (separate from the shared
  `Topbar`) was flagged as a known gap, then closed out: `bg-accent-fill
  text-on-accent` (matching `Topbar`'s logo) and `rounded-card` on the card
  container. `HANDOVER.md` §8 item 11 updated accordingly.
- **Contrast fix applied**: the flagged white-on-`accent` button contrast
  gap (~3.08:1 dark / ~4.29:1 light, both under WCAG AA's 4.5:1) is
  corrected. Added a second token, `accent-fill` (`#D2461E` light /
  `#BA5A32` dark — same hue as `accent`, minimally darkened), used only
  where accent fills a solid background behind white text (logo badge,
  primary buttons): **4.53:1 light / 4.57:1 dark**, both now AA-compliant.
  `accent` itself is unchanged, since it's also the *text* color on
  `accent-bg` for the active nav item, where the original value already
  cleared AA (~5.3:1) — darkening it directly would have silently broken
  that pairing instead. See `DESIGN_SYSTEM.md`'s "Contrast fix" note for
  the full reasoning.
- **Verification**: `npm run typecheck`, `npm run lint`, `npm run build` all
  pass. Confirmed live in a local dev server, both themes, via real browser
  screenshots (before/after, dark/light) and a real click on the toggle (not
  just cookie injection) — a genuine `git stash`/`pop` round-trip was used to
  capture true "before" screenshots of the pre-pilot design for comparison,
  since no such screenshots existed from before the code changes were made.
  Shipped autonomously (user away ~3h, pre-authorized): committed and
  pushed once the contrast fix above landed and re-verification passed.

---

## 1. Shipped and deployed (on `main`, live in production)

All of the following is merged, pushed, and confirmed live at
`https://ope-dashboard-seven.vercel.app`.

### Daily Operations status feature

Full rollout of a real status field (`Planned` / `Operating` / `Completed` /
`Cancelled By Vendor` / `Cancelled By TMF` / `Cancelled By OPE` /
`Under Maintenance`) on `daily_vehicle_operations`, replacing the old
endKm-derived pseudo-status everywhere.

- **Phase 1** — schema + compatibility shim (migration `0009`).
- **Phase 2** — status-aware "latest operation" lookups (migration `0010`).
  Fixed a real bug: `fn_sync_vehicle_odometer`, RFR auto-fill, and PM
  advancement all picked "the latest-dated row" with no status filter, so
  once no-data statuses existed (Planned, Cancelled, Under Maintenance) they
  could silently pick up a row with a null driver/odometer.
- **Phase 4** (done ahead of Phase 3 billing, at explicit user request, so the
  feature could be verified in the UI before going deeper into
  backend-only work) — real status picker replacing the endKm-derived pseudo
  status in the operation form, table, drawer, and filter chips. Fields
  conditionally render based on the selected status, mirroring
  `fn_validate_operation_status` exactly:
  - `Planned` / `Cancelled *` / `Under Maintenance`: no driver, KM, battery,
    or operating-% fields shown or submitted.
  - `Operating`: driver + starting KM + starting battery % required; ending
    KM, ending battery %, operating % forbidden.
  - `Completed`: driver + starting/ending KM + starting/ending battery % +
    operating % all required.
  - Fixed a Day Board regression this surfaced: its "Buses out" / "Missing
    end KM" stat cards had no status filter and would have started counting
    Planned/Cancelled/Under Maintenance rows as running or incomplete buses.
    Patched with a `runningStatuses` filter scoped to Operating/Completed —
    a correctness patch at the time, since superseded by the full redesign
    below.
- **Follow-up fixes** (three requested together, one more after):
  - Battery % required/forbidden by status, same pattern as KM
    (migration `0011`).
  - `Completed` is now a terminal status for everyone except `super_admin`,
    mirroring RFR's own stage-lock pattern exactly — DB trigger
    (`trg_operation_status_locked`) is the real gate, the form disables the
    status `<select>` and submits a hidden input to preserve the value
    (migration `0012`).
  - Ending KM field styling fixed to match other fields (removed a stray
    "optional" `Micro` hint that no longer applied once the field became
    conditionally required).
  - Operating % is now required when status is `Completed`, same
    required/forbidden pattern as KM/battery (migration `0013`).
- **Day Board's status-aware redesign** — the last item from this feature's
  original phase plan. Replaced the endKm-derived binary pill (which had a
  real bug: it mislabeled every `Completed` row as green "Operating", since
  `completed` always has a non-null `endKm` and the old logic never checked
  status at all) with the real status. Now fetches every status for the day
  via `loadOperations({ date })` — the same call and status resolution the
  Operations module itself uses — instead of a separate pre-filtered inline
  query, so the two pages can't drift on what a status means.
  - Stat bar: Operating / Completed / Planned / Not running (Cancelled ×3 +
    Under Maintenance combined, matching `operationTone()`'s own grouping) /
    Open RFRs. Dropped "Missing end KM" as redundant with the new Operating
    count (an `operating` row's `endKm` is always null by validation rule).
  - Two card layouts: full card (driver, KM meter, battery, operating %) for
    Operating/Completed; compact card (code, pill, route only) for the five
    statuses that have every operational field null by validation rule.
  - Added status filter chips, reusing `FilterChips` as-is (already used
    identically on RFRs).
  - **Follow-up**: `Operating` and `Completed` were both rendering identical
    green (`operationTone()` mapped both to `go`) — indistinguishable except
    by pill text. Gave `Operating` its own tone (`warn`/amber) so the two are
    tellable apart at a glance; `Completed` stays `go`. `operationTone()` is
    shared by Day Board, the Operations table, and the Operations drawer, so
    one change applied everywhere consistently. Documented as a deliberate
    one-off extension of `CLAUDE.md`'s color rules (`amber` was
    "approaching-limit only") rather than a silent bend — see `CLAUDE.md` §5.
    Also fixed a Day Board wording bug this surfaced: the Completed card's
    footer read "100% OPERATING" directly under a green `COMPLETED` pill —
    reworded to "100% of shift".
  - `pmProgress`/`pmTone` on the Day Board card's KM meter — was hardcoded
    placeholder values (`46`/`82`); now wired to real PM data. Added
    `loadNearestPmForVehicles` (`operations/queries.ts`) to fetch every
    shown vehicle's nearest-due part in one query instead of one
    `loadNearestPm` call per row, and lifted the `barTone`/`labelTone`
    mapping the drawer already used correctly into `src/lib/format.ts`
    (`pmBarTone`/`pmLabelTone`) so both places share one tone mapping.
  - **Table+drawer conversion — investigated, decided against.** `HANDOVER.md`
    §8 item 9 had flagged Day Board as never converted to the table+drawer
    pattern the other 8 modules use. Kept the card layout: Day Board is
    read-only (no create/edit, so `CLAUDE.md` hard rule 4's drawer-for-forms
    rationale doesn't apply), `CLAUDE.md`'s "lists are tables" rule names its
    own scope explicitly and Day Board isn't in it (§6 calls Day Board out
    separately as the pre-existing "reference implementation" the other
    modules copy the *shape* of, not an instance of the table pattern), and
    the card already surfaces more per-row detail (driver, KM+PM bar,
    battery, operating %) at a glance than a table row would without a
    click-through. Today's redesign already gave Day Board the
    scannability/filtering a conversion would nominally add (`StatBar`,
    `FilterChips`) without changing row shape.

### Invoicing shift dimension (Phase 3)

Billing moved from one invoice per vendor/month to one per vendor/month
**per shift** (Morning/Night invoiced separately) — migration `0014`.

- `vendor_invoices` gained `shift_type_id` (nullable — the one pre-existing
  invoice row is left as a legacy whole-month record, untouched, no
  backfill); unique constraint became `(vendor_id, period_month,
  shift_type_id)`.
- `v_vendor_monthly_bus_counts` now groups by shift too, and computes
  `bus_days` as `sum(coalesce(operating_percentage, 100) / 100.0)` instead
  of `count(distinct (vehicle_id, operation_date))`. This fixed a real
  pre-existing bug: a bus running both Morning and Night on the same date
  used to count as one bus-day instead of two. The view also gained a
  billable-status filter (`operating`/`completed` only) it never had —
  Planned/Cancelled/Under Maintenance rows were being counted before.
- `fn_generate_invoice` takes a new `p_shift_type_id` parameter; the old
  2-argument version was explicitly dropped (`CREATE OR REPLACE` doesn't
  replace across a changed argument list — it overloads).
- Scorecards are untouched — still month-level, shared across both
  shift-invoices for a vendor/month.
- App layer: shift picker on the generate form, shift shown in the
  invoices table and drawer, `loadBusCounts` scoped by shift.
- The first attempt at migration `0014` failed on its first run
  (`name[] = text[]` — no such operator; a dynamic constraint-lookup query
  compared Postgres's internal `name` type against a `text[]` literal
  without a cast) before touching any data. Fixed with an explicit cast,
  and the `ADD COLUMN`/`ADD CONSTRAINT` statements were made idempotent
  while in there, since a money-critical migration needs to be safely
  re-runnable. The corrected version ran clean.

### Bulk planning flow (Phase 5)

A fourth drawer mode (`?mode=bulk`) on Daily Operations, alongside the
existing `view`/`new`/`edit` — not a new route, per `CLAUDE.md` hard rule 4.
Pick a date and shift once, tick one or more vehicles, submit once, get N
Planned rows. A Planned row is only `(vehicle, date, shift)` —
`fn_validate_operation_status` already forbids driver/KM/battery/operating-%
for that status, so that's all the form collects.

- `createBulkPlanned` (in `operations/actions.ts`, reusing `guard()`,
  `loadStatusCodeById()`, `nextOperationCode()`, and the
  `UNIQUE_VIOLATION` constant directly from `createOperation`'s own module)
  inserts each vehicle **independently**, not as one multi-row `INSERT` —
  deliberately best-effort rather than atomic. A vehicle that already has a
  row for that date/shift (the realistic collision) doesn't cost the rest
  of the batch.
- Full success redirects and closes the drawer, mirroring
  `createOperation`'s existing success path. Any per-row failure returns a
  results report instead — the form renders which vehicle, and why, so the
  rest can be retried individually through the normal single-record form.
- No schema/migration change — bulk-created rows go through the same
  table and validation trigger a single Planned row already uses.

### Infrastructure

- **Production 504 `MIDDLEWARE_INVOCATION_TIMEOUT` incident — resolved.**
  Root cause: `supabase.auth.getUser()` in `src/lib/supabase/middleware.ts`
  could hang past Vercel's middleware time budget even with a 5000ms
  per-fetch `AbortSignal` in place. Fixed with an outer hard deadline
  (`withDeadline`, 6000ms) wrapping the call, plus per-invocation request-ID
  tagging in the logs so a recurrence would be traceable. Verified via
  direct log evidence (exact timestamps, request IDs) — zero 504s since the
  fix deployed.
- **Vercel function region moved `iad1` → `dub1`.** Supabase is hosted in
  `eu-west-1` (Dublin), all users are Egypt/MENA — `dub1` is the closest
  match. Set via `vercel.json`'s `regions` field, which takes precedence
  over the Vercel dashboard's stored Function Region setting. The dashboard
  still displays `iad1 (Overridden)` — this is expected UI behavior, not a
  bug; the `regions` array in `vercel.json` wins, and the dashboard value is
  inert leftover config. Verified repeatedly via the `X-Vercel-Id` response
  header showing `dub1` as the actual execution region.

---

## 2. Tested and confirmed by the user

- RFR auto-fill (driver + odometer) cross-checked against real data via a
  manual SQL query — matched.
- Planned/Operating/Completed/Cancelled/Under Maintenance all creatable and
  correctly gated through the real UI (not just the DB layer).
- Battery % validation (required/forbidden by status).
- Completed lock (non-super_admin cannot change status away from Completed;
  super_admin can).
- Operating % required-for-Completed rule.
- Zero 504 recurrences since the middleware deadline fix.
- `dub1` confirmed as the live execution region via `X-Vercel-Id`.
- **Invoicing shift dimension (Phase 3)** — a real invoice generated through
  the live UI after migration `0014` ran; bus-day counts confirmed correct
  by the user (the both-shifts-same-day fix specifically).
- **Bulk planning flow (Phase 5)** — confirmed by the user through the live
  UI, including the partial-failure path specifically (re-submitting an
  overlapping vehicle/date/shift correctly reports it as a duplicate rather
  than failing the whole batch or silently dropping it).
- **Day Board's status-aware redesign** — confirmed by the user through the
  live UI, including the color/wording follow-up specifically: Operating
  pills render amber, Completed stays green, and the Completed card's
  footer no longer contradicts its own status pill.
- **Day Board's real PM data fix** — confirmed by the user through the live
  UI: no more fake 46/82 values, and a vehicle with no PM schedule
  configured correctly shows no bar at all rather than a placeholder one.

---

## 3. Migration status

All migrations through `0014` exist in `supabase/migrations/` **and have
been run** against the live Supabase project, confirmed by the user as of
2026-08-24:

```
0001_init.sql
0002_saved_filters.sql
0003_rfr_access_computed_columns.sql
0004_rfr_stage_transitions.sql
0005_rfr_stage_label_wording.sql
0006_deactivate_not_skipped_reason.sql
0007_seed_lookup_categories.sql
0008_lookup_categories_rls.sql
0009_operation_status.sql
0010_status_aware_lookups.sql
0011_operation_battery_validation.sql
0012_operation_status_lock.sql
0013_operation_completed_requires_operating_pct.sql
0014_invoice_shift_dimension.sql
0015_audit_log.sql
0016_alerts.sql
0017_dashboard.sql
0018_vendor_kpi_trend.sql
```

Note on `0014`: the file in the repo is the **corrected** version (a
`name[] = text[]` type-mismatch bug was fixed after the first run attempt
failed before touching any data — see §1). There was never a version of
`0014` that ran successfully with the bug still in it, so there's nothing
to reconcile.

**0001 through 0018 all confirmed run** — 0001-0014 as of 2026-08-24,
0015-0018 as of 2026-08-31 (autonomous session, see the top of this file;
types regenerated the same day). Same rule as always: if a future session sees a
migration file with no corresponding "run" confirmation, treat its
run-state as unknown — ask the user, don't assume either way. Claude has no
direct database access on this project; migration-run status can only be
established from what a user reports in conversation or from a query the
user runs and reports back.

---

## 4. What's next

The Daily Operations status rollout's original phase plan is now fully
shipped (Phases 1/2/4, Phase 3 billing, Phase 5 bulk planning, the Day
Board redesign, its real-PM-data fix, and the table+drawer decision — see
§1). **Nothing pending from this rollout.**

**Design system rollout — complete (2026-09-01).** Every module now has the
pattern applied: eyebrow breadcrumb (matching its sidebar nav group), a
single accent-fill primary action where the page has one, Inter font
wrapper, and `rounded-control`/`rounded-card` in place of arbitrary radius
values. Shipped in batches (Vehicles/Drivers/Vendors/Routes;
Charging; RFRs/Work orders; Periodic maintenance;
Scorecards/Invoices/Dashboard/Vendor trends/Alerts/Activity log;
Settings/Day board), each independently verified and committed — see the
commit history from `8a0ad87` through `e919611`. `GenerateInvoice`/
`OpenMonth` (Invoices/Scorecards' inline forms) picked up `Button`'s
`primary` variant along the way, since they'd been each page's one real
action rendering with no primary styling at all. The login page's logo
badge (`HANDOVER.md` §8 item 11) was fixed earlier as a small follow-up —
see §0.

**Known remaining seam**: the ~25+ files across every module with their own
hardcoded inline "New X" button strings (outside the shared `Button`
component) were never centralized — each module's own `newButton` const in
its `page.tsx` was updated individually as part of this rollout, but if a
new one gets added elsewhere by copy-paste later, it'll need the same
manual update rather than inheriting a fix automatically.

**Autonomous session roadmap (top of this file):** all 7 items shipped,
pushed, migrations `0015`-`0018` run, types regenerated, `as any` casts
removed — nothing pending from this roadmap. Next step is just reviewing
the four flagged judgment calls (top of this file) and deciding whether any
need adjusting.

---

## 5. Open / parked items

Carried over from `HANDOVER.md`, not yet acted on. Re-check `HANDOVER.md`
§8–§9 for the full list and rationale; the highlights most likely to bite:

- **Filtering and sorting run client-side over a 200-row capped fetch** on
  Operations, RFRs, work orders, and charging. Operations grows ~100
  rows/day; this becomes a real correctness bug (filters silently searching
  only the most recent 200 rows) within days of sustained real use. Not
  re-verified this session — check current row counts before assuming this
  hasn't already started biting.
- **No check that a shift's starting odometer matches the previous shift's
  ending odometer** for the same bus. Explicitly parked as an open question
  for the product owner, not a bug to silently fix.
- **Mobile has not been verified in a browser this session or previously**
  beyond what `HANDOVER.md` already notes. The status-picker UI (§1) has not
  specifically been checked on the sub-`xl` full-screen sheet breakpoint.
- **Lead Time KPI has no SLA target and access time is deliberately not
  wired into it** — settled decision, see `CLAUDE.md` §8. Do not revisit
  without an explicit ask.
- Everything else in `HANDOVER.md` §8 (`operation_code`/`charging_session_code`
  generated in-app with collision retry, `experimental.typedRoutes`
  deprecation warning, `middleware` → `proxy` rename available via codemod,
  etc.) is still outstanding and unaffected by this session's work.

---

## 6. Working discipline for continuing this project

- Non-trivial features get a phase breakdown proposed and approved one
  phase at a time — see prior sessions' pattern in this file's §1. Expect
  reordering based on what the user can currently verify through the UI,
  not a rigid fixed sequence.
- Every schema change is a new numbered migration in `supabase/migrations/`,
  never an edit to a previous one, even one not yet confirmed run.
- Every code/schema change: `npm run typecheck`, `npm run lint`,
  `npm run build` (build catches client/server boundary breaks the other two
  miss — see `CLAUDE.md`'s "Notes that have already bitten"), commit, push,
  poll the GitHub commit-status API until success, then verify the live app
  directly (curl + `X-Vercel-Id` header) before reporting anything as done.
- No direct database access from Claude in this project. Verify DB state via
  the user's own report, a SQL query handed to the user to run, or an
  anon-key REST probe against PostgREST (only useful for distinguishing
  RLS-blocked vs. missing-table vs. missing-policy — most operational tables
  are correctly RLS-blocked from the anon key).
- See `SYNC.md` for the two-machine pull/push checklist.
