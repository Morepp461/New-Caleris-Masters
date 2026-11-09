# G1 — Phase 01 Acceptance Checklist

This checklist follows the Phase 01 scope and G1 gate in `CALERIS MASTERS Master Development Roadmap Final v1.0`, cross-checked against `Database Schema & Data Dictionary v1.0`.

| Requirement | Evidence / implementation | Status |
|---|---|---|
| Entity and relationship map | `phase-01-architecture.md`, Data Dictionary §2 and §12 | Documented |
| Collection specifications | Data Dictionary §3–11; executable catalog has 63 collections | Documented: five collections lack field-level definitions in the supplied source and remain identifier-only validated; team_achievements is derived from the explicitly equivalent player_achievements schema |
| Immutable IDs and timestamps | Data Dictionary §1.3; migration baseline | Partial: natural-key exceptions and timestamp consistency require per-collection validation |
| Lifecycle and versioning | `phase-01-architecture.md`; Data Dictionary lifecycle/status fields | Documented where specified; unspecified collection states remain open |
| Ownership boundaries | `phase-01-architecture.md`; Data Dictionary §12 and §16 | Documented; backend enforcement is Phase 02+ |
| Index plan | `scripts/db/collections.mjs`; Data Dictionary §14 | Implemented: 44 index definitions, including unique active team membership per player and unique active team contract per driver |
| Critical invariants | `phase-01-architecture.md`, `scripts/db/invariants.mjs` | Documented and tested at database-foundation level; transaction/service enforcement is Phase 02+ |
| Transaction boundaries | `phase-01-architecture.md`; Data Dictionary §15 | Documented; transaction helper implementation is Phase 02 |
| Schema validation baseline | `scripts/db/collections.mjs`, `scripts/db/migrate.mjs` | Implemented: source-derived BSON type/required-field validators cover 58 collections; five source-undocumented collections still enforce UUID and common timestamp fields without invented domain fields |
| Migration strategy | Versioned checksum migration; guarded Development workflow | Pending: migration workflow must complete successfully against Development |
| Development initial state | Development database has no domain documents | Pending post-migration verification |
| Unique ID / referential integrity tests | `tests/database-foundation.test.mjs` | Implemented: reusable referential integrity assertions and automated tests |
| Wallet/ledger invariant tests | Not implemented in Phase 01 foundation | Implemented at database-foundation level: exact integer-safe non-negative balance and balanced ledger invariant assertions with tests; transactional posting integration remains Phase 02 |
| Duplicate event/idempotency tests | Unique index catalog includes idempotency keys | Implemented at database-foundation level: unique idempotency indexes and duplicate-key assertion tests; event handler retry integration remains Phase 02+ |
| Query explain and index coverage | `docs/database/query-plan-baseline.md`, `scripts/db/verify-query-plans.mjs` | 33 pre-migration plans verified as IXSCAN; automated post-migration verification covers 38 query shapes and awaits migrated Development indexes |
| CI / QA | `.github/workflows/ci.yml` | Pending: pull request #4 quality workflow result |
| Atlas migration verification | `.github/workflows/phase-01-dev-migration.yml` | Pending: Atlas role has been updated to `readWrite` + `dbAdmin` on `caleris_masters_dev`; migration history and post-migration validators/indexes still need runtime verification |

## Current verification status

Atlas role update has been verified: `caleris_app` has `readWrite` and `dbAdmin` on `caleris_masters_dev`. The Development workflow consumes the repository secret `MONGODB_URI_DEV`; its value is never printed. The Atlas connector confirms the Development `schema_migrations` collection is still empty, so the migration workflow has not yet been verified as successful.

## Exit criteria

G1 is accepted only when:
- All source-defined collections and constraints are represented and tested.
- No unresolved ambiguity remains for an implemented uniqueness or ownership rule.
- Field-level schema validation covers every collection whose schema is specified by the source.
- Migration has executed successfully on Development and its validators/indexes are verified from the MongoDB driver.
- Referential integrity, wallet/ledger invariant, idempotency, and primary query explain tests have evidence or are explicitly assigned to the next phase where they require service behavior.
- Lint, typecheck, unit/integration tests, build, and secret scan pass on the branch.
- The initial Development state remains free of fictional members, teams, circulating balances, active races, periods, and seasons.

Phase 02 must not begin until G1 approval is recorded.
