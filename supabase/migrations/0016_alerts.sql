-- In-app alerts (roadmap item 3, 2026-08-30 autonomous session): PM-overdue
-- and RFR-aging. In-app rather than email — no email provider is configured
-- in this project (no credentials, no npm dependency for one), while
-- everything needed for in-app alerts already exists: the data, RLS, and
-- the read-render-in-UI pattern every other module already uses.
--
-- The RFR-aging threshold is a NEW, separate, configurable operational
-- heads-up — it does not touch the Lead Time KPI or scorecards in any way,
-- and is not presented as an SLA target. CLAUDE.md section 8 settles that
-- access time is deliberately compared against no target for the KPI; this
-- alert is a distinct concern (a supervisor/data_admin worklist prompt, not
-- a vendor performance measure) and was a judgment call — flagged for
-- review, not assumed uncontroversial. See STATUS.md.

insert into app_settings (key, value, label) values
  ('rfr_aging_alert_hours', 48, 'Hours an RFR can stay Active before it shows as an aging alert')
on conflict (key) do nothing;

-- Same shape as v_periodic_maintenance, pre-filtered to the two statuses
-- that warrant a worklist prompt, so the client needs one plain select.
create view v_pm_alerts as
select *
from v_periodic_maintenance
where maintenance_status in ('due_now', 'overdue')
order by km_remaining asc nulls last;

create view v_rfr_aging_alerts as
select
  r.id as rfr_id, r.rfr_number, r.vehicle_id, v.vehicle_code, v.plate_number,
  r.request_at, r.description,
  fn_rfr_access_minutes(r.id) as access_minutes,
  fn_format_minutes(fn_rfr_access_minutes(r.id)) as access_display
from rfrs r
join vehicles v on v.id = r.vehicle_id
where fn_lookup_code(r.stage_id) = 'active'
  and fn_rfr_access_minutes(r.id) >= (select value from app_settings where key = 'rfr_aging_alert_hours') * 60
order by access_minutes desc;
