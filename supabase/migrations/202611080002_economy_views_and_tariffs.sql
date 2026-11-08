create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  default_direction public.transaction_type not null,
  standard_amount bigint check (standard_amount is null or standard_amount >= 0),
  is_automatic boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.transaction_categories(code,name,default_direction,standard_amount,is_automatic) values
 ('driver_salary','Gaji Driver','income',null,true),
 ('after_race_poster','Poster After-Race','income',1000,false),
 ('social_poster','Poster Sosmed','income',5000,false),
 ('daily_checkin','Daily Check-in','income',500,false),
 ('season_contribution','Uang Kontribusi Awal Season','income',100000,false),
 ('sponsorship','Sponsorship','income',null,false),
 ('relief_fund','Relief Fund','income',10000,false),
 ('driver_transfer_income','Income Transfer (Jual Driver)','income',null,false),
 ('prize_money','Prize Money','income',50000,false),
 ('bank_loan_disbursement','Pencairan Pinjaman Bank','income',null,false),
 ('team_registration','Registrasi Tim','expense',25000,false),
 ('car_maintenance','Maintenance Mobil','expense',1000,false),
 ('steward_fine','Denda Steward','expense',500,false),
 ('inactive_fine','Denda Inactive','expense',1000,false),
 ('driver_academy','Driver Academy','expense',1500,false),
 ('development_cost','Biaya Pengembangan','expense',1000000,false),
 ('wealth_tax','Pajak Kekayaan','expense',null,false),
 ('driver_transfer_tax','Pajak Transfer Driver','expense',null,false),
 ('wildcard','Wildcard','expense',5000,false),
 ('bank_loan_installment','Cicilan Pinjaman Bank','expense',null,false),
 ('bank_loan_interest','Bunga Pinjaman','expense',null,false),
 ('other','Lainnya','expense',null,false)
on conflict (code) do nothing;

alter table public.transaction_categories enable row level security;
create policy "authenticated users read transaction categories" on public.transaction_categories for select to authenticated using (true);
create policy "admins manage transaction categories" on public.transaction_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create unique index if not exists one_active_season_only
on public.seasons(is_active) where is_active = true;

create or replace view public.member_balance_summary
with (security_invoker = true)
as
with active_season as (
  select id, race_current from public.seasons where is_active = true limit 1
),
transaction_totals as (
  select member_id,
    coalesce(sum(amount) filter (where direction = 'income'),0)::bigint as other_income,
    coalesce(sum(amount) filter (where direction = 'expense'),0)::bigint as total_expenses
  from public.transactions
  where season_id = (select id from active_season)
  group by member_id
)
select
  m.id as member_id,
  m.display_name,
  m.role,
  m.status,
  m.division,
  m.current_team_id,
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
  coalesce(t.other_income,0)::bigint as other_income,
  coalesce(t.total_expenses,0)::bigint as total_expenses,
  (
    m.opening_balance
    + case
        when m.role = 'driver' and m.status = 'active' and m.division = 'premio' then 1000
        when m.role = 'driver' and m.status = 'active' and m.division = 'zwei' then 500
        else 0
      end * coalesce((select race_current from active_season),0)
    + coalesce(t.other_income,0)
    - coalesce(t.total_expenses,0)
  )::bigint as ending_balance
from public.member_profiles m
left join transaction_totals t on t.member_id = m.id
where public.is_admin();

create or replace view public.team_balance_summary
with (security_invoker = true)
as
select
  t.id as team_id,
  t.name as team_name,
  t.principal_id,
  p.display_name as principal_name,
  coalesce(b.ending_balance,0)::bigint as team_balance
from public.teams t
left join public.member_profiles p on p.id = t.principal_id
left join public.member_balance_summary b on b.member_id = t.principal_id
where public.is_admin();

grant select on public.member_balance_summary to authenticated;
grant select on public.team_balance_summary to authenticated;
