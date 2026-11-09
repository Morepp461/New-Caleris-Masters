# Database and domain invariants

**Source:** Database Schema & Data Dictionary v1.0, section 13; Master Development Roadmap v1.0, sections 2 and 7.

## Identity
1. One player ID represents one persistent player.
2. One external provider identity belongs to only one player.
3. A player has at most one active gameplay role.
4. Operator status is not granted through public registration.
5. Provider email is not a permanent player identifier.

## Teams and contracts
1. Team IDs are immutable and each team has one valid owner.
2. A player cannot join without an approved membership.
3. Conflicting active driver contracts are prohibited.
4. A team must belong to a valid division.
5. Historical contracts are preserved; a new contract creates a new record.

## Development
1. Driver development spends DDP; team development spends TDP.
2. ¢p cannot directly upgrade attributes.
3. DDP cannot be spent by a team; TDP cannot be spent by a driver.
4. Attribute values remain within 50–200.
5. Token spending and attribute changes are atomic.

## Competition and race
1. Every race belongs to a season and division.
2. Each race uses a frozen regulation version and frozen simulation input snapshot.
3. Only one active authoritative simulation session controls a race event.
4. Finalized results are not silently overwritten.
5. Championship points are traceable to finalized results.

## Economy
1. Every monetary balance has ledger history.
2. Every posted transaction balances: total debit equals total credit per currency.
3. No unauthorized negative balance.
4. Idempotent requests cannot create duplicate postings.
5. Reversals reference original transactions.
6. Financial corrections preserve historical audit records.
7. Money uses Decimal128 or integer minor units; JavaScript floating point is not used for money.

## Sponsorship
1. Contracts reference accepted negotiations.
2. Counter-offer limits are enforced.
3. Sponsor budget cannot be exceeded.
4. Targets belong to their contract.
5. A milestone is paid at most once.
6. Sponsor payments link to ledger transactions.

## Enforcement boundary
These invariants are domain requirements, not all database-level guarantees. Database indexes enforce only the uniqueness rules explicitly documented in the index plan. Cross-document rules require server-side domain services and MongoDB transactions in later phases.
