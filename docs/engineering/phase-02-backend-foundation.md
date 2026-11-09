# Phase 02 — Backend Foundation & API

Status: implementation branch. Source of truth: CALERIS MASTERS Master Development Roadmap Final v1.0 (Phase 02), Database Schema & Data Dictionary v1.0 (sections 1, 11, 13, 15), and accepted Phase 00–01 ADRs.

## Architecture

Keep the accepted modular monolith: Next.js App Router + TypeScript + official MongoDB Node.js driver. Transport handlers are thin. Domain/application code does not depend on Next.js request objects. Infrastructure owns MongoDB and event persistence. No ODM, new service, or new collection is introduced.

## Implemented foundations

- Standard success/error response envelope and error taxonomy.
- Request correlation IDs and request IDs.
- Runtime validation primitives and allowlisted filtering/sorting helpers.
- MongoDB transaction helper using snapshot reads, majority writes, bounded transient-transaction retry, and explicit unknown-commit handling.
- Domain event and outbox writes in the same transaction, matching Data Dictionary section 11.
- Job runner abstraction with claim/complete/retry/fail storage port.
- Pagination contract and bounded query parameters.
- Rate-limit adapter with process-local implementation.
- Structured JSON logging with sensitive-key redaction.
- Runtime configuration loader with environment/database guardrails.
- Liveness/readiness endpoints and OpenAPI document for implemented endpoints.

## API conventions

- Base path: /api/v1.
- Success: { success: true, data, meta: { correlationId, requestId } }.
- Error: { success: false, error: { code, message, details? }, meta }.
- x-correlation-id is accepted only as UUID v4; otherwise the server creates one.
- Pagination uses limit, opaque cursor, sort, and direction. Every endpoint must allowlist its filter and sort fields.
- Idempotent state-changing operations require Idempotency-Key and must persist game_events and outbox_events in the same MongoDB transaction as the state change. The source-defined unique game_events.idempotency_key index is the duplicate guard.

## Source-bound limitations

- The supplied Data Dictionary lists system_jobs but does not define its document fields. The job runner therefore exposes a storage port instead of inventing a MongoDB document shape.
- The supplied source does not define distributed rate-limit storage/provider schema. The process-local adapter is best-effort for local/single-instance use only and is not distributed protection on Vercel. Production-wide enforcement requires an approved shared adapter.
- caleris_masters_dev is the only database permitted for development migration and testing. Production migration is not part of this phase.
- Vercel Preview database credentials are not available in the accepted ADR baseline. Liveness remains available without database credentials; readiness returns 503 until a database URI is configured.

## Validation

npm run lint
npm run typecheck
npm test
npm run build

## Non-goals

No authentication implementation, Discord OAuth, player provisioning, role assignment UI, gameplay use cases, economy posting, race simulation, worker deployment, or production database migration.
