# Phase 09 — Attributes, Development & R&D

## Seasonal pricing model
All development pricing is season-scoped and versioned. No global or hard-coded upgrade price exists. Each season has a draft ruleset; prices are explicit transition entries keyed by attribute, from value, to value and token cost. An upgrade is unavailable unless its exact transition is configured in the active season ruleset. A ruleset version used by a posted upgrade is immutable. Price changes require a new version and an audited activation.

## Canonical attributes
Driver and team each have 16 canonical attributes. The valid raw range is 50–200; default starting value is 50 and season rules may configure a starting value within that range. Driver upgrades debit DDP only. Team upgrades and R&D debit TDP only. CP cannot directly upgrade attributes.

## Invariants
- No attribute write outside the development service.
- Attribute update, token debit, immutable token transaction, development history, audit and outbox event commit atomically.
- No negative token balance, duplicate idempotency posting, out-of-range attribute, owner/token mismatch, or unpriced transition.
- Per-period limits, respec policy and R&D catalog are season rules, not code constants.
- Race-engine normalization follows CMRE: N(A) = (A - 50) / 150. This phase stores canonical attributes and provenance; Phase 10 owns full simulation integration and calibration.

## Migration
Additive indexes/validator metadata only. No player/team attribute values, token balances, season prices, projects or active rulesets are seeded. Migration is limited to _dev/_staging databases by default.
