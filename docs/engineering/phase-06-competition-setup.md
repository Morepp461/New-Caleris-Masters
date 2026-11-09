# Phase 06 — Divisions, Seasons & Competition Setup

## Scope
Implements dynamic divisions, season lifecycle, immutable versioned season/division rulesets, calendars, race event lifecycle, championship definitions, entry registration, and an operator configuration surface.

## Lifecycle decision
The roadmap lifecycle is canonical for application workflows: `PLANNED → REGISTRATION → ACTIVE → COMPLETED → ARCHIVED`, with `CANCELLED` available before activation. The Database Schema v1.0 labels `DRAFT` and `CONFIGURING`; these are treated as legacy setup aliases for `PLANNED` at the application boundary. `REGISTRATION` remains explicit because the Phase 05 team-registration API already consumes that state.

Race events follow the roadmap: `SCHEDULED → REGISTRATION_LOCKED → READY → RUNNING → COMPLETED → REVIEWED`; eligible pre-running states may transition to `CANCELLED`.

## Ruleset guarantees
- Rulesets are scoped to one season and one division.
- Scoring, calendar, penalties, race, economy and eligibility rules are required objects.
- Points and bonuses are configurable; no F1 scoring default is injected.
- A locked/active ruleset is never updated in place. An amendment creates a new version and audit record.
- Season activation requires an approved locked ruleset and calendar for each participating division.
- Race events reference the selected ruleset and circuit version.

## Initial world state
The Phase 06 development migration idempotently seeds only the two documented initial divisions, Caleris Premio and Caleris Zwei. It does not create players, teams, seasons, calendars, race events, entries, or championships. Season remains 0 until an operator creates one.

## Database safety
Migration `005-divisions-seasons-competition` is checksum-protected and refuses non-`_dev`/`_staging` databases unless an explicit production flag is supplied. No production migration is part of this phase.
