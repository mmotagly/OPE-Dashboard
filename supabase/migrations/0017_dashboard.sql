-- Planning Manager dashboard/reporting (roadmap item 4, 2026-08-30
-- autonomous session): four rollups. Bus-days billed per vendor reuses the
-- existing v_vendor_monthly_bus_counts (0014) as-is — nothing new needed
-- there, the app layer just aggregates across shifts for a chosen month.
-- The other three get one focused view each, matching this schema's
-- existing convention of narrow, single-purpose views rather than one wide
-- view mixing grains.
--
-- fn_rfr_access_minutes is used here purely as a reporting average, NOT as
-- an SLA/target and NOT wired into the Lead Time KPI or scorecards —
-- CLAUDE.md section 8 settles that access time is deliberately compared
-- against no target for the KPI. Displaying its aggregate for management
-- reporting is a materially different use (a rollup number on a dashboard,
-- not a pass/fail evaluation), but it's the second feature this session
-- that sits close to that settled decision's boundary — flagged for review
-- alongside the alerts threshold in 0016. See STATUS.md.

-- PM compliance rate: fleet-wide current snapshot, not historical — matches
-- how the PM board itself (v_periodic_maintenance) is a live snapshot.
create view v_pm_compliance_summary as
select
  count(*) filter (where maintenance_status = 'ok')       as ok_count,
  count(*)                                                 as total_count,
  round(
    100.0 * count(*) filter (where maintenance_status = 'ok')
    / nullif(count(*), 0), 1
  ) as compliance_pct
from v_periodic_maintenance;

-- RFR resolution time: only RFRs that have actually completed (completed_at
-- set), grouped by the month they completed in.
create view v_rfr_resolution_summary as
select
  date_trunc('month', r.completed_at)::date as period_month,
  count(*)                                   as completed_count,
  round(avg(fn_rfr_access_minutes(r.id)))    as avg_access_minutes,
  round(percentile_cont(0.5) within group (order by fn_rfr_access_minutes(r.id)))
                                              as median_access_minutes
from rfrs r
where r.completed_at is not null
group by 1
order by 1 desc;

-- Fleet utilization %: of the active fleet, what share ran (operating or
-- completed) at least once that month. Matches "active" the same way
-- v_vendor_monthly_bus_counts' billable-status filter does (0014).
create view v_fleet_utilization_monthly as
select
  date_trunc('month', o.operation_date)::date as period_month,
  count(distinct o.vehicle_id) filter (
    where fn_lookup_code(o.status_id) in ('operating', 'completed')
  ) as active_vehicle_count,
  (select count(*) from vehicles v where fn_lookup_code(v.status_id) = 'active')
                                               as fleet_size,
  round(
    100.0 * count(distinct o.vehicle_id) filter (
      where fn_lookup_code(o.status_id) in ('operating', 'completed')
    )
    / nullif((select count(*) from vehicles v where fn_lookup_code(v.status_id) = 'active'), 0)
  , 1) as utilization_pct
from daily_vehicle_operations o
group by 1
order by 1 desc;
