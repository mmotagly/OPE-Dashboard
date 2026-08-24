# OPE Dashboard — Current Status

Living status document. Unlike `HANDOVER.md` (a one-time ownership-transfer
snapshot) this file is meant to be updated as work lands, so any session on
any machine can `git pull` and know exactly where things stand. Read
`CLAUDE.md` first for domain rules; this file is state, not spec.

Last updated: 2026-08-24.

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
    this is a correctness patch, not the full redesign (see §4).
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

Not started:

1. **Day Board's proper status-aware redesign.** Currently only patched
   with a correctness-preserving filter (§1, Daily Operations status
   feature Phase 4). It still doesn't visually represent all 7 statuses per
   row/card the way the rest of the status feature now does —
   `HANDOVER.md` §8 item 9 also flags Day Board as never having been
   redesigned to the table+drawer pattern at all. This is now the only
   item left from the original Daily Operations status rollout's phase
   plan (Phases 1/2/4 shipped as that feature; Phase 3 billing and Phase 5
   bulk planning have both shipped since — see §1).

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
