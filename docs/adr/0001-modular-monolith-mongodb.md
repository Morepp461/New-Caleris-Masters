# ADR 0001: Modular monolith with MongoDB Atlas

- Status: Accepted baseline
- Date: 2026-11-09
- Sources: Complete Game & Implementation Blueprint v1.0; Master Development Roadmap v1.0; Database Schema & Data Dictionary v1.0

## Context
The product requires persistent identity, game configuration, teams, contracts, progression, economy, competition, race simulation, sponsorship, and audit history. The roadmap explicitly calls for a modular monolith first, API-first behavior, and server-authoritative business rules.

## Decision
- Keep one Next.js / TypeScript application codebase with domain boundaries.
- Use MongoDB Atlas as the primary data store.
- Use the official MongoDB Node.js driver; do not add an ODM at this stage.
- Use Railway or a suitable persistent host for long-running race worker processes in the later race-engine phases.
- Keep business rules server-side; browser clients do not write protected game state directly.

## Consequences
- Domain modules and repository boundaries must be explicit as backend work begins.
- Multi-document financial and lifecycle operations require MongoDB transactions and idempotency.
- Do not introduce microservices until measured operational needs justify them.
