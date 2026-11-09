# Phase 01 — Domain Model & Database Architecture

Status: implementation in progress  
Source of truth: `Database Schema & Data Dictionary v1.0`, `CALERIS MASTERS Master Development Roadmap Final v1.0`, and the approved game technical specification. This document records implementation traceability; it does not override those sources.

## Scope and gate

Phase 01 is the G1 data-foundation gate. It must establish entity relationships, collection specifications, immutable identifiers, lifecycle/versioning, ownership boundaries, indexes/query patterns, invariants, transaction boundaries, schema-validation baseline, migration strategy, and a development seed policy. Phase 02 API/service implementation is explicitly out of scope until G1 is accepted.

## Domain map

| Domain | Collections | Primary relationship / authority |
|---|---|---|
| Identity & authorization | players, auth_accounts, role_assignments, permissions, role_permission_policies, player_sessions | Player is the persistent identity. External provider identity maps to one player. role_assignments is authoritative role history; players.active_role is a projection. |
| Game foundation | game_settings, divisions, seasons, season_rulesets, circuits, circuit_versions | Seasons reference divisions and versioned rulesets. Circuit versions are immutable snapshots used by race events. |
| Players & teams | driver_profiles, teams, team_memberships, team_contracts, team_engines, team_facilities | Driver profile is independent of team membership. Team has a permanent owner and independent identity. Membership and contract history are separate records. |
| Progression & development | account_level_rules, player_xp_events, quests, quest_assignments, quest_progress, quest_claims, development_wallets, development_transactions, development_history | XP and development history are event/ledger records. DDP and TDP wallets are distinct and owner-scoped. |
| Competition & race | race_calendars, race_events, race_entries, race_sessions, race_simulation_inputs, race_states, race_checkpoints, race_event_logs, race_results, race_penalties, championships, championship_standings, season_snapshots | Race events reference season, division, calendar, circuit version, and scoring ruleset. Simulation inputs are frozen. race_event_logs are append-only; race_states are operational projections. |
| Economy | economy_accounts, ledger_transactions, ledger_entries, economy_rulesets, economy_periods, loans | Account balances are controlled by backend services and traceable to balanced ledger postings. |
| Sponsorship | sponsor_entities, sponsor_offers, sponsor_negotiations, sponsor_contracts, sponsor_targets, sponsor_milestones, sponsor_payouts | Accepted negotiations lead to contracts; milestones and payouts must be traceable and idempotent. |
| Achievements & lifetime records | achievement_definitions, player_achievements, team_achievements, lifetime_statistics | Achievement records and lifetime projections derive from historical events. |
| Events & administration | game_events, outbox_events, audit_logs, operator_actions, system_jobs, system_health_logs | Domain events, reliable publication, administrative audit, and operational job/health history. |

The collection catalog currently declares 63 domain collections. The relationship model above follows Data Dictionary sections 2 and 12.

## Identifier and timestamp policy

- Application entity identifiers use UUID v4 represented as strings in MongoDB, unless the data dictionary explicitly defines a natural string key.
- `game_settings._id` is a setting key (example: `game_core`), not an entity UUID.
- `schema_migrations._id` is a migration identifier, not a domain UUID.
- Entity IDs are immutable; relationship references use IDs, never display names.
- Use UTC BSON Date values for timestamps.
- Data Dictionary 1.3 requires `_id`, `created_at`, and `updated_at` for every entity. Collection-specific schemas remain authoritative where the dictionary lists a narrower field set or omits a timestamp.
- Historical records retain creator/source-event metadata where applicable.
- Financial values use integer minor units or Decimal128 consistently; JavaScript floating-point money arithmetic is prohibited.

## Lifecycle, versioning, and retention

- Player account lifecycle: PENDING → ACTIVE; suspension, ban, and deactivation are explicit states. Identity history is retained.
- Role assignment lifecycle: ACTIVE → INACTIVE or REVOKED. Role switching closes the old assignment and creates the new assignment atomically.
- Team lifecycle: PENDING, ACTIVE, SUSPENDED, INACTIVE, DISBANDED. Ownership and membership history are not overwritten.
- Membership lifecycle: PENDING, ACTIVE, ENDED, SUSPENDED. Whether one player may hold multiple active memberships is conditional in the source and remains an explicit decision.
- Contract lifecycle: OFFERED, ACTIVE, COMPLETED, TERMINATED, EXPIRED. A new contract is a new document; historical contracts are preserved.
- Division lifecycle: DRAFT, ACTIVE, INACTIVE, ARCHIVED.
- Season lifecycle: DRAFT, CONFIGURING, ACTIVE, COMPLETED, CANCELLED, ARCHIVED.
- Active season rulesets and circuit versions are immutable snapshots. Amendments create a new version and audit record.
- Race session lifecycle: PENDING, INITIALIZING, RUNNING, PAUSED, RECOVERING, COMPLETED, FAILED, CANCELLED. One active authoritative session may control a race event.
- Finalized race results and financial history are immutable except through audited correction/reversal workflows.
- Retain player identity, role, team ownership, driver contract, race/championship results, economy/development transactions, sponsor negotiation/contracts, achievements, season snapshots, and audit history permanently.
- Temporary race state may be archived only after a configured retention period and only if official results and required recovery records remain available. Never delete financial or competition history because an account/team is inactive.

Retention rules above are source-backed by Data Dictionary sections 3–10, 17 and 18. Exact TTL durations are not specified by the source and must not be invented in Phase 01.

## Ownership and write authority

- Public/client applications are never authoritative writers for protected fields.
- Identity/role assignment, team ownership/membership/contracts, development wallets/attributes, race finalization/classification, championship points, economy balances/ledger, sponsor payout state, and operator actions require dedicated backend/domain authorization.
- The data dictionary explicitly protects player active_role/is_operator/level/xp, economy balances, development balances, driver/team attributes, final race classification, championship points, and sponsor payout status.
- Resource authorization evaluates both permission and ownership/scope.
- This phase documents boundaries only; implementation of API/domain services belongs to Phase 02 and later.

## Critical invariants

1. One persistent player ID represents one player.
2. One provider identity belongs to at most one player.
3. A player has at most one active gameplay role; role_assignments is authoritative.
4. Operator status cannot be granted through public registration or ordinary role selection.
5. A team has one valid owner; IDs are immutable.
6. A player joins a team only through an approved membership.
7. A driver cannot hold conflicting active team contracts.
8. Driver and team development use separate DDP/TDP wallets; token spend and attribute change are atomic; attributes stay within 50–200.
9. Every race belongs to a season/division and uses frozen regulation, circuit, and simulation input versions.
10. A race event has at most one authoritative active simulation session.
11. Finalized results cannot be silently overwritten; championship points trace to official results.
12. Every posted financial transaction balances; unauthorized negative balances are prohibited; idempotency prevents duplicate postings; reversals reference originals.
13. Sponsor payouts are tied to accepted negotiations/contracts and a milestone can be paid only once.
14. Important state changes preserve audit/event history.

## Transaction boundaries

MongoDB multi-document transactions are required for related writes:

- DDP purchase: validate player/balance; debit CP; credit system account and DDP wallet; write transaction and balanced entries; write development transaction; emit event and outbox record.
- Driver attribute upgrade: validate owner/key/range/balance; debit DDP; update attribute; write development history/token ledger; emit event/outbox.
- Role switch: validate identity/role/team/contract/restrictions; close current role assignment; create new assignment; update player active_role; write audit event.
- Race finalization: validate active session/final state; finalize classification; write results; calculate/update championship projections; create reward/penalty/prize events; update lifetime projections; complete session.
- Sponsor payout: validate contract/milestone/completion/idempotency; write economy transaction and ledger postings; write payout; mark milestone paid; emit event.
- Do not keep a database transaction open for the duration of a live race. Persist checkpoints/state independently and use a controlled transaction for finalization.

## Index and query-plan coverage

The code catalog is the executable index definition. Source-backed requirements include unique player username; unique provider identity; role assignment lookup and one active role; unique permission key; unique division code and name; unique season number; unique driver profile per player; team owner/status; membership/contract lookups; quest assignment/claim; unique development wallet owner/token; race calendar/event/session/entry/log/result lookups; standings; unique economy account and idempotency keys; ledger postings; sponsorship lookups; outbox and audit lookups.

Required query-plan coverage is tracked separately in the G1 acceptance checklist. Explain plans must be captured for actual indexed query shapes, not inferred from index existence.

## Migration and environment policy

- Migration runner is versioned, checksum-protected, and idempotent.
- Development database is `caleris_masters_dev`; staging and production are separate environments.
- The runner must refuse production unless a separately approved explicit production invocation is supplied.
- Production data is never seeded with fictional members, teams, balances, races, or seasons.
- Development initialization follows the Data Dictionary initial-state rules: zero player accounts, zero teams, zero race sessions/results, zero circulating CP and DDP/TDP balances, no active season or race calendar. The dictionary's proposed two divisions are configuration records only and are not player/team seed data.
- Rollback/recovery for additive collection/index/validator migrations is documented. Destructive index changes require review and verified backup/recovery before execution.

## Source gaps / approval blockers

These are intentionally not guessed:

1. Team membership exclusivity is conditional: the dictionary says a player may not have two active team memberships **if** game rules prohibit it. It does not settle whether active membership is globally exclusive or scoped by membership_role/team.
2. Active contract overlap needs a precise rule: the dictionary prohibits conflicting active contracts but does not define the conflict key or date-overlap semantics.
3. TTL durations for operational race state are configurable but unspecified.
4. Six collection schemas are listed in the collection map without a complete field-level specification in the dictionary: `team_facilities`, `economy_periods`, `sponsor_milestones`, `operator_actions`, `system_jobs`, and `system_health_logs`. These must remain baseline-validated until their exact fields/owners/lifecycles are approved.
5. The dictionary states `game_settings._id` is a natural string key; it must not be validated as an entity UUID.

G1 cannot be marked complete while an approval blocker affects a uniqueness rule or an authoritative collection contract.
