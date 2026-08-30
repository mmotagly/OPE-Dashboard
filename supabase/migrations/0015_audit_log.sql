-- Generic activity/audit log: who changed what and when, across entity
-- types. Distinct from rfr_stage_history (0001), which stays untouched and
-- keeps its own narrow job of feeding fn_rfr_access_minutes — this table is
-- for a human-facing activity view, not a computed clock.
--
-- Roadmap item 2 (2026-08-30 autonomous session). Covers the three event
-- types named: RFR stage changes, operation status changes, invoice
-- generation. Same fn_log_audit() helper can back more event types later
-- (work order completion, scorecard approval, ...) without a schema change.

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,            -- 'rfr' | 'operation' | 'invoice'
  entity_id   uuid not null,
  action      text not null,            -- 'stage_change' | 'status_change' | 'invoice_generated'
  actor_id    uuid references profiles(id),
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log (entity_type, entity_id);
create index on audit_log (created_at desc);

alter table audit_log enable row level security;

-- Activity history is admin-only reading, matching Settings' own scoping
-- (super_admin) — same "Administration" area of the app, CLAUDE.md section 3.
create policy p_audit_log_read on audit_log for select using (is_super());
-- No insert/update/delete policy for any role: entries are written only by
-- the security-definer trigger functions below, and the log is immutable —
-- nobody, including super_admin, can edit or delete a row through the app.

create or replace function fn_log_audit(
  p_entity_type text,
  p_entity_id   uuid,
  p_action      text,
  p_detail      jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (entity_type, entity_id, action, actor_id, detail)
  values (p_entity_type, p_entity_id, p_action, auth.uid(), p_detail);
end;
$$;

-- ---- RFR stage changes ------------------------------------------------

create or replace function fn_audit_rfr_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_log_audit('rfr', new.id, 'stage_change', jsonb_build_object(
    'rfr_number', new.rfr_number,
    'from', fn_lookup_code(old.stage_id),
    'to', fn_lookup_code(new.stage_id)
  ));
  return new;
end;
$$;

create trigger trg_audit_rfr_stage_change
  after update of stage_id on rfrs
  for each row when (old.stage_id is distinct from new.stage_id)
  execute function fn_audit_rfr_stage_change();

-- ---- Daily operation status changes ------------------------------------

create or replace function fn_audit_operation_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_log_audit('operation', new.id, 'status_change', jsonb_build_object(
    'operation_code', new.operation_code,
    'from', fn_lookup_code(old.status_id),
    'to', fn_lookup_code(new.status_id)
  ));
  return new;
end;
$$;

create trigger trg_audit_operation_status_change
  after update of status_id on daily_vehicle_operations
  for each row when (old.status_id is distinct from new.status_id)
  execute function fn_audit_operation_status_change();

-- ---- Invoice generation -------------------------------------------------

create or replace function fn_audit_invoice_generated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_log_audit('invoice', new.id, 'invoice_generated', jsonb_build_object(
    'vendor_id', new.vendor_id,
    'period_month', new.period_month,
    'net_amount', new.net_amount,
    'status', new.status
  ));
  return new;
end;
$$;

create trigger trg_audit_invoice_generated
  after insert on vendor_invoices
  for each row execute function fn_audit_invoice_generated();

-- ---- Read view: resolves the actor's name for display ------------------

create or replace view v_audit_log as
select
  a.id, a.entity_type, a.entity_id, a.action, a.detail, a.created_at,
  a.actor_id, p.full_name as actor_name
from audit_log a
left join profiles p on p.id = a.actor_id
order by a.created_at desc;
