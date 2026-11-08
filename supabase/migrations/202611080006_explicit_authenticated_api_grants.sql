-- Explicit Data API grants: access is then narrowed by RLS policies.
grant usage on schema public to authenticated;

grant select,insert,update,delete on table
  public.seasons,
  public.member_profiles,
  public.teams,
  public.transactions,
  public.bank_loans,
  public.driver_transfers,
  public.wealth_tax_logs,
  public.penalty_logs,
  public.sponsorship_tracker,
  public.system_settings,
  public.transaction_categories
to authenticated;

grant select on table
  public.member_balance_summary,
  public.team_balance_summary,
  public.sponsorship_eligibility,
  public.bank_financial_summary
to authenticated;
