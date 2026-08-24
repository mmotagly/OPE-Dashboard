-- ============================================================================
-- 0014: Invoicing — shift dimension
-- ============================================================================
-- Rentals and Owned vendors are now invoiced per shift (Morning/Night), not
-- per month as a whole. Fixes a real pre-existing bug in
-- v_vendor_monthly_bus_counts along the way: a bus running both shifts on
-- the same date counted as one bus-day instead of two, since the old
-- grouping used count(distinct (vehicle_id, operation_date)) with no shift
-- dimension. The view also had no status filter at all — Planned, Cancelled
-- (x3), and Under Maintenance rows were counted as billable.
--
-- Billable = operating_percentage's own domain: 'operating' and 'completed'
-- are the only two statuses where it's ever non-null
-- (trg_validate_operation_status forces it null everywhere else).
--
-- Scorecards stay month-level, shared across both shift-invoices — no change
-- to vendor_scorecards/scorecard_sections/scorecard_lines/v_scorecard_totals,
-- and fn_generate_invoice's KPI lookup is untouched, just now run once per
-- shift-invoice, always resolving to the same scorecard/pct for that vendor
-- and month.
--
-- One existing vendor_invoices row (draft, not approved/paid — confirmed
-- with the user) is left untouched as a legacy whole-month record;
-- shift_type_id stays null on it. No backfill.

-- ---- schema ----------------------------------------------------------------

alter table vendor_invoices
  add column shift_type_id uuid references lookups(id);

alter table vendor_invoices
  add constraint vendor_invoices_shift_lookup
  check (shift_type_id is null or lookup_in(shift_type_id, 'shift_type'));

-- Drop the old 2-column unique constraint by looking up its actual name
-- rather than guessing it, so this can't silently no-op against the live
-- schema.
do $$
declare v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'vendor_invoices'::regclass
    and contype = 'u'
    and (
      select array_agg(attname order by attnum)
      from pg_attribute
      where attrelid = 'vendor_invoices'::regclass
        and attnum = any(conkey)
    ) = array['vendor_id', 'period_month'];

  if v_conname is not null then
    execute format('alter table vendor_invoices drop constraint %I', v_conname);
  end if;
end $$;

alter table vendor_invoices
  add constraint vendor_invoices_vendor_period_shift_key
  unique (vendor_id, period_month, shift_type_id);

-- ---- view: regroup by shift, fix the bus-day bug, add the status filter ---

drop view if exists v_vendor_monthly_bus_counts;

create view v_vendor_monthly_bus_counts as
select o.vendor_id,
       date_trunc('month', o.operation_date)::date as period_month,
       o.shift_type_id,
       sum(coalesce(o.operating_percentage, 100) / 100.0)     as bus_days,
       count(distinct o.operation_date)                        as operating_days,
       round(
         sum(coalesce(o.operating_percentage, 100) / 100.0)
         / nullif(count(distinct o.operation_date), 0), 4
       ) as avg_daily_buses
from daily_vehicle_operations o
join lookups ls on ls.id = o.status_id
where o.vendor_id is not null
  and ls.code in ('operating', 'completed')
group by 1, 2, 3;

-- ---- function: add p_shift_type_id, drop the old 2-arg overload ----------
-- CREATE OR REPLACE FUNCTION does not replace a function when the argument
-- list changes type signature — it creates a second overload instead. The
-- old 2-arg version must be dropped explicitly or it keeps existing,
-- callable, and now broken (a bare vendor+month lookup against the newly
-- 3-key-grouped view returns multiple rows for any vendor operating both
-- shifts, erroring on the scalar SELECT INTO).

drop function if exists fn_generate_invoice(uuid, date);

create or replace function fn_generate_invoice(
  p_vendor_id uuid, p_month date, p_shift_type_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_basis text; v_rate numeric; v_apply boolean; v_curr text;
  v_qty numeric; v_sc uuid; v_pct numeric;
  v_gross numeric; v_net numeric; v_id uuid;
begin
  select billing_basis, rate_amount, apply_kpi, currency
    into v_basis, v_rate, v_apply, v_curr
  from vendors where id = p_vendor_id;

  if v_basis is null or v_rate is null then
    raise exception 'Vendor has no billing terms configured';
  end if;

  select case when v_basis = 'per_bus_day' then bus_days else avg_daily_buses end
    into v_qty
  from v_vendor_monthly_bus_counts
  where vendor_id = p_vendor_id
    and period_month = v_month
    and shift_type_id = p_shift_type_id;

  v_qty   := coalesce(v_qty, 0);
  v_gross := round(v_rate * v_qty, 2);

  if v_apply then
    select sc.id, t.total_achieved_pct into v_sc, v_pct
    from vendor_scorecards sc
    join v_scorecard_totals t on t.scorecard_id = sc.id
    where sc.vendor_id = p_vendor_id and sc.period_month = v_month;

    if v_pct is null then
      raise exception 'No scorecard for this vendor/month — run fn_open_month first';
    end if;
    v_net := round(v_gross * least(v_pct, 100) / 100.0, 2);
  else
    v_pct := null;
    v_net := v_gross;
  end if;

  insert into vendor_invoices
    (vendor_id, period_month, shift_type_id, scorecard_id, billing_basis,
     rate_amount, bus_quantity, gross_amount, achieved_pct, net_amount, currency)
  values
    (p_vendor_id, v_month, p_shift_type_id, v_sc, v_basis, v_rate,
     v_qty, v_gross, v_pct, v_net, v_curr)
  on conflict (vendor_id, period_month, shift_type_id) do update set
     scorecard_id  = excluded.scorecard_id,
     billing_basis = excluded.billing_basis,
     rate_amount   = excluded.rate_amount,
     bus_quantity  = excluded.bus_quantity,
     gross_amount  = excluded.gross_amount,
     achieved_pct  = excluded.achieved_pct,
     net_amount    = excluded.net_amount,
     updated_at    = now()
  returning id into v_id;

  return v_id;
end $$;
