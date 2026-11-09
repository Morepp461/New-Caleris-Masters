# MongoDB index plan

**Source:** Database Schema & Data Dictionary v1.0, collection-specific index notes and section 14.  
All compound key order follows the source. Index names are deterministic. Indexes not explicitly specified by the source are not added.

| Collection | Keys | Unique | Additional rule |
|---|---|---:|---|
| players | username | Yes | |
| players | active_role | No | |
| players | account_status | No | |
| players | primary_team_id | No | |
| auth_accounts | provider, provider_user_id | Yes | |
| auth_accounts | player_id | No | |
| role_assignments | player_id, status | No | |
| role_assignments | player_id | Yes | Partial: status = ACTIVE |
| permissions | key | Yes | |
| divisions | code | Yes | |
| seasons | season_number | Yes | |
| driver_profiles | player_id | Yes | |
| teams | owner_player_id, status | No | |
| team_memberships | player_id, status | No | |
| team_memberships | team_id, status | No | |
| team_contracts | driver_player_id, status | No | |
| team_contracts | team_id, status | No | |
| quest_assignments | target_type, target_id, status | No | |
| quest_claims | assignment_id | Yes | |
| development_wallets | owner_type, owner_id, token_type | Yes | |
| development_transactions | wallet_id, created_at | No | |
| race_events | season_id, division_id, round_number | No | |
| race_events | status, scheduled_start_at | No | |
| race_entries | race_event_id, driver_profile_id | Yes | |
| race_sessions | race_event_id | Yes | Partial: PENDING, INITIALIZING, RUNNING, PAUSED, RECOVERING |
| race_event_logs | race_session_id, sequence_number | Yes | |
| race_results | race_event_id, driver_id | Yes | |
| championship_standings | championship_id, rank | No | |
| economy_accounts | owner_type, owner_id, currency | Yes | |
| ledger_transactions | idempotency_key | Yes | |
| ledger_entries | transaction_id | No | |
| ledger_entries | account_id, created_at | No | |
| sponsor_offers | team_id, status | No | |
| sponsor_negotiations | offer_id | No | |
| sponsor_contracts | team_id, status | No | |
| sponsor_payouts | contract_id, status | No | |
| game_events | idempotency_key | Yes | |
| outbox_events | status, next_attempt_at | No | |
| audit_logs | target_type, target_id, created_at | No | |

## Deliberately deferred
- Active team-membership uniqueness is conditional in the data dictionary ("if game rules prohibit it"), so it is not enforced yet.
- Contract-overlap uniqueness requires the approved contract lifecycle and overlap semantics; application validation is still required.
- TTL/retention indexes are not created because the source does not specify retention durations.
- Race-session partial uniqueness uses the exact active statuses listed in the data dictionary.
- No additional indexes are guessed from UI assumptions.
