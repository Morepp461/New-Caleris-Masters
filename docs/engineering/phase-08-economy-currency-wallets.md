# Phase 08 — Economy, Currency & Development Wallets

Implementation basis: Master Development Roadmap Final v1.0, Complete Game Implementation Blueprint v1.0, Master Game Design Document & Technical Specification, and Database Schema & Data Dictionary.

## Implemented scope
- Separate CP player/team/system accounts and immutable ledger transaction headers.
- Double-entry postings with same-currency debit/credit equality.
- Atomic balance-cache updates, immutable ledger entries, non-negative available balances and idempotency keys.
- DDP and TDP wallets remain separate from CP and from one another.
- Operator token grants and approved quest DDP/TDP rewards are recorded as development transactions with actor, reason, source, event, idempotency key and ruleset version. Quest CP rewards post to the double-entry ledger only when quest reward rules are enabled and a funded system account is configured; otherwise the claim remains pending settlement.
- Salary, reward, prize, penalty, tax, fee, transfer fee, inactive penalty, spending cap, limits and maintenance movements use explicit ruleset gates and operator-posted amounts; no undocumented calculation formula is inferred.
- Team loans are issued from a funded system account only when loan rules, eligibility threshold, maximum principal and due days are explicitly configured. Repayment posts through the same ledger. Non-zero interest accrual remains blocked until its calculation policy is approved.
- DDP purchase is available only when an ACTIVE, versioned economy ruleset explicitly enables token purchases and provides approved pricing plus a funded system account. Purchase debits CP and credits DDP in one MongoDB transaction.
- Draft/active versioned economy rulesets, economy periods, close-time reconciliation reports and audit records.
- Operator corrections are posted as new balanced transactions or explicit reversals; existing transactions and entries are never edited.
- Period close stores opening balances, period debits/credits, closing balances by account owner and currency, and blocks close if the ledger-derived balance differs from the cached account projection.
- Development migration adds indexes and validator extensions only. It does not seed money, tokens, pricing, taxes, loans, or active rules.

## Activation and safety
All economic rule groups default to disabled. No historical tariff is activated automatically. The blueprint and GDD explicitly leave several economic decisions for approval, including DDP/TDP purchase prices, salary/contract structure, team spending cap, tax rates, loan rules and sponsor schedules. Those values must be configured and approved by the project operator before the relevant rule group is enabled.

No balance is initialized by migration. A wallet starts at zero. A transfer can only debit a funded source account. Production database migration is blocked by default; the Phase 08 workflow targets caleris_masters_dev only. The guarded rollback script requires an explicit confirmation flag and refuses to run if any economy data exists; once data exists, recovery must use a forward-fix/reconciliation plan.

## Operational API
- GET /api/v1/economy: authenticated wallet/ledger view; operators receive administration data.
- POST /api/v1/economy: operator-only account creation, transfer/adjustment, token grant, ruleset lifecycle, period creation and period closing. PURCHASE_DDP is user-scoped and requires an enabled approved ruleset.
- Every mutation requires same-origin request protection, server-side session authorization, reason where relevant and an idempotency key for postings.

## Verification
Unit coverage validates balanced postings, currency isolation, integer precision, non-negative balances, transfer eligibility, idempotent replay matching, optimistic concurrent debit, ledger/cache reconciliation, transaction rollback and OFF-by-default rules. CI runs lint, typecheck, unit tests, production build and secret scanning. Migration verification asserts all economy collections remain empty after schema/index setup.
