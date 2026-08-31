# OPE Dashboard — Current Status

Living status document. Unlike `HANDOVER.md` (a one-time ownership-transfer
snapshot) this file is meant to be updated as work lands, so any session on
any machine can `git pull` and know exactly where things stand. Read
`CLAUDE.md` first for domain rules; this file is state, not spec.

Last updated: 2026-09-01.

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

### 2. GPS Integration — built and ready for provider config

**Migration `supabase/migrations/0019_gps_pings.sql` — written, NOT run**
against the live database (hard stop). Adds `vehicle_gps_pings`
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
plot. The query gracefully treats a missing `v_vehicle_latest_gps` (i.e.
migration 0019 not yet run) as "no data" rather than a 500, so this page
is safe to deploy ahead of the migration.

**Explicitly not built**: any GPS-driven change to
`fn_validate_operation_status`, auto-filled odometer/status, or "Operating
%" — CLAUDE.md and ROADMAP_NEXT.md both call this out as a separate,
later decision. `CLAUDE.md` section 1's stale "GPS is a later phase, do
not build for it" note has been updated to reflect that GPS work is now
in progress, without changing that specific deferral.

### 3-4. General Camera Integration / Counter Cams — not started yet

See `ROADMAP_NEXT.md` for the plan; will update this section as each
lands.

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
