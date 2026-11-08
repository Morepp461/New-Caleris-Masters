-- Reduce duplicate permissive SELECT policies while retaining admin-only writes.
drop policy if exists "admins manage seasons" on public.seasons;
create policy "admins insert seasons" on public.seasons for insert to authenticated with check (public.is_admin());
create policy "admins update seasons" on public.seasons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete seasons" on public.seasons for delete to authenticated using (public.is_admin());

drop policy if exists "admins manage member profiles" on public.member_profiles;
create policy "admins insert member profiles" on public.member_profiles for insert to authenticated with check (public.is_admin());
create policy "admins update member profiles" on public.member_profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete member profiles" on public.member_profiles for delete to authenticated using (public.is_admin());

drop policy if exists "admins manage teams" on public.teams;
create policy "admins insert teams" on public.teams for insert to authenticated with check (public.is_admin());
create policy "admins update teams" on public.teams for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete teams" on public.teams for delete to authenticated using (public.is_admin());

drop policy if exists "admins manage system settings" on public.system_settings;
create policy "admins insert system settings" on public.system_settings for insert to authenticated with check (public.is_admin());
create policy "admins update system settings" on public.system_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete system settings" on public.system_settings for delete to authenticated using (public.is_admin());

drop policy if exists "admins manage transaction categories" on public.transaction_categories;
create policy "admins insert transaction categories" on public.transaction_categories for insert to authenticated with check (public.is_admin());
create policy "admins update transaction categories" on public.transaction_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete transaction categories" on public.transaction_categories for delete to authenticated using (public.is_admin());

-- Cover foreign keys used by joins, cascades and admin lookups.
create index if not exists teams_principal_id_idx on public.teams(principal_id);
create index if not exists member_profiles_current_team_id_idx on public.member_profiles(current_team_id);
create index if not exists member_profiles_recruitment_team_id_idx on public.member_profiles(recruitment_team_id);
create index if not exists transactions_season_id_idx on public.transactions(season_id);
create index if not exists transactions_created_by_idx on public.transactions(created_by);
create index if not exists bank_loans_team_id_idx on public.bank_loans(team_id);
create index if not exists bank_loans_season_id_idx on public.bank_loans(season_id);
create index if not exists driver_transfers_driver_id_idx on public.driver_transfers(driver_id);
create index if not exists driver_transfers_to_team_id_idx on public.driver_transfers(to_team_id);
create index if not exists driver_transfers_created_by_idx on public.driver_transfers(created_by);
create index if not exists wealth_tax_logs_season_id_idx on public.wealth_tax_logs(season_id);
create index if not exists sponsorship_tracker_season_id_idx on public.sponsorship_tracker(season_id);
create index if not exists penalty_logs_season_id_idx on public.penalty_logs(season_id);
create index if not exists penalty_logs_created_by_idx on public.penalty_logs(created_by);
