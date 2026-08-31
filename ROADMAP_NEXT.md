# Pyramids Ops — Next Roadmap: Hardware Integrations + Bulk Data I/O

**Status:** In progress — see the status table below (added 2026-09-01;
everything below the table is the original plan, unedited except where a
build decision needed recording inline).
**Owner decision needed on:** whether the camera system already has a
cloud/remote-access API (e.g. Hik-Connect) or is local-network-only —
**this now blocks further camera work**, see `STATUS.md`'s "Update
(2026-09-01, business owner check-in)" section under item 3 for the full
reasoning on whether the bridge already built stays useful either way (it
does, at minimum for counter cams — see that section). GPS: Etit vs.
Zhongtong API access is being self-checked by the business owner directly
(no account access shared); 16 owned vehicles already confirmed on Etit.

This roadmap covers four major features, prioritized by dependency and
risk. Each is written so Claude Code can begin architecture and UI work
immediately, with the actual third-party hardware connection wired in
later once credentials/API details are confirmed — per the agreed
approach: **build everything now, leave only the final hardware handshake
as a plug-in step.**

## Build status (2026-09-01 autonomous session, user away ~6h)

| # | Item | Status |
|---|---|---|
| 1 | CSV Import/Export | ✅ Built (Vehicles/Drivers/Vendors/Routes) — see STATUS.md |
| 2 | GPS Integration | ✅ Built, blocked on provider config — 16 vehicles confirmed on Etit, self-check in progress — see STATUS.md |
| 3 | General Camera Integration | ✅ Built, **blocked on cloud-vs-local-network decision** — no further camera work until answered — see STATUS.md |
| 4 | Counter Cams | ✅ Built, counting confirmed licensed+enabled — same cloud-vs-local decision applies — see STATUS.md |

---

## Priority order and reasoning

1. **CSV Import/Export** — no hardware dependency at all, purely software, immediately buildable, high daily-use value. Should go first.
2. **GPS Integration** — hardware exists, provider API pending confirmation (Etit vs. Zhongtong). Second priority since it's the most mature/likely-to-have-a-real-API of the three hardware integrations.
3. **General Camera Integration (live + playback)** — hardware exists and is reachable locally via Hikvision ISAPI (confirmed protocol). Needs a **local bridge/agent**, a new architectural component (see below).
4. **Counter Cams (people counting)** — same Hikvision ISAPI foundation as #3, can likely share the bridge/agent infrastructure. Lowest priority since it's the newest concept and most likely to need refinement once real data starts flowing.

---

## 1. CSV Import/Export (all modules)

### Scope
Every module gets both directions:
- **Export**: download existing records as a CSV file (respecting current filters, ideally).
- **Import**: download a blank template → fill in real data → upload → system validates and creates records.

Modules: Daily Operations, RFRs, Work Orders, Periodic Maintenance, Invoices, and (by extension, since the pattern should be uniform) Vehicles, Drivers, Vendors, Routes, Scorecards.

### Import validation behavior (confirmed with the business owner)
- **Row-level, not batch-level rejection.** A bad row is skipped; valid rows still import.
- The system returns an **error summary**: which row(s) failed, and why (e.g., "Row 14: vehicle code TEST-BUS-999 not found", "Row 22: missing required field 'operation_date'").
- The user fixes just the failed rows and re-uploads (can be the same file with only the bad rows, or the whole file again — needs a UX decision: does re-uploading a file that has some already-imported rows re-create duplicates, or should the template include a way to mark "already imported" rows to skip?).

### Architecture notes for Claude Code
- **Template generation**: a downloadable CSV with the exact column headers matching each module's actual required/optional fields (per that module's existing zod schema — reuse the schema as the source of truth for template columns, not a separate hardcoded list).
- **Foreign key resolution**: most modules reference other entities by ID internally (vehicle_id, driver_id, etc.), but a human filling a spreadsheet will only know human-readable codes (vehicle_code, driver_code). The import parser must resolve codes → IDs, and treat an unresolvable code as a row-level validation error, not a crash.
- **Reuse existing validation**: each module's import should run rows through the *same* zod schema and DB triggers already used for manual entry (e.g., Daily Operations' `fn_validate_operation_status`) — never a separate, parallel validation path that could drift out of sync.
- **This is a good candidate for the bulk-insert pattern already built for Phase 5's bulk planning** (best-effort per-row insert, collect results, report failures) — same shape, more input sources.
- **Large file consideration**: for modules with a lot of historical data (Daily Operations especially), imports could be hundreds/thousands of rows. Needs either a background job pattern or careful chunking so it doesn't hit Vercel's serverless function time limits — worth investigating early.

### Open questions for the business owner
- Should CSV export include ALL historical data or respect the current on-screen filter/date range?
- For re-uploading a partially-failed import: overwrite behavior, or does the template need an "already imported, skip" marker column?

### BUILD NOTES (added during implementation, 2026-09-01)

Shipped: Vehicles, Drivers, Vendors, Routes — both directions, sharing one
generic engine (`src/lib/csv.ts`, `src/lib/csv-import.ts`,
`src/components/ui/csv-import-form.tsx`). Full detail and the reasoning
for what was deliberately left out (stations/stop-list, and Operations/
RFRs/Work Orders/PM/Invoices/Scorecards import) is in `STATUS.md`'s
"Autonomous overnight session (2026-09-01)" section — short version: those
remaining modules are trigger-/workflow-driven in ways flat CSV rows can't
express, so only export (already shipped for Operations/Invoices/
Scorecards) was judged the right fit for them.

---

## 2. GPS Integration

### Status: blocked on provider decision
Two candidate sources, both with hardware already installed (2 devices per bus):
- **Etit** (Egyptian company, NTRA-licensed, has a real platform called ETIT-FMS) — no public API docs found yet. **Confirmed 2026-09-01: 16 owned vehicles have Etit devices installed and working; speed is reported in km/h.**
- **Zhongtong** (bus manufacturer's built-in unit) — unknown API status, needs investigation. Manufacturer-installed telematics units are often locked to a proprietary app with no public integration path — historically the lower-probability option.

**Process, updated 2026-09-01:** the business owner is self-checking both
platforms directly (logging in, looking for an API/Developer/
Integrations/Webhooks section, bringing back screenshots) rather than
sharing account access — see `STATUS.md`'s itemized list for exactly
what to look for.

### What GPS integration would enable, once connected
- Real-time fleet location view
- Automatic odometer capture (replacing/supplementing manual entry, feeding the existing odometer-sync trigger)
- Automatic status detection (a moving bus auto-transitions toward "Operating")
- Route deviation/compliance checking (using existing route/station data)
- Automatic "Operating %" calculation (actual hours moving ÷ scheduled shift hours) — this is the single highest-value outcome, since it currently requires manual entry and directly drives partial billing

### Architecture notes for Claude Code (buildable now, regardless of provider)
- A new `vehicle_gps_pings` table (vehicle_id, timestamp, lat/lng, speed, ignition_status or similar) — schema doesn't depend on which provider's data lands in it.
- A periodic sync job (webhook receiver if the provider pushes data, or a polling job if it only exposes a pull API) — build both patterns as options, decide once the provider's actual behavior is known.
- A clearly isolated adapter layer — one function/module whose only job is "take this provider's raw response and normalize it into our `vehicle_gps_pings` shape." This is the one piece that changes per provider; everything downstream (the map view, the odometer tie-in, the Operating % calculation) should be provider-agnostic.
- **Do not build the Operating %-replaces-manual-entry logic yet** — that's a real behavior change to existing validation rules (Phase 1's `fn_validate_operation_status`) and deserves its own careful discussion once real GPS data is flowing and its accuracy/reliability can be judged.

### BUILD NOTES (added during implementation, 2026-09-01)

Built: schema (`vehicle_gps_pings` + `v_vehicle_latest_gps`, migration
0019, not yet run), a provider-agnostic adapter layer
(`src/lib/gps/adapters/{etit,zhongtong}.ts` — clearly-marked config slots,
no fake data), both webhook and poll ingestion routes, and a read-only
`/fleet-location` UI. Full detail in `STATUS.md`'s "2. GPS Integration"
section. Not built, deliberately: the Operating%-replaces-manual-entry
logic this section already called out as a separate decision.

---

## 3. General Camera Integration (Hikvision — live view + playback)

### Confirmed technical foundation
Hikvision cameras use a documented protocol called **ISAPI** (HTTP/REST-based):
- **Live view**: standard RTSP stream URLs — `rtsp://<camera-ip>:<port>/Streaming/Channels/<ID>`
- **Playback**: ISAPI supports querying recorded footage for a given time range
- Cameras are reachable today via local Ethernet/local IP — **not internet-exposed**

### The real architectural challenge: local network vs. cloud app
This app is hosted on Vercel (cloud). Hikvision cameras sit on your local network at the depot/site, reachable only by devices on that same network. **Vercel's servers cannot directly reach a camera's local IP address.**

This means camera integration needs a **local bridge/agent** — a small always-on piece of software running on a computer/device physically on the same network as the cameras. Its job:
- Talk to cameras via ISAPI (local network calls)
- Expose a secure endpoint the cloud app can call, or push relevant data/stream info up to Supabase/the app
- For live view specifically: likely proxies the RTSP stream, or provides a way for the app's browser client to connect directly if the site network allows external access to specific camera ports (a networking/security decision, not just a software one)

**This is the single biggest open architecture question in this whole roadmap** — worth a dedicated planning session before writing code, since it affects security (exposing camera access to the internet, even partially, needs careful thought), network setup (does the site have a static IP / port forwarding / VPN capability), and ongoing maintenance (something has to keep this bridge running reliably).

**Update 2026-09-01, now the concrete, actively-blocking version of this
question**: it's not certain the local-only picture above is even still
true — the camera system may already have its own cloud/remote-access
platform (e.g. Hik-Connect or similar), in which case some or all of
live view/playback could go through that platform's own cloud API
directly, with no on-site bridge computer needed for what it covers
("Scenario A"). Or the cameras really are reachable only on the local
network, exactly as assumed above, and the bridge already built is
required ("Scenario B"). Settling this depends on the business owner
confirming how the cameras are currently viewed remotely today — see
`STATUS.md`'s "Update (2026-09-01, business owner check-in)" section for
the full reasoning on whether last session's bridge work stays useful
under either scenario (short answer: yes, though how much of it actually
gets deployed depends on the answer — counter cams in particular very
plausibly need the local bridge regardless, since consumer cloud
platforms tend not to expose ISAPI's more specialized counting endpoint).
**No further camera code work until this is answered.**

### Scope questions for the business owner
- Does your site have a dedicated computer/server that could run this bridge software continuously?
- Is there any existing network infrastructure (static IP, VPN, port forwarding) at the site, or would this need to be set up from scratch?
- For playback specifically — do you need this accessible remotely (from anywhere), or only when someone is physically at the site on the local network?

### Architecture notes for Claude Code
- Do NOT attempt direct browser-to-camera connections from a user's browser over the public internet — Hikvision cameras are not designed for public exposure and this would be a real security risk.
- The bridge/agent is a separate small application/service — likely Node.js or similar, running locally, not part of the main Next.js app's deployment.
- Design the main app's UI (camera list, live view player, playback scrubber) assuming it talks to *your own* backend API (Supabase Edge Function or a small proxy), which in turn talks to the bridge — never the camera directly from the browser.

### BUILD NOTES (added during implementation, 2026-09-01)

Built: schema (`camera_bridges`, `cameras`, `camera_clip_requests`,
migration 0020, not yet run), a real local-bridge reference
implementation at `bridge/` (own package, ISAPI digest-auth client, real
`/ISAPI/ContentMgmt/search` playback call — this one is real code, not a
stub, since ISAPI is a confirmed protocol unlike the GPS providers), three
backend proxy routes under `/api/cameras/[cameraId]/`, and a `/cameras`
device-registry UI. Not built, and documented as the one real open item:
an RTSP-to-HLS/WebRTC relay for browser live view — see
`bridge/README.md`. Full detail in `STATUS.md`'s "3. General Camera
Integration" section.

---

## 4. Counter Cams (people counting)

### Confirmed technical foundation
Same Hikvision ISAPI foundation as general cameras, with real, working endpoints specifically for counting:
- `/ISAPI/Event/channels/{id}/SearchRegionTargetNumberCounting` — periodic enter/exit count reports (real-time, daily, monthly)
- `/ISAPI/Event/notification/alertStream` — continuous event stream for real-time counting events

This is genuinely simpler than general camera video — it's just structured count data (timestamped enter/exit numbers), not video streaming, so once the local bridge/agent from item #3 exists, adding counter-cam data collection is a much smaller additional step (same bridge, different ISAPI endpoint, simpler data shape).

**Confirmed 2026-09-01: the people-counting feature is licensed and
enabled** on the relevant cameras — removes what was previously an open
question (item 3's business-owner list used to ask this). Item 3's
cloud-vs-local-network question still applies here too, and per the
reasoning in `STATUS.md`, counting specifically is the part of this
roadmap most likely to need the local bridge regardless of how that
question resolves.

### What this would enable
- Per-bus, per-shift passenger counts (enter/exit) — genuinely useful data tied directly to Daily Operations records
- Potential future use: capacity/occupancy tracking, ridership reporting per route

### Architecture notes for Claude Code
- A new `bus_passenger_counts` table (vehicle_id, timestamp or shift reference, enter_count, exit_count, source: counter-cam) — should tie back to `daily_vehicle_operations` records (same vehicle + date + shift).
- Depends on item #3's bridge/agent architecture being built first — don't duplicate that infrastructure.
- This is lower risk than general camera video (no live-streaming/security exposure concerns, just periodic data pulls), so it's a good "prove out the bridge architecture" first step before tackling live video.

### BUILD NOTES (added during implementation, 2026-09-01)

Built on item 3's bridge, as planned: `bus_passenger_counts` table (0020),
the bridge's `searchPassengerCounts()`/`openAlertStream()` hitting the two
real named ISAPI endpoints above, `POST /api/cameras/[cameraId]/counts`,
and a read-only `/passenger-counts` UI. Not built: automatic reconciliation
of a count window to a specific operations shift (no shift-time policy
exists yet to match against) and scheduled/automatic polling (only the
on-demand path exists). Full detail in `STATUS.md`'s "4. Counter Cams"
section.

---

## Suggested execution order

1. **CSV Import/Export** — start immediately, no blockers.
2. **Local bridge/agent architecture** — a dedicated planning + prototyping phase, likely starting with Counter Cams (simpler data, proves the architecture) before General Camera live/playback (more complex, real security implications).
3. **GPS Integration** — proceed as soon as a provider API is confirmed; can happen in parallel with the above since it's architecturally independent (assuming a pull/webhook API, not requiring a local bridge, though this needs confirming once the provider is chosen — some GPS platforms are cloud-hosted and directly reachable from Vercel with no bridge needed at all, unlike the on-premise cameras).

---

## What's needed from the business owner before deeper work can start

| Item | Needed | Status (2026-09-01) |
|---|---|---|
| GPS | API/Developer/Integrations section check on Etit's and Zhongtong's own platforms (self-check in progress, screenshots to follow) | 16 vehicles confirmed on Etit; speed unit (km/h) confirmed |
| Cameras (general + counter) | Exact camera models/firmware/ISAPI credentials; **how cameras are currently viewed remotely** (settles cloud vs. local-network architecture) | In progress — incoming today |
| Cameras (general + counter) | Site network capability if local-network (static IP, VPN, dedicated always-on computer for the bridge) | Depends on the cloud-vs-local answer above |
| CSV | Decide re-upload/duplicate-handling behavior; decide export scope (all data vs. filtered) | Not yet raised |

**Expanded, vendor-ready version of this table is in `STATUS.md`**, kept
current as answers come in — see its "Update (2026-09-01, business owner
check-in)" section for the latest.
