# Pyramids Ops — Next Roadmap: Hardware Integrations + Bulk Data I/O

**Status:** In progress — see the status table below (added 2026-09-01;
everything below the table is the original plan, unedited except where a
build decision needed recording inline).
**Owner decision needed on:** GPS provider API (Etit vs. Zhongtong), exact
Hikvision camera/firmware models in use

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
| 2 | GPS Integration | Not started |
| 3 | General Camera Integration | Not started |
| 4 | Counter Cams | Not started |

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
- **Etit** (Egyptian company, NTRA-licensed, has a real platform called ETIT-FMS) — no public API docs found yet; needs a direct ask to their support/account team about REST API or webhook access.
- **Zhongtong** (bus manufacturer's built-in unit) — unknown API status, needs investigation. Manufacturer-installed telematics units are often locked to a proprietary app with no public integration path — historically the lower-probability option.

**Action item for the business owner:** get API documentation or confirmation of API availability from at least one provider before implementation can begin in earnest.

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

See `STATUS.md`.

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

### Scope questions for the business owner
- Does your site have a dedicated computer/server that could run this bridge software continuously?
- Is there any existing network infrastructure (static IP, VPN, port forwarding) at the site, or would this need to be set up from scratch?
- For playback specifically — do you need this accessible remotely (from anywhere), or only when someone is physically at the site on the local network?

### Architecture notes for Claude Code
- Do NOT attempt direct browser-to-camera connections from a user's browser over the public internet — Hikvision cameras are not designed for public exposure and this would be a real security risk.
- The bridge/agent is a separate small application/service — likely Node.js or similar, running locally, not part of the main Next.js app's deployment.
- Design the main app's UI (camera list, live view player, playback scrubber) assuming it talks to *your own* backend API (Supabase Edge Function or a small proxy), which in turn talks to the bridge — never the camera directly from the browser.

### BUILD NOTES (added during implementation, 2026-09-01)

See `STATUS.md`.

---

## 4. Counter Cams (people counting)

### Confirmed technical foundation
Same Hikvision ISAPI foundation as general cameras, with real, working endpoints specifically for counting:
- `/ISAPI/Event/channels/{id}/SearchRegionTargetNumberCounting` — periodic enter/exit count reports (real-time, daily, monthly)
- `/ISAPI/Event/notification/alertStream` — continuous event stream for real-time counting events

This is genuinely simpler than general camera video — it's just structured count data (timestamped enter/exit numbers), not video streaming, so once the local bridge/agent from item #3 exists, adding counter-cam data collection is a much smaller additional step (same bridge, different ISAPI endpoint, simpler data shape).

### What this would enable
- Per-bus, per-shift passenger counts (enter/exit) — genuinely useful data tied directly to Daily Operations records
- Potential future use: capacity/occupancy tracking, ridership reporting per route

### Architecture notes for Claude Code
- A new `bus_passenger_counts` table (vehicle_id, timestamp or shift reference, enter_count, exit_count, source: counter-cam) — should tie back to `daily_vehicle_operations` records (same vehicle + date + shift).
- Depends on item #3's bridge/agent architecture being built first — don't duplicate that infrastructure.
- This is lower risk than general camera video (no live-streaming/security exposure concerns, just periodic data pulls), so it's a good "prove out the bridge architecture" first step before tackling live video.

### BUILD NOTES (added during implementation, 2026-09-01)

See `STATUS.md`.

---

## Suggested execution order

1. **CSV Import/Export** — start immediately, no blockers.
2. **Local bridge/agent architecture** — a dedicated planning + prototyping phase, likely starting with Counter Cams (simpler data, proves the architecture) before General Camera live/playback (more complex, real security implications).
3. **GPS Integration** — proceed as soon as a provider API is confirmed; can happen in parallel with the above since it's architecturally independent (assuming a pull/webhook API, not requiring a local bridge, though this needs confirming once the provider is chosen — some GPS platforms are cloud-hosted and directly reachable from Vercel with no bridge needed at all, unlike the on-premise cameras).

---

## What's needed from the business owner before deeper work can start

| Item | Needed |
|---|---|
| GPS | API docs/confirmation from Etit and/or Zhongtong |
| Cameras (general + counter) | Confirm exact camera/NVR models and firmware versions; confirm site network capability (static IP, VPN, dedicated always-on computer for the bridge) |
| CSV | Decide re-upload/duplicate-handling behavior; decide export scope (all data vs. filtered) |

**Expanded, vendor-ready version of this table is in `STATUS.md`**, written
during implementation once the exact schema/adapter shape made clear
exactly which fields/endpoints/credentials are needed.
