-- Vendor performance trend history (roadmap item 6, 2026-08-30 autonomous
-- session). Named "driver/vendor" in the roadmap, but this schema has no
-- per-driver KPI/scorecard concept at all — CLAUDE.md's domain model scores
-- vendors only. Building a driver-level scoring system would be new
-- business logic invented well beyond "add a trend view," so this is
-- scoped to vendors, which is what "a trend view over scorecards" actually
-- has data for. Flagged for review, not silently narrowed.
--
-- v_scorecard_totals (0001) already has almost everything needed — it just
-- also includes each vendor's template row (period_month is null), which
-- isn't a KPI period and would corrupt a trend. These two views wrap it
-- with that one filter, plus a per-section breakdown for "which KPI area
-- is declining," not just the overall total.

create view v_vendor_kpi_trend as
select scorecard_id, vendor_id, period_month, sections_weight_total, total_achieved_pct
from v_scorecard_totals
where period_month is not null
order by vendor_id, period_month;

-- Section score % = sum of its line points / 100, per CLAUDE.md's own
-- formula (section 2, KPI scorecards) — not recomputed differently here.
create view v_vendor_kpi_section_trend as
select
  sc.vendor_id, sc.period_month, sec.section_name, sec.section_weight,
  round(sum(l.achieved_points) / 100.0, 3) as section_score_pct
from vendor_scorecards sc
join scorecard_sections sec on sec.scorecard_id = sc.id
join scorecard_lines    l   on l.section_id = sec.id
where sc.period_month is not null
group by sc.vendor_id, sc.period_month, sec.section_name, sec.section_weight
order by sc.vendor_id, sec.section_name, sc.period_month;
