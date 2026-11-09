# G1 — Phase 01 Acceptance Checklist

This checklist follows the Phase 01 scope and G1 gate in `CALERIS MASTERS Master Development Roadmap Final v1.0`, cross-checked against `Database Schema & Data Dictionary v1.0`.

| Requirement | Evidence / implementation | Status |
|---|---|---|
| Entity and relationship map | `phase-01-architecture.md`, Data Dictionary §2 and §12 | Documented |
| Collection specifications | Data Dictionary §3–11; executable catalog has 63 collections | Partial: six collection schemas lack field-level definitions in source |
| Immutable IDs and timestamps | Data Dictionary §1.3; migration baseline | Partial: natural-key exceptions and timestamp consistency require per-collection validation |
| Lifecycle and versioning | `phase-01-architecture.md`; Data Dictionary lifecycle/status fields | Documented where specified; unspecified collection states remain open |
| Ownership boundaries | `phase-01-architecture.md`; Data Dictionary §12 and §16 | Documented; backend enforcement is Phase 02+ |
| Index plan | `scripts/db/collections.mjs`; Data Dictionary §14 | Partial until all source-backed index definitions and conditional uniqueness decisions are implemented |
| Critical invariants | `phase-01-architecture.md`; Data Dictionary §13 | Documented; service enforcement is later phase |
| Transaction boundaries | `phase-01-architecture.md`; Data Dictionary §15 | Documented; transaction helper implementation is Phase 02 |
| Schema validation baseline | `scripts/db/collections.mjs`, `scripts/db/migrate.mjs` | Partial: current validator only constrains string _id; field-level validators need source-complete schemas |
| Migration strategy | Versioned checksum migration; guarded Development workflow | Partial: migration has not yet been verified against Atlas in this run |
| Development initial state | Development database has no domain documents | Verified before migration; post-migration verification pending |
| Unique ID / referential integrity tests | `tests/database-foundation.test.mjs` | Partial: catalog assertions exist; reference integrity fixtures/tests remain |
| Wallet/ledger invariant tests | Not implemented in Phase 01 foundation | Pending: service-level arithmetic tests depend on transaction/domain service implementation |
| Duplicate event/idempotency tests | Unique index catalog includes idempotency keys | Partial: DB index only; service-level duplicate-event tests are Phase 02+ |
| Query explain and index coverage | Existing baseline explain checks were limited to players username, ledger idempotency, race event log sequence | Partial: expand to all primary query patterns |
| CI / QA | `.github/workflows/ci.yml` | CI workflow exists; latest branch checks must pass |
| Atlas migration verification | `.github/workflows/phase-01-dev-migration.yml` | Blocked: no schema_migrations record was present in Atlas at last inspection |

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
