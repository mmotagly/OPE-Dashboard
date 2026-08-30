# OPE Dashboard — Current Status

Living status document. Unlike `HANDOVER.md` (a one-time ownership-transfer
snapshot) this file is meant to be updated as work lands, so any session on
any machine can `git pull` and know exactly where things stand. Read
`CLAUDE.md` first for domain rules; this file is state, not spec.

Last updated: 2026-08-30.

---

## 0. Design system pilot — Daily Operations (in progress, not yet deployed)

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
- **Known, logged gap**: the login page's own hardcoded logo badge (separate
  markup from the shared `Topbar`, out of scope for this pass) is now
  visually inconsistent with the rest of the signed-in app — see
  `HANDOVER.md` §8 item 11.
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
```

Note on `0014`: the file in the repo is the **corrected** version (a
`name[] = text[]` type-mismatch bug was fixed after the first run attempt
failed before touching any data — see §1). There was never a version of
`0014` that ran successfully with the bug still in it, so there's nothing
to reconcile.

**Nothing pending.** If a future session sees a migration file with no
corresponding entry in this list, treat its run-state as unknown — ask the
user, don't assume either way. Claude has no direct database access on this
project; migration-run status can only be established from what a user
reports in conversation or from a query the user runs and reports back.

---

## 4. What's next

The Daily Operations status rollout's original phase plan is now fully
shipped (Phases 1/2/4, Phase 3 billing, Phase 5 bulk planning, the Day
Board redesign, its real-PM-data fix, and the table+drawer decision — see
§1). **Nothing pending from this rollout.**

**Design system rollout (see §0):** Daily Operations is the pilot; every
other module (Day board, Charging, RFRs, Work orders, Periodic maintenance,
Vehicles/Drivers/Vendors/Routes, Scorecards, Invoices, Settings, plus the
login page's logo badge — `HANDOVER.md` §8 item 11) still needs its own
pass once the pilot is signed off.

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
