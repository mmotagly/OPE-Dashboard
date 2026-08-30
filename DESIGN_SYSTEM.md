# Pyramids Ops — Design System (v1, pilot)

Source of truth for the OPE Dashboard UI/UX redesign. This is stack-agnostic by design — implementation should map these tokens onto whatever the repo already uses (Tailwind config, CSS variables, shadcn theme, etc.), not force a new styling approach into the codebase.

**Status: rolled out to every module.** Piloted on Daily Operations, then applied module by module to the rest of the app. See `STATUS.md` for the shipped history. The mapping below (§Color tokens, §Typography) reflects the actual implementation in `src/app/globals.css`, not just the original spec — two gaps the original spec didn't cover (the idle/neutral pair, and the accent/elev split) were resolved during implementation and are documented inline below.

## Principles

1. **Restrained brand accent.** TMF red-orange appears only in: the logo, the active sidebar nav item, and primary action buttons (max one primary button per screen). It is never used for status indicators, links, or entity names in tables.
2. **Calm and premium, not flashy.** Quiet neutral surfaces do the heavy lifting. Hierarchy comes from spacing, weight, and muted-vs-primary text — not color.
3. **Built for long shifts.** Compact but legible. Nothing below 11px. Two font weights only in UI chrome: 400 regular, 500/600 for emphasis (numbers, headings, active states).
4. **Full theme support.** Every token below has a light and dark value. Dark is the default (existing sessions see no change until they opt in); light is a manual, per-viewer toggle — not automatic from OS preference — so the switch is deliberate and persists via a cookie, not `localStorage` (SSR needs to read it before first paint to avoid a flash).

## Typography

Font: Inter (fallback to the project's existing system font if Inter isn't already a dependency — flag before adding a new font dependency). **Implementation note:** Inter was added globally via `next/font/google` (self-hosted, zero new npm dependency — the same pattern already used for the project's base font, Rubik) but is only actually applied on the Daily Operations page this pass. Every other module keeps rendering in Rubik until it's redesigned in turn.

Each role below is also a named token in `globals.css`'s `@theme` block, generating a matching Tailwind utility class — components should reference the class (`text-page-title`, `text-table-header`, ...), never the raw pixel value.

| Role | Token | Size | Weight | Notes |
|---|---|---|---|---|
| Page title | `text-page-title` | 13.5–14px | 600 | e.g. "Daily operations — 30 Aug 2026" |
| Breadcrumb / eyebrow | `text-eyebrow` | 10px | 400 | muted color, sits above page title |
| Section label (uppercase) | `text-section-label` | 10px | 500 | letter-spacing 0.04em |
| Table header | `text-table-header` | 10px | 500 | uppercase, letter-spacing 0.04em |
| Body / table cell | `text-body` | 11.5–12px | 400 | |
| Metric value | `text-metric` | 16px | 600 | |
| Nav item | `text-nav-item` | 12px | 400 (500 if active) | |
| Button label | `text-button` | 11.5px | 500 | |

Letter-spacing (`tracking-[0.04em]`) isn't itself a token — Tailwind doesn't generate one from a `--text-*` key — so it's applied as a literal utility alongside the size token wherever the size token calls for it. That's a spec constant, not a magic number.

## Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F7F6F4` | `#131313` | page background |
| `surface` | `#FFFFFF` | `#1A1A1B` | cards, sidebar, table |
| `border` | `#E7E5E1` | `#28282A` | hairline dividers |
| `text-primary` | `#1C1C1A` | `#EDEDEB` | body text |
| `text-secondary` | `#83817B` | `#8C8B88` | supporting text |
| `text-muted` | `#A8A6A0` | `#5F5E5B` | labels, captions |
| `accent` | `#D9481F` | `#E8703F` | active nav item text/icon only |
| `accent-fill` | `#D2461E` | `#BA5A32` | logo badge, primary button — solid fill behind white text (see below) |
| `accent-bg` | `#FBEAE3` | `#2E1B12` | active nav background tint |
| `success` / `success-bg` | `#0F6E56` / `#E4F3EE` | `#5DCAA5` / `#0E2B24` | completed, on time, approved |
| `warning` / `warning-bg` | `#8A5A0B` / `#FBF0DC` | `#E3A84E` / `#332309` | delayed, pending |
| `danger` / `danger-bg` | `#A32D2D` / `#FCECEC` | `#E29393` / `#341313` | cancelled, overdue, error |

No other hues. Status pills always use one of the three semantic pairs above — never brand orange.

### Two gaps this table didn't cover, resolved during implementation

**No neutral/`idle` pair was specified**, but the app needs one — "Planned" status, inactive nav counts, generic neutral badges. Resolved as:

| Token | Light | Dark | Use |
|---|---|---|---|
| `idle` | `#E7E5E1` (= `border`) | `#28282A` (= `border`) | idle pill / badge background |
| *(idle text)* | `text-secondary` | `text-secondary` | idle pill / badge text — reuses the existing token, no new one added |

**`elev` had to split from `accent`.** The pre-pilot design had one token ("selected card, active nav") doing double duty. That's incompatible with Principle 1 — a selected table row must **not** go brand-orange, only the active nav item may. So:

- `elev` stays a **neutral** elevated tone (selected table row, selected filter chip) — unrelated to brand color, unchanged hue-wise from before the pilot.
- `accent` / `accent-bg` are new, dedicated tokens used **only** for the active sidebar nav item (background = `accent-bg`, text = `accent`) and primary buttons (background = `accent`, text = white). Nowhere else.

### Contrast fix — `accent-fill`, a second accent token

White button-label text on the `accent` fill (the primary-button spec: "accent-filled, white text") originally failed WCAG AA (4.5:1) for normal-size text: **~3.08:1 dark, ~4.29:1 light**. Corrected by adding a new token, **`accent-fill`** — same hue as `accent`, minimally darkened — used only where accent fills a solid background behind white text (logo badge, primary buttons):

| Token | Light | Dark | Contrast vs. white |
|---|---|---|---|
| `accent-fill` | `#D2461E` | `#BA5A32` | **4.53:1** (light) / **4.57:1** (dark) |

`accent` itself (`#D9481F` / `#E8703F`) is **unchanged** — it's also the *text* color on `accent-bg` for the active nav item, where the original value already cleared AA (~5.3:1 dark). Darkening `accent` directly, as first attempted, would have silently dropped that pairing to ~3.6:1 as a side effect. Splitting the two uses into separate tokens fixes the flagged problem without introducing a new one — both values read as the same brand orange, just tuned for their own contrast context, which is standard practice (text color vs. fill color are rarely identical in a real palette). See `STATUS.md` for when this shipped.

## Spacing & shape

- Card / table container radius: 10px — token `rounded-card` (`--radius-card`)
- Button / input radius: 7px — token `rounded-control` (`--radius-control`)
- Card padding: 11–13px
- Section gap: 16px
- Sidebar width: ~164px (implemented at 232px — the project's existing sidebar width, per `CLAUDE.md`'s layout spec; not changed by this pilot)

**Implementation note on radius rollout:** these two tokens already existed in the codebase pre-pilot (`--radius-card`, `--radius-control`) but were never actually referenced by components — every component hardcoded an arbitrary matching pixel value instead (`rounded-[10px]`, etc.). This pilot fixed that only in the files it touched (the shared `Sidebar`/`DataTable`/`Drawer`/`Pill`/`Button`/`Panel`/`Field` components, plus Daily Operations' own page files) — every other module's arbitrary `rounded-[10px]` is untouched and still renders at the old 10px control radius until that module gets its own pass. Expect a visible radius seam between Daily Operations (7px) and everywhere else (10px) until the rollout continues.

## Components

**Sidebar nav** — flat icon + label list (no grouped section headers). Active item = `accent-bg` background, `accent` text and icon. Inactive = `text-secondary`, transparent background. A theme toggle sits at the bottom, below a hairline divider — not itself accent-colored (it's a utility control, not a primary action).

**Page header** — eyebrow breadcrumb (10px, muted) above a 14px/600 title, one primary button right-aligned if the page has a primary action. Never more than one primary (accent-filled) button per screen.

**Metric cards** — neutral `surface` background, uppercase muted label, bold value. Value color is neutral unless the metric itself represents a status (e.g. "Delayed" count can use `warning`).

**Data table** — dense (11.5–12px rows), uppercase muted headers, hairline row dividers, no zebra striping needed. Status shown via pill badges (semantic tint background + matching darker text), not plain text or brand orange.

**Buttons** — `primary` (`accent-fill`-filled, white text) reserved for the single most important action per screen. Everything else is `secondary` (outlined or ghost, neutral text).

## Do / Don't

- Don't use brand orange for links, entity names, or status — reserved for logo / active nav / primary CTA only.
- Don't introduce a second accent hue.
- Don't go below 11px anywhere in the UI.
- Don't hardcode hex values in components — reference the token layer once it's wired into the project's existing styling system.
- Do keep both themes fully supported, not just dark.

## Reference

Visual target (tone, density, hierarchy) approved during the design discussion: a sidebar + metric-card row + dense status table, Inter typeface, dark mode default with full light-mode parity.
