# Phase 04 — Player Profile & Role Foundation

Status: implemented on `feat/phase-04-player-profile-role-foundation`.

## Source baseline
Roadmap v1.0 Phase 04 requires public/private player profiles with explicit field visibility, launch roles DRIVER and TEAM_OWNER, separation of account XP/level from driver/team attributes, role history/effective dates, one active role per player, profile summary, privacy settings, and account status. The Data Dictionary defines `players` as permanent identity and `role_assignments` as authoritative role history. FIA and legacy roles are future roles, not selectable at launch.

## Deliverables
- Public profile API: `GET /api/v1/players/:username/profile`.
- Private self-profile API: `GET/PATCH /api/v1/me/profile`.
- Public page: `/players/:username`; account/privacy page: `/profile`.
- Explicit visibility controls for display name, avatar, active role, level, driver name, and driver number.
- Public responses never include account status, XP totals, primary team ID, operator flag, or last login.
- Account XP/level remain on `players`; driver attributes remain separate in `driver_profiles`.
- Role assignment is limited to DRIVER and TEAM_OWNER, writes history/effective dates atomically, and audits operator action.

## Role switch safety
The approved Data Dictionary has no transfer-request or player disciplinary-restriction entity. Mid-season role changes therefore fail closed until transfer, obligation, and disciplinary clearance can be verified. Season-boundary changes require no active team ownership, membership, or contract. Role changes remain operator-approved through the protected existing endpoint; no request collection is invented.

## Migration
`003-player-profile-visibility-and-role-foundation` extends the existing players validator with optional `profile_visibility`, adds a unique role-permission-scope index, seeds only the example profile/public permissions, grants own-profile view/edit to launch roles, creates no collections, and refuses production by default. Run `npm run db:migrate:phase-04` against `caleris_masters_dev`.

## QA
Public/private visibility, inactive account handling, profile update validation, HTTPS-only avatar URLs, launch-role allowlist, role history, one-active-role index, and fail-closed mid-season switching.
