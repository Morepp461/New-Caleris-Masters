-- Extend the first-pass model to match the reference ledger's automated deductions,
-- transfer settlement, period-based sponsorship, and bank reconciliation.
alter table public.transactions
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create table public.penalty_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles(id) on delete restrict,
  team_id uuid references public.teams(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete set null,
  balancing_period integer,
  penalty_type text not null check (penalty_type in ('inactive','steward','other')),
  balance_checked bigint,
  amount bigint not null check (amount >= 0),
  description text,
  assessed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (balancing_period is null or balancing_period > 0)
);

alter table public.penalty_logs enable row level security;
create policy "admins manage penalty logs" on public.penalty_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.sponsorship_tracker
  add column if not exists balancing_period integer not null default 1;
alter table public.sponsorship_tracker
  drop constraint if exists sponsorship_tracker_team_id_season_id_key;
alter table public.sponsorship_tracker
  add constraint sponsorship_tracker_team_season_period_key
  unique(team_id,season_id,balancing_period);

-- Authorization helpers must not run with owner privileges. Authenticated users can
-- read the directory row under its SELECT policy; the helper only checks the caller's own role.
create or replace function public.current_member_role()
returns public.member_role
language sql stable security invoker
set search_path = public
as $$ select role from public.member_profiles where user_id = (select auth.uid()) limit 1 $$;

create or replace function public.is_admin()
returns boolean
language sql stable security invoker
set search_path = public
as $$ select coalesce(public.current_member_role() = 'admin',false) $$;

revoke all on function public.current_member_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_member_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

create index if not exists transactions_member_season_idx
  on public.transactions(member_id,season_id);
create index if not exists transactions_team_period_idx
  on public.transactions(team_id,season_id,balancing_period);
create index if not exists penalty_logs_member_season_idx
  on public.penalty_logs(member_id,season_id);
create index if not exists penalty_logs_team_period_idx
  on public.penalty_logs(team_id,season_id,balancing_period);
create index if not exists wealth_tax_logs_principal_season_idx
  on public.wealth_tax_logs(principal_member_id,season_id);
create index if not exists driver_transfers_team_date_idx
  on public.driver_transfers(from_team_id,to_team_id,transferred_at);

create or replace view public.sponsorship_eligibility
with (security_invoker = true)
as
with driver_checkins as (
  select
    tx.team_id,
    tx.season_id,
    tx.balancing_period,
    tx.member_id,
    count(*)::integer as checkin_count
  from public.transactions tx
  where tx.category = 'Daily Check-in'
    and tx.direction = 'income'
    and tx.team_id is not null
    and tx.balancing_period is not null
  group by tx.team_id,tx.season_id,tx.balancing_period,tx.member_id
),
team_driver_checkins as (
  select
    t.id as team_id,
    s.id as season_id,
    st.balancing_period,
    count(mp.id)::integer as driver_count,
    coalesce(bool_and(coalesce(dc.checkin_count,0) >= 5),false) as t1_eligible
  from public.sponsorship_tracker st
  join public.teams t on t.id = st.team_id
  join public.seasons s on s.id = st.season_id
  left join public.member_profiles mp
    on mp.current_team_id = t.id and mp.role = 'driver' and mp.status = 'active'
  left join driver_checkins dc
    on dc.team_id = t.id
    and dc.season_id = s.id
    and dc.balancing_period = st.balancing_period
    and dc.member_id = mp.id
  group by t.id,s.id,st.balancing_period
)
select
  st.team_id,
  st.season_id,
  st.balancing_period,
  coalesce(td.driver_count,0) as driver_count,
  coalesce(td.t1_eligible,false) as t1_eligible,
  not exists (
    select 1 from public.penalty_logs pl
    where pl.team_id = st.team_id
      and pl.season_id = st.season_id
      and pl.balancing_period = st.balancing_period
  ) as t2_eligible,
  st.t3_guaranteed_sponsor_funds as t3_eligible,
  not exists (
    select 1 from public.bank_loans bl
    where bl.team_id = st.team_id
      and bl.season_id = st.season_id
      and bl.status in ('active','overdue')
      and bl.principal_amount > bl.repayment_amount
  ) as t4_eligible,
  (
    case when coalesce(td.t1_eligible,false) then 50000 else 0 end +
    case when not exists (
      select 1 from public.penalty_logs pl
      where pl.team_id = st.team_id
        and pl.season_id = st.season_id
        and pl.balancing_period = st.balancing_period
    ) then 40000 else 0 end +
    case when st.t3_guaranteed_sponsor_funds then 30000 else 0 end +
    case when not exists (
      select 1 from public.bank_loans bl
      where bl.team_id = st.team_id
        and bl.season_id = st.season_id
        and bl.status in ('active','overdue')
        and bl.principal_amount > bl.repayment_amount
    ) then 10000 else 0 end
  )::bigint as total_reward
from public.sponsorship_tracker st
left join team_driver_checkins td
  on td.team_id = st.team_id
  and td.season_id = st.season_id
  and td.balancing_period = st.balancing_period;

create or replace view public.member_balance_summary
with (security_invoker = true)
as
with active_season as (
  select id,race_current from public.seasons where is_active = true limit 1
),
transaction_totals as (
  select
    member_id,
    coalesce(sum(amount) filter (where direction = 'income'),0)::bigint as other_income,
    coalesce(sum(amount) filter (where direction = 'expense'),0)::bigint as transaction_expenses
  from public.transactions
  where season_id = (select id from active_season)
  group by member_id
),
wealth_tax_totals as (
  select principal_member_id as member_id,coalesce(sum(tax_amount),0)::bigint as tax_expenses
  from public.wealth_tax_logs
  where season_id = (select id from active_season)
  group by principal_member_id
),
penalty_totals as (
  select member_id,coalesce(sum(amount),0)::bigint as penalty_expenses
  from public.penalty_logs
  where season_id = (select id from active_season)
  group by member_id
),
transfer_totals as (
  select
    from_team.principal_id as member_id,
    coalesce(sum(dt.gross_amount - dt.transfer_tax),0)::bigint as transfer_income,
    0::bigint as transfer_expenses
  from public.driver_transfers dt
  join public.teams from_team on from_team.id = dt.from_team_id
  group by from_team.principal_id
  union all
  select
    to_team.principal_id as member_id,
    0::bigint as transfer_income,
    coalesce(sum(dt.gross_amount),0)::bigint as transfer_expenses
  from public.driver_transfers dt
  join public.teams to_team on to_team.id = dt.to_team_id
  group by to_team.principal_id
),
transfer_by_member as (
  select member_id,sum(transfer_income)::bigint as transfer_income,
    sum(transfer_expenses)::bigint as transfer_expenses
  from transfer_totals where member_id is not null group by member_id
),
sponsorship_totals as (
  select t.principal_id as member_id,coalesce(sum(se.total_reward),0)::bigint as sponsor_income
  from public.sponsorship_eligibility se
  join public.teams t on t.id = se.team_id
  where se.season_id = (select id from active_season)
  group by t.principal_id
)
select
  m.id as member_id,m.display_name,m.role,m.status,m.division,m.current_team_id,
  m.opening_balance,
  case
    when m.role = 'driver' and m.status = 'active' and m.division = 'premio' then 1000
    when m.role = 'driver' and m.status = 'active' and m.division = 'zwei' then 500
    else 0
  end::bigint as salary_per_race,
  (
    case
      when m.role = 'driver' and m.status = 'active' and m.division = 'premio' then 1000
      when m.role = 'driver' and m.status = 'active' and m.division = 'zwei' then 500
      else 0
    end * coalesce((select race_current from active_season),0)
  )::bigint as accumulated_salary,
  (coalesce(tx.other_income,0)+coalesce(tr.transfer_income,0)+coalesce(sp.sponsor_income,0))::bigint as other_income,
  (coalesce(tx.transaction_expenses,0)+coalesce(wt.tax_expenses,0)+coalesce(pl.penalty_expenses,0)+coalesce(tr.transfer_expenses,0))::bigint as total_expenses,
  (
    m.opening_balance
    + case
        when m.role = 'driver' and m.status = 'active' and m.division = 'premio' then 1000
        when m.role = 'driver' and m.status = 'active' and m.division = 'zwei' then 500
        else 0
      end * coalesce((select race_current from active_season),0)
    + coalesce(tx.other_income,0)
    + coalesce(tr.transfer_income,0)
    + coalesce(sp.sponsor_income,0)
    - coalesce(tx.transaction_expenses,0)
    - coalesce(wt.tax_expenses,0)
    - coalesce(pl.penalty_expenses,0)
    - coalesce(tr.transfer_expenses,0)
  )::bigint as ending_balance
from public.member_profiles m
left join transaction_totals tx on tx.member_id = m.id
left join wealth_tax_totals wt on wt.member_id = m.id
left join penalty_totals pl on pl.member_id = m.id
left join transfer_by_member tr on tr.member_id = m.id
left join sponsorship_totals sp on sp.member_id = m.id
where public.is_admin();

create or replace view public.team_balance_summary
with (security_invoker = true)
as
select
  t.id as team_id,
  t.name as team_name,
  t.principal_id,
  p.display_name as principal_name,
  coalesce(b.ending_balance,0)::bigint as team_balance,
  coalesce((
    select sum(bl.principal_amount - bl.repayment_amount)
    from public.bank_loans bl
    where bl.team_id = t.id and bl.status in ('active','overdue')
  ),0)::bigint as active_bank_debt
from public.teams t
left join public.member_profiles p on p.id = t.principal_id
left join public.member_balance_summary b on b.member_id = t.principal_id
where public.is_admin();

create or replace view public.bank_financial_summary
with (security_invoker = true)
as
with bank_settings as (
  select coalesce((value #>> '{}')::bigint,0) as opening_capital
  from public.system_settings where key = 'bank_opening_capital'
),
loan_outflow as (
  select coalesce(sum(amount),0)::bigint as total
  from public.transactions
  where category = 'Pencairan Pinjaman Bank' and direction = 'income'
),
loan_inflow as (
  select coalesce(sum(amount),0)::bigint as total
  from public.transactions
  where category in ('Cicilan Pinjaman Bank','Bunga Pinjaman') and direction = 'expense'
),
tax_inflow as (
  select coalesce(sum(tax_amount),0)::bigint as total from public.wealth_tax_logs
),
fine_inflow as (
  select coalesce(sum(amount),0)::bigint as total from public.penalty_logs
),
transfer_tax_inflow as (
  select coalesce(sum(transfer_tax),0)::bigint as total from public.driver_transfers
)
select
  coalesce((select opening_capital from bank_settings),0)::bigint as opening_capital,
  (select total from loan_outflow) as loans_disbursed,
  (select total from loan_inflow) as repayments_and_interest,
  (select total from tax_inflow) as wealth_taxes,
  (select total from fine_inflow) as fines,
  (select total from transfer_tax_inflow) as transfer_taxes,
  (
    coalesce((select opening_capital from bank_settings),0)
    - (select total from loan_outflow)
    + (select total from loan_inflow)
    + (select total from tax_inflow)
    + (select total from fine_inflow)
    + (select total from transfer_tax_inflow)
  )::bigint as current_bank_balance
where public.is_admin();

grant select on public.sponsorship_eligibility to authenticated;
grant select on public.member_balance_summary to authenticated;
grant select on public.team_balance_summary to authenticated;
grant select on public.bank_financial_summary to authenticated;
