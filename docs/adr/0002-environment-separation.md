# ADR 0002: Environment and database separation

- Status: Accepted baseline
- Date: 2026-11-09
- Sources: Master Development Roadmap v1.0; Complete Game & Implementation Blueprint v1.0

## Decision
- Local development uses `caleris_masters_dev`.
- Preview/staging must use a non-production database, isolated from production.
- Production uses `caleris_masters`.
- Secrets are supplied through environment secret managers and never committed.
- A migration command refuses to target production unless an explicit operator flag is supplied; production migration is not part of this phase.

## Current constraint
Vercel's current production MongoDB URI is a blank sensitive placeholder. No Preview-scoped MongoDB URI is available. The landing page remains buildable without database credentials; database-backed routes must not be enabled until credentials are configured.
