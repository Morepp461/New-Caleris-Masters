# Phase 07 — Progression, Quest & Level Engine

Implementation follows the Complete Game Implementation Blueprint v1.0 and Master Development Roadmap Final v1.0.

## Scope
- Quest catalog, assignment, progress, claim, cooldown, expiry, recurrence and eligibility.
- XP event ledger and configurable account-level thresholds.
- Role-aligned Driver and Team Owner quest categories.
- Rewards represented as CP, DDP, TDP, XP and achievement grants.
- Idempotency, duplicate detection, evidence verification, cooldown, caps and anomaly review.
- Operator review of evidence and quest definitions.

## Integrity boundaries
- Account XP is separate from Driver and Team attributes.
- DDP/TDP purchases never grant XP.
- Quest definitions do not grant rewards directly; claims are processed by a server-side service.
- CP reward claims are recorded as pending economy settlement until Phase 08 provides the authoritative double-entry economy ledger. No CP balance is written in Phase 07.
- DDP/TDP reward claims are recorded as pending development-wallet settlement until the approved token wallet service is available. No parallel token balance or ledger is created here.
- Only verified evidence can satisfy quests requiring proof. Social activity is not auto-rewarded without operator verification.
- All date windows use UTC to avoid server-local timezone drift.

## Migration
Migration 006-progression-quest-level updates validators and indexes only. It does not seed invented quest values, level thresholds, reward amounts, cooldowns, or caps. Production migration is blocked by default.
