-- Keep the driver's current team in sync with the transfer ledger.
create or replace function public.apply_driver_transfer_team_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_team uuid;
begin
  select current_team_id into current_team
  from public.member_profiles
  where id = new.driver_id
  for update;

  if current_team is distinct from new.from_team_id then
    raise exception 'Transfer source team does not match the driver current team';
  end if;

  update public.member_profiles
  set current_team_id = new.to_team_id,
      updated_at = now()
  where id = new.driver_id;

  return new;
end;
$$;

revoke all on function public.apply_driver_transfer_team_change() from public, anon, authenticated;

create trigger driver_transfer_updates_current_team
after insert on public.driver_transfers
for each row execute function public.apply_driver_transfer_team_change();
