# Phase 05 — Teams, Membership & Contracts

## Approved rules
- Two driver roster slots per team, stored as a versioned game setting.
- Registration fee: Premio ¢p25,000; Zwei ¢p15,000.
- Driver contract: salary per season, duration, optional objective and optional objective bonus.
- Salary is negotiated by driver and team owner; backend enforces the configured minimum for the driver license tier from the active economy ruleset. Missing tier configuration fails closed. Historical figures are not silently activated.
- Driver transfers are negotiated directly by the two parties, submitted to operator review after both confirmations, and may be approved, approved with conditions, or rejected.
- Team ownership transfer changes only owner identity and ownership history. Team ID, attributes/R&D, facilities/HQ, roster, contracts, engine and competition records remain attached to the team. Team identity edits by the incoming owner are locked until the next season if transfer occurs mid-season.

## Data and safety
- Existing team, membership and contract collections remain canonical.
- Added team_transfer_requests and team_ownership_history; no historic records are overwritten.
- Private operations enforce session role and resource ownership. Operator-only transfer review is separate from FIA/gameplay roles.
- Contract overlap and roster cap are checked transactionally and backed by existing unique indexes.
- Registration fee debit/credit must be a balanced ledger transaction. No arbitrary treasury funding is seeded.
- Division CRUD remains Phase 06. Registration requires an existing eligible division; empty divisions correctly prevent registration.

## Migration
Run npm run db:migrate:phase-05 against a _dev database first. Production is blocked by default.
