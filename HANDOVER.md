# OPE Dashboard — Project Handover

Internal operations tracker for a shuttle bus operation at the Pyramids of Giza.
Built August 2026. This document is everything a new owner (and their AI
assistant) needs to pick the project up cold.

**Read `CLAUDE.md` in the repo before doing any work.** It is the build brief:
domain rules, role matrix, design system, hard rules, and known traps. This
document covers what `CLAUDE.md` deliberately does not — history, current
state, what's broken, and what's left.

---

## 1. What the system does

A company operates shuttle buses carrying visitors around the Pyramids on
fixed, pre-planned routes. Some buses are owned by the company, most are
supplied by vendors. The system tracks:

- **Daily operations** — one record per bus per shift, with odometer readings
- **Maintenance** — RFR (Request For Repair) → Work Order flow
- **Periodic maintenance** — per-part, KM-driven, fed by daily odometer readings
- **Vendor invoicing** — monthly, driven by KPI scorecards

Scale: ~50 vehicles, 5 vendors, 100 drivers, 10 routes, 15 stations.
Everything is manual entry today. GPS devices exist but integration is a
later phase.

---

## 2. Infrastructure to transfer

| Thing | Where | What to do |
|---|---|---|
| Code | GitHub `mmotagly/OPE-Dashboard` | Transferred |
| Database | Supabase project `zvcfnavmrrbcfrszuxie` | Transfer project, or migrate to a new one |
| Hosting | Vercel project `ope-dashboard` (new project, under this account) | Live |
| Live URL | `ope-dashboard-seven.vercel.app` | Working |

**If migrating to a fresh Supabase project instead of transferring:**

1. Run `supabase/migrations/0001_init.sql` in the SQL editor
2. Run `supabase/migrations/0002_saved_filters.sql`
3. Regenerate types:
   `npx supabase gen types typescript --project-id <new-ref> > src/lib/supabase/types.ts`
4. Create auth users manually (Authentication → Users → Add user, with Auto
   Confirm ticked), then insert matching `profiles` rows — see section 7
5. Re-seed vendors, vehicles, drivers, routes, stations
6. Run `select v.vehicle_code, fn_init_pm_schedules(v.id) from vehicles v;`

**Environment variables** (both required, both must exist before the build
runs — `NEXT_PUBLIC_*` values are baked in at build time, so adding them
afterwards requires a redeploy):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` but nothing currently uses it.

---

## 3. Resolved — production deployment

Production was down after the handover (`500 MIDDLEWARE_INVOCATION_FAILED`,
the Supabase client failing to read its env vars). The original Vercel
account's owner was unreachable, so rather than debug the old project's
configuration, a fresh Vercel project was created under this account
instead and linked to the transferred GitHub repo. It deployed cleanly with
both `NEXT_PUBLIC_*` env vars set from the start, and sign-in has been
confirmed working end-to-end at `ope-dashboard-seven.vercel.app`.

---

## 4. Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict
- Supabase — Postgres + Auth, `@supabase/ssr`
- Tailwind v4 — theme in `src/app/globals.css` under `@theme`, no JS config
- next-intl — `[locale]` segment, `en` default and `ar` with full RTL
- Deployed on Vercel

```bash
npm install
cp .env.example .env.local     # fill in the two Supabase values
npm run dev

npm run typecheck
npm run lint
npm run build                  # run this before declaring anything done
```

---

## 5. Current state

### Built and working

All nine modules exist, each as a full-width table with an overlay drawer:

| Module | Route | Notes |
|---|---|---|
| Day board | `/day-board` | Not redesigned — still uses the old card pattern |
| Daily operations | `/operations` | Reference implementation; copy its shape |
| Charging sessions | `/charging` | Plug A / B / A+B, DB-enforced clash detection |
| RFRs | `/rfrs` | Stage rail, access-time clock, per-issue skip |
| Work orders | `/work-orders` | Created only from an RFR, never standalone |
| Periodic maintenance | `/periodic-maintenance` | Rows are parts, drawer is the vehicle |
| Vehicles / Drivers / Vendors / Routes | `/vehicles` etc. | Master data |
| Scorecards | `/scorecards` | Templates and monthly, tabs to switch |
| Invoices | `/invoices` | Generate, trace, approve |
| Settings | `/settings` | Users, PM thresholds, lookup lists |

Plus:
- Auth with route protection and profile-based roles
- English / Arabic with working RTL throughout
- A shared design system (`Pill`, `Micro`, `KmMeter`, `Panel`, `DataTable`,
  `Drawer`, `StageRail`, `KeyValue`, `Button`, `Stat`, `Empty`)
- A composable filter bar on every list view, with saved views as tabs

### Verified by a human in a browser

- Daily operations — create, list, drawer, edit
- Scorecard template creation, opening a month, the achieved-points cap
- Invoice generation
- Drawer overlay behaviour, row accent bar, Escape to close

### NOT verified by anyone

- **Mobile.** Nothing has been opened on a phone. The drawer becomes a
  full-screen sheet below the `xl` breakpoint and that code path has never
  rendered. The field team enters data on phones, so this is the biggest risk.
- **Production.** See section 3.
- **Real data volume.** One bus, one driver, one route. Behaviour at 50
  vehicles is unknown.
- The plug-clash error message, RTL at every breakpoint, the filter bar's
  wrapping at narrow widths, saved-view round trips.

---

## 6. Domain rules that are not obvious

These were settled over long discussion. Getting one wrong produces wrong
invoices or wrong maintenance schedules. `CLAUDE.md` section 2 has the full
set; these are the ones most likely to be broken by accident.

**Access time.** A clock on each RFR that runs *only* while the stage is
`Active`, and stops at the earliest `repair_start_at` across its work orders.
Every other stage pauses it. Computed by `fn_rfr_access_minutes` / read from
`v_rfr_access_time`. **Never recompute it in TypeScript.**

**Periodic maintenance** is per vehicle × part, KM only, no time-based
intervals. When a work order completes, the DB advances `last_service_km`
using the odometer from the operation record **on the repair day** — not the
vehicle's latest-ever reading. Thresholds are global in `app_settings`:
500 km = due soon, 200 km = due now.

**Invoicing** differs by vendor type:
- Rentals → `bus-days × rate`, no KPI applied
- Owned (including the company's own vendor row) → `average daily buses ×
  monthly fee × achieved %`

Bus counts come from `v_vendor_monthly_bus_counts`, derived from actual
operations, never hand-entered. Call `fn_generate_invoice(vendor_id, month)`.
**Never reimplement the math.**

**KPI scorecards.** Each vendor has its *own* KPI set — sections, names and
weights are all per-vendor, there is no fixed global list. `period_month IS
NULL` means it's that vendor's template; a set month is a frozen snapshot.
Achieved is expressed in **points capped at the KPI's own weight**, enforced
by a DB trigger. Total comes from `v_scorecard_totals`.

**There is no trips module.** Trips were discussed at length and deliberately
dropped. The `trip_status` lookup category exists but is empty and unused —
do not treat it as a hint that trips are coming.

**Every vehicle has a vendor.** Company-owned buses point at the company's own
vendor row (`vendors.is_company = true`, one row only, enforced by index).
There is no `ownership_type` field.

**Daily operations** are one row per vehicle per shift per date. Routes never
change mid-shift. `vendor_id` and `vehicles.current_odometer_km` are both
maintained by DB triggers — never write them from the app.

---

## 7. Roles

Enum `app_role` on `profiles.role`:

| Role | Who | Access |
|---|---|---|
| `super_admin` | Planning Manager | Everything, read + write |
| `admin` | VP, Project Manager, Process Excellence Manager | Everything, **read only** |
| `supervisor` | Operations Manager, Operation Supervisor | Read all; write ops, maintenance, master data |
| `data_admin` | Data Entry Specialist, **Engineers** | Daily ops + RFR + work orders. **No invoices, no settings.** |

"Engineer" is a job title, not a role — `data_admin` plus
`profiles.is_engineer = true`, which makes them assignable on work orders.

RLS enforces all of this at the database level. There is no public sign-up;
accounts are created in Supabase, then a profile row is inserted:

```sql
insert into profiles (id, full_name, job_title, role, is_active)
select id, 'Full Name', 'Planning Manager', 'super_admin', true
from auth.users where email = 'someone@example.com';
```

---

## 8. Known issues and technical debt

Ordered by how much they matter.

1. **Filtering runs in TypeScript over a capped page**, not in the database.
   Operations, RFRs, work orders and charging cap at 200 rows. Operations
   grows ~100 rows/day (50 buses × 2 shifts), so the cap binds within days —
   after which filters silently search only the most recent 200 records.
   **This needs pushing into the query before real use.** It looks like it's
   working, which is what makes it dangerous.

2. **Sorting is also client-side** over the same fetched page.

3. **`operation_code` and `charging_session_code` are generated in the app**
   with a retry-on-collision loop. Two users entering simultaneously can still
   collide. These belong in SQL as defaults, the way `rfr_number` and
   `work_order_number` already are.

4. **Changing a filter while a drawer form is open discards typed input.**
   Known trade-off, never fixed.

5. **A possible data-integrity gap:** nothing checks that a bus's starting
   odometer matches the previous shift's ending odometer. A real gap of
   2,000 km between consecutive same-day records was observed in test data
   and the system accepted it silently.

6. **`saved_filters` uses a scoped `any` cast** in `src/lib/saved-filters-db.ts`
   because the checked-in generated types predate migration 0002. Regenerating
   types makes that file deletable.

7. **`experimental.typedRoutes` is deprecated** — it moved to top-level
   `typedRoutes` in Next 16. Build warning only.

8. **The `middleware` file convention is deprecated** in Next 16 in favour of
   `proxy`. There's a codemod: `npx @next/codemod@canary middleware-to-proxy .`

9. ~~Day board was never redesigned to the table + drawer pattern~~ — revisited
   and decided against. Day Board still uses `RecordCard`, deliberately: it's
   read-only (no create/edit, so the drawer-for-forms rationale doesn't
   apply), CLAUDE.md's "lists are tables" rule names its own scope and Day
   Board isn't in it, and the card already surfaces more per-row detail than
   a table row would without a click-through. See `STATUS.md`.

10. **Sidebar "Fleet status" and "Insights"** may be dead links left from the
    original scaffold.

11. **The login page's logo badge is now inconsistent with the rest of the
    app.** The design-system pilot (see `STATUS.md`) moved brand accent color
    to the logo, active nav item, and primary buttons only, and updated the
    shared `Topbar`'s logo accordingly — but `src/app/[locale]/login/page.tsx`
    has its own separate, hardcoded logo markup (`bg-ink text-on-ink`) that
    the pilot deliberately left untouched as out of scope (it's not part of
    the app shell, and the pilot was scoped to Daily Operations + the shared
    components it depends on). Once signed in, the logo is accent-orange
    everywhere; on the login screen itself, it's still the old neutral
    styling. Fix in a later pass by pointing it at the same `bg-accent
    text-on-accent` treatment `Topbar` now uses.

---

## 9. Not built / deferred

- **Dashboard and analytics.** The role spec says `data_admin` can't see
  "invoice or analytics or dashboard" — the first two exist and are gated, the
  third was never built.
- **GPS / telematics integration.** Devices exist; integration is a later
  phase. Keep odometer ingestion in one place so it can be swapped.
- **Trips module.** Deliberately dropped, see section 6.
- **Per-vehicle "next PM KM".** The work order has the field; per-part
  scheduling was built first and the per-vehicle version deferred.
- **KPI auto-calculation from operations data.** All KPI values are entered
  manually. Availability could come from `operating_percentage`; Lead Time
  depends on trips logic that doesn't exist.
- **Lead Time SLA target.** Access time is measured but deliberately compared
  against nothing. Do not wire it up or invent a target without asking.

---

## 10. Traps that have already cost time

Written into `CLAUDE.md` section 4, repeated here because they will recur.

- **`work_orders` has two FKs to `profiles`** (`assigned_engineer_id`,
  `created_by`). A bare embed returns PostgREST error `PGRST201`. Use
  `profiles!assigned_engineer_id`. `vendor_scorecards` has the same problem
  (`created_by`, `approved_by`). **Check for multiple FKs before writing any
  embed.**

- **`npm run typecheck` does not catch client/server boundary breaks.**
  Importing a value (not a type) from `queries.ts` into a client component
  drags `next/headers` into the browser bundle. Only `npm run build` catches
  it. Import from `queries.ts` with `import type` only, keep shared runtime
  helpers in a client-safe module, and **always run `npm run build` before
  calling a module done.**

- **`[locale]` in paths breaks shell and Python globs** — the brackets are
  read as a character class, so batch operations silently match nothing. Use
  `rglob` or equivalent.

- **Supabase type generation vs client version.** Generated types declaring
  `PostgrestVersion: "14.15"` collapse every query row to `never` on older
  `supabase-js`. Keep `@supabase/supabase-js` and `@supabase/ssr` current.

- **Saved views stored under an older shape read back empty.** If the filter
  state shape ever changes again, clear `saved_filters` rather than debugging
  blank views.

---

## 11. How this was built, and how to continue

The pattern that worked: settle the specification in conversation first, then
have Claude Code implement against `CLAUDE.md`. The schema and domain rules
were argued out over many rounds *before* any code was written, which is why
`CLAUDE.md` is worth keeping current.

**Batching works.** Master Data (four modules) and the final three modules
were each built in a single pass and came out clean. What does *not* work is
running parallel Claude Code sessions on the same repo — the modules share
`DataTable`, `Drawer` and the message files, so parallel sessions conflict on
every shared file.

**Keep `CLAUDE.md` updated.** Every time a rule is settled or a trap is hit,
it goes in there. That file is why a new session can be productive within
minutes.

**A prompt that works** looks like: name the module and its `CLAUDE.md`
section, list the specific domain constraints, name the DB functions or views
it must use rather than recompute, state which roles can write, and end with
"then run `npm run typecheck`, `npm run lint`, and `npm run build`."

---

## 12. Recommended order of work

1. ~~Fix the Vercel deployment~~ — done, see section 3.
2. **Test on a phone.** Twelve modules were refactored without the mobile
   sheet ever rendering, and phones are the primary entry device. This is
   now the top open priority.
3. **Move filtering and sorting into the database query** (section 8, item 1).
   This becomes a correctness bug within days of real use.
4. **Move code generation into SQL** (section 8, item 3).
5. Seed real master data — 50 vehicles, 100 drivers, 5 vendors, 10 routes,
   15 stations — then run `fn_init_pm_schedules` for every vehicle.
6. Build the dashboard, which the role spec assumes exists.
7. Decide whether the odometer-continuity gap (section 8, item 5) should be
   flagged, blocked, or ignored.

---

## 13. Open questions for the new owner

- Should the system warn when a shift's starting odometer doesn't match the
  previous shift's ending odometer for the same bus?
- Two `super_admin` accounts currently exist. The original spec has exactly
  one Planning Manager. Decide whether that's intended.
- Is there an SLA target for Lead Time, and should access time be compared
  against it?
