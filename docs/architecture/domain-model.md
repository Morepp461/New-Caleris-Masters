# Domain model and MongoDB collection catalog

**Source:** Database Schema & Data Dictionary v1.0, sections 1–12 and 19–20.  
**Identifier convention:** UUID string in `_id`; references use immutable IDs.  
**No seed data:** collection creation does not create players, teams, accounts, balances, seasons, or races.

| Domain | Collection | Responsibility |
|---|---|---|
| Identity | players | Permanent player identity |
| Identity | auth_accounts | Discord/Google provider identity links |
| Identity | role_assignments | Current and historical gameplay role assignments |
| Identity | permissions | Permission definitions |
| Identity | role_permission_policies | Role-to-permission policy |
| Identity | player_sessions | Player session records |
| Foundation | game_settings | Global game configuration |
| Foundation | divisions | Configurable competition divisions |
| Foundation | seasons | Season records |
| Foundation | season_rulesets | Versioned season regulations |
| Foundation | circuits | Circuit and track definitions |
| Foundation | circuit_versions | Versioned circuit configurations |
| Players & teams | driver_profiles | Driver-specific profile |
| Players & teams | teams | Team identity and configuration |
| Players & teams | team_memberships | Player-team relationships |
| Players & teams | team_contracts | Driver employment and contracts |
| Players & teams | team_engines | Team engine ownership/specification |
| Players & teams | team_facilities | Future facilities progression |
| Progression | account_level_rules | Level progression configuration |
| Progression | player_xp_events | XP history |
| Progression | quests | Quest definitions |
| Progression | quest_assignments | Player/team quest assignments |
| Progression | quest_progress | Quest completion progress |
| Progression | quest_claims | Reward claim history |
| Development | development_wallets | Separate DDP/TDP wallets |
| Development | development_transactions | Immutable DDP/TDP ledger |
| Development | development_history | Attribute development history |
| Competition | race_calendars | Season race schedules |
| Competition | race_events | Individual race events |
| Competition | race_entries | Official race participation |
| Race engine | race_sessions | Simulation sessions |
| Race engine | race_simulation_inputs | Frozen simulation inputs |
| Race engine | race_states | Current operational race state |
| Race engine | race_checkpoints | Recovery checkpoints |
| Race engine | race_event_logs | Append-only race event history |
| Competition | race_results | Finalized race classifications |
| Competition | race_penalties | Steward/race penalties |
| Competition | championships | Championship definitions |
| Competition | championship_standings | Season standings |
| Competition | season_snapshots | Final season records |
| Economy | economy_accounts | Current monetary balances |
| Economy | ledger_transactions | Transaction headers |
| Economy | ledger_entries | Double-entry postings |
| Economy | economy_rulesets | Versioned economic rules |
| Economy | economy_periods | Economic settlement periods |
| Economy | loans | Team loans and repayments |
| Sponsorship | sponsor_entities | Fictional sponsor pool |
| Sponsorship | sponsor_offers | Initial sponsor offers |
| Sponsorship | sponsor_negotiations | Negotiation history |
| Sponsorship | sponsor_contracts | Accepted sponsor contracts |
| Sponsorship | sponsor_targets | Contractual performance targets |
| Sponsorship | sponsor_milestones | Target completion records |
| Sponsorship | sponsor_payouts | Sponsor payment history |
| Achievements | achievement_definitions | Achievement catalog |
| Achievements | player_achievements | Player achievement records |
| Achievements | team_achievements | Team achievement records |
| Achievements | lifetime_statistics | Lifetime aggregated statistics |
| Governance | game_events | Domain events |
| Governance | outbox_events | Reliable event publication queue |
| Governance | audit_logs | Administrative audit trail |
| Governance | operator_actions | Operator operation history |
| Operations | system_jobs | Scheduled task tracking |
| Operations | system_health_logs | Service/processing diagnostics |

## Logical ownership and relationships

- Player owns provider links, role assignments, driver profile, XP history, quest assignments, economy account, and player achievements.
- Team has a player owner and owns memberships, contracts, team engine/facility records, TDP wallet, economy account, sponsorship contracts, race entries/results, and team achievements.
- Season owns division participation, ruleset snapshots, race calendars/events, championships, sponsor contracts, and season snapshots.
- Race event owns entries, race sessions, and finalized results. A session owns frozen inputs, live state, checkpoints, and ordered event logs.
- Economy account owns ledger postings through ledger transaction headers.
- Sponsor offer progresses through negotiations into a sponsor contract, targets, milestones, and payouts.

## Open model decision

A separate `role_history` collection appears in some roadmap/blueprint passages, but the data dictionary defines `role_assignments` as authoritative role history. This implementation uses only `role_assignments` until a versioned decision defines a separate schema.
