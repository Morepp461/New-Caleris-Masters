-- Caleris Masters initial schema. Empty bootstrap by design: no seeded members or teams.
create extension if not exists pgcrypto;

create type public.member_role as enum ('driver','principal','agent','journalist','fia','admin');
create type public.member_status as enum ('active','inactive');
create type public.division_type as enum ('premio','zwei');
create type public.transaction_type as enum ('income','expense');
create type public.loan_status as enum ('active','paid','overdue');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null unique check (season_number >= 0),
  name text not null,
  race_current integer not null default 0 check (race_current >= 0),
  balancing_period integer not null default 0 check (balancing_period >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  role public.member_role not null,
  status public.member_status not null default 'active',
  division public.division_type,
  current_team_id uuid,
  recruitment_team_id uuid,
  opening_balance bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  principal_id uuid references public.member_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.member_profiles
  add constraint member_current_team_fk foreign key (current_team_id) references public.teams(id) on delete set null,
  add constraint member_recruitment_team_fk foreign key (recruitment_team_id) references public.teams(id) on delete set null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete set null,
  transaction_date date not null default current_date,
  direction public.transaction_type not null,
  category text not null,
  description text,
  amount bigint not null check (amount >= 0),
  balancing_period integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (category <> 'Daily Check-in' or (balancing_period is not null and balancing_period > 0))
);

create table public.bank_loans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete set null,
  principal_amount bigint not null check (principal_amount > 0),
  borrowed_at date not null,
  due_at date not null,
  paid_at date,
  status public.loan_status not null default 'active',
  repayment_amount bigint not null default 0 check (repayment_amount >= 0),
  created_at timestamptz not null default now(),
  check (due_at >= borrowed_at)
);

create table public.driver_transfers (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.member_profiles(id) on delete restrict,
  from_team_id uuid not null references public.teams(id) on delete restrict,
  to_team_id uuid not null references public.teams(id) on delete restrict,
  gross_amount bigint not null check (gross_amount >= 0),
  transfer_tax bigint generated always as (case when gross_amount > 50000 then round(gross_amount * 0.10)::bigint else 0 end) stored,
  transferred_at date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  check (from_team_id <> to_team_id)
);

create table public.wealth_tax_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  principal_member_id uuid not null references public.member_profiles(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete set null,
  balancing_period integer not null check (balancing_period > 0),
  principal_balance bigint not null,
  tax_rate numeric(4,3) not null check (tax_rate in (0,0.05,0.10)),
  tax_amount bigint not null check (tax_amount >= 0),
  assessed_at timestamptz not null default now(),
  unique(team_id,season_id,balancing_period)
);

create table public.sponsorship_tracker (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  t3_guaranteed_sponsor_funds boolean not null default false,
  t1_all_drivers_checkin boolean not null default false,
  t2_zero_fines boolean not null default false,
  t4_zero_season_debt boolean not null default false,
  total_reward bigint generated always as (
    (case when t1_all_drivers_checkin then 50000 else 0 end) +
    (case when t2_zero_fines then 40000 else 0 end) +
    (case when t3_guaranteed_sponsor_funds then 30000 else 0 end) +
    (case when t4_zero_season_debt then 10000 else 0 end)
  ) stored,
  unique(team_id,season_id)
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings(key,value) values
  ('bank_opening_capital','0'::jsonb),
  ('wealth_tax_balancing_races','5'::jsonb),
  ('late_loan_interest_daily_rate','0.05'::jsonb),
  ('driver_transfer_tax_threshold','50000'::jsonb),
  ('driver_transfer_tax_rate','0.10'::jsonb)
on conflict (key) do nothing;

create or replace function public.current_member_role()
returns public.member_role language sql stable security definer set search_path = public
as $$ select role from public.member_profiles where user_id = auth.uid() limit 1 $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_member_role() = 'admin',false) $$;

alter table public.seasons enable row level security;
alter table public.member_profiles enable row level security;
alter table public.teams enable row level security;
alter table public.transactions enable row level security;
alter table public.bank_loans enable row level security;
alter table public.driver_transfers enable row level security;
alter table public.wealth_tax_logs enable row level security;
alter table public.sponsorship_tracker enable row level security;
alter table public.system_settings enable row level security;

create policy "authenticated users can read seasons" on public.seasons for select to authenticated using (true);
create policy "authenticated users can read member directory" on public.member_profiles for select to authenticated using (true);
create policy "authenticated users can read teams" on public.teams for select to authenticated using (true);
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage member profiles" on public.member_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage transactions" on public.transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage loans" on public.bank_loans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage transfers" on public.driver_transfers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage wealth tax logs" on public.wealth_tax_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage sponsorship" on public.sponsorship_tracker for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated users read system settings" on public.system_settings for select to authenticated using (true);
create policy "admins manage system settings" on public.system_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- FIA intentionally receives no unrestricted administrator policy.
