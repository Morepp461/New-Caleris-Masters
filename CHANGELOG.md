# Changelog

All notable project changes are recorded here. This file tracks repository changes; game rules and data-model decisions are versioned separately.

## [Unreleased]

### Added
- Phase 00 engineering baseline: Node 24 runtime pin, CI checks, PR template, CODEOWNERS, and environment guidance.
- Phase 01 domain collection catalog, index plan, database invariants, MongoDB connection lifecycle, and guarded migration runner.
- Development-only database bootstrap for the 63 collections defined in Database Schema & Data Dictionary v1.0.

### Changed
- Local environment template now defaults to `caleris_masters_dev` to reduce accidental writes to production.
- Added the official MongoDB Node.js driver 7.8.0. This version includes the current driver security fixes and supports MongoDB 8.0 / Node 24.

### Not changed
- Existing production database, Admin user, Admin sessions, production secrets, and existing public landing page.
- No player, team, balance, season, period, or race seed data was created.
