# MongoDB Query Plan Baseline — G1

Database: `caleris_masters_dev`  
Cluster: `New-Caleris-Masters`  
Method: MongoDB `explain(find)`, verbosity `queryPlanner`, limit 5  
Dataset at inspection: empty domain collections.

All 33 query shapes inspected directly against the pre-migration Development database selected an `IXSCAN` winning plan (with FETCH/LIMIT as applicable). A repeatable post-migration verifier now covers 38 patterns, including the new unique division-name, race-round, and achievement indexes. This confirms index selection for the documented predicates. It does not claim latency/performance characteristics; the database is empty and executionStats/load testing belongs to later QA.

| Collection | Query shape | Selected index | Result |
|---|---|---|---|
| players | username | uq_players_username | IXSCAN |
| auth_accounts | provider + provider_user_id | uq_auth_provider_identity | IXSCAN |
| role_assignments | player_id + status | ix_role_assignments_player_status | IXSCAN |
| divisions | code | uq_divisions_code | IXSCAN |
| divisions | name | uq_divisions_name | Pending post-migration verifier |
| seasons | season_number | uq_seasons_number | IXSCAN |
| driver_profiles | player_id | uq_driver_profiles_player | IXSCAN |
| teams | owner_player_id + status | ix_teams_owner_status | IXSCAN |
| team_memberships | player_id + status | ix_team_memberships_player_status | IXSCAN |
| team_memberships | team_id + status | ix_team_memberships_team_status | IXSCAN |
| team_contracts | driver_player_id + status | ix_team_contracts_driver_status | IXSCAN |
| team_contracts | team_id + status | ix_team_contracts_team_status | IXSCAN |
| quest_assignments | target_type + target_id + status | ix_quest_assignments_target_status | IXSCAN |
| quest_claims | assignment_id | uq_quest_claims_assignment | IXSCAN |
| development_wallets | owner_type + owner_id + token_type | uq_development_wallet_owner_token | IXSCAN |
| development_transactions | wallet_id + created_at | ix_development_transactions_wallet_created | IXSCAN |
| race_events | season_id + division_id + round_number | ix_race_events_season_division_round (legacy name before migration) | IXSCAN; post-migration target: uq_race_events_season_division_round |
| race_events | status + scheduled_start_at | ix_race_events_status_schedule | IXSCAN |
| race_entries | race_event_id + driver_profile_id | uq_race_entries_event_driver_profile | IXSCAN |
| race_sessions | race_event_id + active status | uq_race_sessions_active_event | IXSCAN |
| race_event_logs | race_session_id + sequence_number | uq_race_event_logs_session_sequence | IXSCAN |
| race_results | race_event_id + driver_id | uq_race_results_event_driver | IXSCAN |
| championship_standings | championship_id + rank | ix_standings_championship_rank | IXSCAN |
| economy_accounts | owner_type + owner_id + currency | uq_economy_account_owner_currency | IXSCAN |
| ledger_transactions | idempotency_key | uq_ledger_transactions_idempotency | IXSCAN |
| ledger_entries | transaction_id | ix_ledger_entries_transaction | IXSCAN |
| ledger_entries | account_id + created_at | ix_ledger_entries_account_created | IXSCAN |
| sponsor_offers | team_id + status | ix_sponsor_offers_team_status | IXSCAN |
| sponsor_negotiations | offer_id | ix_sponsor_negotiations_offer | IXSCAN |
| sponsor_contracts | team_id + status | ix_sponsor_contracts_team_status | IXSCAN |
| sponsor_payouts | contract_id + status | ix_sponsor_payouts_contract_status | IXSCAN |
| game_events | idempotency_key | uq_game_events_idempotency | IXSCAN |
| outbox_events | status + next_attempt_at | ix_outbox_events_status_attempt | IXSCAN |
| audit_logs | target_type + target_id + created_at | ix_audit_logs_target_created | IXSCAN |
| player_achievements | player_id + achievement_id | uq_player_achievements_player_achievement | Pending post-migration verifier |
| team_achievements | team_id + achievement_id | uq_team_achievements_team_achievement | Pending post-migration verifier |

## Migration reconciliation

The source dictionary defines the race-event round key as unique for `season_id + division_id + round_number`. The pre-existing bootstrap index was non-unique and named `ix_race_events_season_division_round`. The Phase 01 migration retires that legacy index and creates `uq_race_events_season_division_round` with `unique: true`.

The migration also adds the source-required unique `divisions.name` index. The query plan above records the pre-migration database state; the workflow verifies the post-migration index options using the MongoDB driver.


| team_memberships | player_id + ACTIVE | uq_team_memberships_active_player | Pending post-migration verifier |
| team_contracts | driver_player_id + ACTIVE | uq_team_contracts_active_driver | Pending post-migration verifier |

## Repeatable verification

Run `npm run db:verify-query-plans` after the Development migration. The script reads `scripts/db/query-plan-catalog.mjs` and asserts that every one of the 36 primary query patterns selects its expected index. The Phase 01 GitHub Actions workflow runs this command automatically after migration.
