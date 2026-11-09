# ADR 0003: Explicit, versioned MongoDB migrations

- Status: Accepted baseline
- Date: 2026-11-09
- Sources: Master Development Roadmap v1.0; Database Schema & Data Dictionary v1.0

## Decision
- Store migration records in `schema_migrations`.
- Each migration has an immutable version identifier and checksum.
- Migrations check preconditions, apply idempotent collection/index/validator changes, then record the postcondition.
- Migration commands are never executed automatically by build or deployment.
- Production migrations require an explicit operator decision and a separate recovery plan.
- No legacy workbook or ledger import is performed by initialization migrations.

## Recovery
Prefer forward-fix for additive changes. Destructive or data-transforming migrations require a backup, dry-run, reconciliation report, and a separately reviewed rollback/restore plan.
