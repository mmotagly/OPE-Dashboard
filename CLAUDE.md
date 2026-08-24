# Pyramids Shuttle — Internal Operations Tracker

Build brief for Claude Code. Read this fully before writing anything.

---

## 1. What this is

An internal operations system for a company that runs shuttle buses for visitors
at the Pyramids of Giza on fixed, pre-planned routes.

It tracks daily bus operations, maintenance (RFR → Work Order), per-part periodic
maintenance driven by odometer readings, and monthly vendor invoicing driven by
KPI scorecards.

Scale: ~50 vehicles, 5 vendors, 100 drivers, 10 routes, 15 stations. Small data,
high input frequency. Correctness matters far more than throughput.

Everything is manual entry today. GPS/telematics integration is a later phase —
do not build for it now, but keep odometer ingestion in one place so it can be
swapped.

---

## 2. Domain rules — read carefully, these are non-obvious

### Vendors and vehicles
- Every vehicle belongs to a vendor. Buses the company owns point at the
  company's own vendor row (`vendors.is_company = true`). There is exactly one
  such row, enforced by a unique index.
- There is **no** ownership_type field. Vendor type (`Rentals` / `Owned`) carries it.
- Drivers may belong to a vendor or to the company. Both get a full profile.

### Daily operations
- One row per **vehicle per shift per date**. Enforced by a unique constraint.
- Shifts are Morning and Night. A bus cannot have two drivers in one shift; it can
  have different drivers across the two shifts.
- Routes never change mid-shift. Do not build for that case.
- **There is no trips module.** Trips are not entered, not derived, not counted.
  Do not add one.
- `vendor_id` is auto-filled from the vehicle by a DB trigger. Never ask for it.
- `vehicles.current_odometer_km` is maintained by a DB trigger from the latest
  operation row. Never write to it from application code.

### RFR → Work Order
- Operations files an **RFR** (Request For Repair). It is created as `Pending`.
- The Data Admin accepts it, moves it to `Active`, and assigns an engineer.
- The engineer fills and owns the **Work Order**.
- One RFR can produce **multiple** work orders. A work order links to the RFR as a
  whole, not to a specific issue.
- The RFR carries its own multi-select list of **issue types** (`rfr_issues`).
  Individual issues can be skipped with a skip reason. The whole RFR can also be
  skipped.
- An RFR can be marked Completed once **one or more** work orders are done.
- On RFR creation, driver and odometer are auto-filled by a DB trigger:
  driver = last driver assigned to that vehicle on or before the request date;
  odometer = last starting KM on or before that date. Both stay editable.

### Access time — the important one
- A clock that measures how long an RFR sat waiting.
- It runs **only while the stage is `Active`**. Every other stage pauses it.
- It **stops** at the earliest `repair_start_at` across the RFR's work orders.
  Until a work order has a repair start, it keeps running to now.
- Stored and computed in **minutes**. Displayed as `2d 4h 13m`.
- Backed by `rfr_stage_history` (written by a trigger on every stage change) and
  computed by `fn_rfr_access_minutes(rfr_id)`. Use the function or the
  `v_rfr_access_time` view. Never recompute this in TypeScript.

### RFR stage meanings
| Stage | Meaning |
|---|---|
| Pending | Filed, not yet accepted. Clock paused. |
| Active | Being worked. Clock running. |
| Skipped Next Trip | Deferred until after operating hours. Clock frozen. |
| Skipped Next PM | Skip the next scheduled periodic maintenance. |
| Skipped | Whole request skipped, needs a skip reason. |
| Rolled Over | Delayed to the next day. |
| Completed | At least one work order done. |

Only the Data Admin moves stages.

### Periodic maintenance
- Per **vehicle × part**, KM-based only. No time-based intervals.
- A part is a PM item when `parts.pm_interval_km` is not null. 19 of the 32
  seeded parts are PM items; the rest are replacement-only.
- `scheduled_km = last_service_km + interval_km`. If `last_service_km` is null the
  part has never been serviced and shows as `never_serviced`.
- When a work order is completed, the DB advances `last_service_km` for every
  replaced part, using the odometer from the **operation record on the repair
  day** — not the vehicle's latest-ever odometer.
- Thresholds are global, in `app_settings`: 500 km remaining = `due_soon`,
  200 km = `due_now`. Past scheduled = `overdue`.
- Read `v_periodic_maintenance`. Never compute status in TypeScript.

### Repeating index
- Count of prior work orders with the same issue type on the same vehicle within
  10 / 20 / 30 / 50 days. Read `v_work_order_repeat_index`. Never recompute.

### Invoicing
Configured per vendor on the vendor profile. Two shapes:

| Vendor type | Basis | Formula | KPI |
|---|---|---|---|
| Rentals | `per_bus_day` | bus-days × rate | no |
| Owned / company | `per_avg_bus_month` | avg daily buses × monthly fee × achieved % | yes |

- Bus counts come from `v_vendor_monthly_bus_counts`, derived from actual
  operations. Never entered by hand.
- Call `fn_generate_invoice(vendor_id, month)`. Do not reimplement the math.
- No fines, deductions, charging costs, or VAT — those live on the government
  portal's finance invoice, outside this system.

### KPI scorecards
- Each vendor has its **own** KPI set — sections, KPI names, and weights are all
  customisable per vendor. There is no fixed global list.
- `period_month IS NULL` = the vendor's editable template.
  `period_month` set = a frozen monthly snapshot used for that month's invoice.
- `fn_open_month(vendor_id, month)` copies the template into a new month.
- **Achieved is expressed in points and capped at the KPI's own weight**, even if
  overachieved. A DB trigger enforces the cap. Section score % = sum of its line
  points ÷ 100. Total % = Σ(section_weight% × section score %).
- Super admin approves; approved scorecards can be reopened.
- No bonus above 100%.

---

## 3. Roles

Enum `app_role`, on `profiles.role`.

| Role | Job titles | Access |
|---|---|---|
| `super_admin` | Planning Manager | Everything, read + write |
| `admin` | VP, Project Manager, Process Excellence Manager | Everything, **read only** |
| `supervisor` | Operations Manager, Operation Supervisor | Read all; write operations, maintenance, master data |
| `data_admin` | Data Entry Specialist, **Engineers** | Read all operational; write daily ops + RFR + work orders. **No access to scorecards or invoices.** |

"Engineer" is a **job title**, not a role. Engineers get `data_admin` plus
`profiles.is_engineer = true`, which makes them assignable on work orders.

RLS enforces all of this at the database level. Application code must still hide
what a role cannot use — a `data_admin` should not see Finance in the sidebar at
all, not see it and get an error.

---

## 4. Stack and conventions

- Next.js 16 App Router, React 19, TypeScript strict
- Supabase (Postgres + Auth), `@supabase/ssr`
- Tailwind v4 — theme lives in `src/app/globals.css` under `@theme`, no JS config
- next-intl, `[locale]` segment, locales `en` (default) and `ar`
- Auth: email + password. Accounts are created manually in Supabase; there is no
  public sign-up. Do not build one.
- Deploy: Vercel. Repo: GitHub.

### Hard rules

1. **Logical properties only.** `ps-4` `pe-4` `ms-auto` `text-start` `border-s`.
   Never `pl-` `pr-` `ml-` `mr-` `text-left` `text-right`. RTL must work for free.
2. **Server Components by default.** Reach for `"use client"` only where there is
   real interactivity. Data fetching happens in Server Components.
3. **Mutations are Server Actions**, validated with zod at the boundary.
4. **Forms never get their own route.** Creating or editing a record opens in the
   right-hand detail pane, replacing whatever detail was showing. On desktop the
   list stays visible beside it; below 1180px the form becomes a full-screen
   sheet over the list. Drive it from the URL so the pane stays a Server
   Component — `?mode=new`, `?mode=edit&id=<uuid>`.
5. **Never duplicate database logic in TypeScript.** Access time, PM status,
   repeat index, invoice math, KPI totals, odometer sync — all live in SQL. Read
   the views and call the functions.
6. **UI strings are translated; data is not.** Every label goes through next-intl.
   Codes, plate numbers, names, and route names stay in English in the database
   and render as-is in both locales.
7. Tabular figures on every number: the `.tnum` utility.
8. No `localStorage` for anything that belongs in the database.

### Notes that have already bitten

**Ambiguous PostgREST embeds.** `work_orders` reaches `profiles` through two
foreign keys — `assigned_engineer_id` and `created_by` — so a bare
`profiles ( full_name )` fails with `PGRST201`. Name the key:
`profiles!assigned_engineer_id ( full_name )`. Before writing any select with an
embed, check whether the base table has more than one FK to the target.

**`npm run typecheck` does not catch client/server boundary breaks.** Importing a
value from a module that reaches `next/headers` — `queries.ts`, `auth.ts`, the
server Supabase client — into a Client Component typechecks fine and fails at
build. Import from `queries.ts` with `import type` only, and keep shared runtime
helpers in `lib/format.ts` or another client-safe module. Run `npm run build`
before calling a module done.

---

## 5. Design system

Dark theme. Tokens are in `globals.css`. Never hardcode a colour.

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#0B0D0E` | App background |
| `--color-surface` | `#141719` | Cards, panels |
| `--color-raise` | `#1A1E20` | Hover |
| `--color-elev` | `#1E2325` | Selected card, active nav |
| `--color-ink` | `#F1F3F3` | Headings, codes, primary buttons |
| `--color-ink-2` | `#A3AAAE` | Labels |
| `--color-ink-3` | `#6B7278` | Meta, placeholders |
| `--color-hairline` | `#23282B` | Dividers, borders |
| `--color-go` | `#22C55E` | Ready, completed, paid |
| `--color-warn` | `#F0B429` | Due soon, pending, late, operating (in progress) |
| `--color-stop` | `#F0554E` | Overdue, skipped, under repair |
| `--color-idle` | `#2C3235` | Neutral pill, inactive |

Rules:
- Colour is **information, never decoration**. Green only for good states, amber
  only for approaching-limit or in-progress, red only for breached. Nothing
  else is coloured. `operating` uses amber rather than green specifically so a
  dispatcher can tell "still running" apart from "finished" (`completed`, still
  green) at a glance, not just from the pill text — a deliberate one-off
  extension of "approaching-limit," not a general licence to use amber for
  anything ongoing.
- Depth comes from lightness steps plus a 1px light rim, not drop shadows.
- On filled bright pills, text is near-black (`--color-on-accent`).
- Typeface: **Rubik**, one family for Arabic and Latin. Codes are Rubik 600 with
  tabular figures — there is no separate mono face.
- Card radius 14px, control radius 8–10px.

### Layout
Two regions: nav tree (232px) and content, which takes all remaining width.
There is no record-list column. Below `xl` the sidebar hides and the content
region is the whole screen.

### Lists are tables
Every list page is one dense table filling the content width — RFRs, work
orders, operations, vehicles, drivers, vendors, routes, part schedules. One row
per record. Not cards.

- Header row: 11px, weight 500, `--color-ink-3`, sentence case, sticky
- Rows: 13px, 1px hairline between, hover `--color-raise`, selected `--color-elev`
- Codes and every number use `.tnum`; numeric columns align to the inline-end edge
- A missing value is an em dash in `--color-ink-3`, never a blank cell
- Status is a `Pill`; time and distance deltas are `Micro` labels
- Filter chips sit above the table and carry live counts
- Clicking a header sorts; the sort lives in the URL
- The empty state spans the table, not a bare row

A table panel passes `clip={false}` to `Panel` so the sticky header works.

### The drawer
Clicking a row opens a drawer that **overlays** the table from the inline-end
edge. It does not take a column and does not push the table. The clicked row
stays visible, gets a 2px accent bar on its inline-start edge and the elevated
background, and a scrim covers the table behind.

- Width `min(560px, 92vw)`, full height under the topbar, 1px inline-start
  border, heavy shadow
- Below `xl` it becomes a full-screen sheet
- Escape and the scrim close it
- Viewing, creating and editing all use the same drawer, driven by the URL:
  `?id=<uuid>` to view, `?mode=new`, `?mode=edit&id=<uuid>`. It stays a Server
  Component
- Structure, identical in every module: header with record code, status pill and
  close button · scrollable body · pinned footer, primary action first

### Form fields
Any prefilled value carries a 10.5px `--color-ink-3` hint underneath saying
where it came from — "From last reading", "Default driver for this bus".

### Components already built in `src/components/ui`
`DataTable` `Drawer` `FilterChips` `Pill` `Micro` `KmMeter` `Panel` `KeyValue`
`StageRail` `Button` `Field` `VehiclePicker` `Empty` `RecordCard` (day board
only). Use them. Never fork a second table, drawer or pill style.

### Signature element — the KM meter
On the vehicle drawer: `241,780 → 242,109` with the day's distance, and a
hairline bar underneath showing progress toward the nearest due PM item. Bar is
ink when healthy, amber at `due_soon`, red when `overdue`.

---

## 6. Modules to build

Already scaffolded: app shell, sidebar, topbar, auth, i18n, design system,
Day Board (reference implementation — copy its shape).

Build the rest in this order. Each is: list page (Server Component) + detail panel
+ create/edit form + server actions + zod schema.

1. **Daily operations** — list by date and shift, create/edit. Start KM prefilled
   from the vehicle's current odometer. Flag rows missing an end KM.
2. **Charging sessions** — plug selection is `A` / `B` / `A+B`. The DB rejects
   overlapping sessions on the same plug; surface that error clearly.
3. **RFRs** — list by stage, create form with searchable plate number, multi-select
   issues, auto-filled driver and KM shown as read-only-but-overridable. Detail
   shows the StageRail, access time, issues with per-issue skip, and work orders.
4. **Work orders** — created from an RFR via a button, opens a modal prefilled
   with the RFR content. Engineer assignment, maintenance centre, technicians
   (free text), multi-select replaced parts, repeat index shown read-only.
5. **Periodic maintenance** — board grouped by status from `v_periodic_maintenance`,
   filterable by vehicle and part.
6. **Master data** — vehicles, drivers, vendors, routes, stations, chargers, parts,
   maintenance centres, lookups. Plain tables with inline create/edit.
   `supervisor` and above only.
7. **Scorecards** — template editor per vendor, monthly scorecard with inline
   achieved-points entry, live section subtotals and total. `super_admin` writes.
8. **Invoices** — generate, list, approve. Show the formula used and its inputs.
9. **Settings** — users and roles, PM thresholds, lookup list management.
   `super_admin` only.

---

## 7. Database

`supabase/migrations/0001_init.sql` is the complete schema. Run it once in the
Supabase SQL editor, then generate types:

```
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

Do not hand-edit the generated types. If the schema needs a change, add a new
numbered migration — never edit `0001_init.sql` after it has run.

After seeding vehicles, build PM schedules:

```sql
select v.vehicle_code, fn_init_pm_schedules(v.id) from vehicles v;
```

---

## 8. Settled decisions and deferred work

### Settled — treat these as decided

- **`Al Tayaar` is a separate vendor row**, not a label on company-owned buses.
  It gets its own `vendors` record like any other.
- **The monthly fee is the average of all operated buses × the monthly fee.**
  There is no proration for a bus joining or leaving mid-month — the average
  already accounts for it. This is exactly what `per_avg_bus_month` does in
  `fn_generate_invoice`, so nothing in the code changes.
- **The Lead Time KPI is entered by hand.** It is based on trips logic, which
  does not exist. Access time *is* measured — `fn_rfr_access_minutes` and
  `v_rfr_access_time` — but it is deliberately compared against no target, and
  no SLA threshold is configured anywhere. Do not wire access time into the
  Lead Time KPI or invent a target for it.

### Deferred — do not build against these

- **There is no trips module and none is planned.** The `trip_status` lookup
  category exists with no seeded values and nothing reads it. Leave it alone:
  do not seed it, do not surface it, and do not treat its presence as a sign
  that trips are coming.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
