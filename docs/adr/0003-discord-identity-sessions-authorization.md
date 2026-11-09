# ADR-0003: Discord Identity, Sessions, and Authorization

- Status: Accepted for Phase 03 implementation
- Date: 2026-11-09
- Scope: identity binding, Discord OAuth login, server sessions, role resolution, permission checks, operator provisioning, and authentication security audit.
- Supersedes: none

## Context

The accepted architecture is a Next.js App Router modular monolith using the official MongoDB Node.js driver. Phase 01 already provisions `players`, `auth_accounts`, `role_assignments`, `permissions`, `role_permission_policies`, `player_sessions`, and `audit_logs`.

The current Data Dictionary defines fields for `players`, `auth_accounts`, role collections, and `audit_logs`. It does not define a field-level document schema for `player_sessions`. No separate `security_events` collection is approved or needed.

The product source requires Discord OAuth, a distinct permanent player/member identity, session-backed identity, server-side authorization, and an operator-controlled registration/role association. A Discord account is not itself a player record and must not gain a game role by self-registration.

## Decisions

### 1. Identity separation and account linking

- `players._id` remains the canonical player identity.
- `auth_accounts` remains the provider identity mapping. Discord mappings use `provider: "discord"` and the immutable Discord user ID in `provider_user_id`. On successful login, store the latest `provider_username` and `provider_avatar_url` as provider profile metadata on that mapping; these are display metadata only, never identity keys. The existing field catalog requires `provider_email`, so the OAuth consent requests the `email` scope and the link is rejected if Discord does not return a verified email.
- A successful Discord OAuth response may authenticate only when a matching, pre-provisioned `auth_accounts` record exists and its `player_id` resolves to an active player.
- OAuth login must never create a player, member ID, team, role assignment, or game balance.
- Unlinked Discord identities receive a neutral account-not-provisioned response. No automatic linking by username, display name, or email is allowed.
- The unique provider identity index remains the concurrency guard against duplicate Discord links.

### 2. Session document extension

Use the existing `player_sessions` collection; do not create a new collection.

Every session document uses UUID v4 `_id` and includes:

| Field | Type | Meaning |
|---|---|---|
| `player_id` | string | Canonical `players._id` |
| `auth_account_id` | string | Linked `auth_accounts._id` |
| `provider` | string | `discord` |
| `provider_user_id` | string | Discord immutable user ID |
| `session_token_hash` | string | SHA-256 hash of the opaque cookie token; raw token is never persisted |
| `status` | string | `ACTIVE` or `REVOKED` |
| `issued_at` | date | Session creation time |
| `expires_at` | date | Absolute expiry |
| `last_seen_at` | date | Last successful session validation |
| `revoked_at` | date or null | Revocation time |
| `revocation_reason` | string or null | Controlled reason code |
| `ip_hash` | string or null | One-way hash for security correlation |
| `user_agent_hash` | string or null | One-way hash for security correlation |
| `created_at` | date | Record creation |
| `updated_at` | date | Last record update |

Session tokens are generated from cryptographically secure random bytes. The browser receives only the opaque token in an HttpOnly cookie. Database lookup uses its SHA-256 hash. The cookie is Secure in production, HttpOnly, SameSite=Lax, Path=/, and uses the host-only `__Host-` prefix in production. Session duration is seven days absolute. Expired and revoked sessions are rejected even if the cookie remains present.

Do not add a TTL index: expired/revoked records are retained for security review and explicit retention policy has not yet been approved.

### 3. Session lifecycle

- OAuth state is random, short-lived, one-use, and verified on callback.
- Callback consumes the state cookie before completing login.
- Successful login creates a new session; it does not silently revive an old session.
- Logout revokes the current session server-side before clearing the cookie.
- Session validation reloads player status and active role assignment from MongoDB. Role/permission data is never trusted from browser storage or cookie claims.
- A player that is inactive, suspended, missing, or no longer linked cannot establish or continue a session.

### 4. Role and permission authority

- `players.is_operator` is the system-owner/operator authority flag. It is read only from MongoDB on the server.
- Normal game roles are resolved from active `role_assignments`; `players.active_role` is the currently selected active role, not proof of authorization by itself.
- `role_permission_policies` and `permissions` are the policy source for normal roles. Missing, disabled, or ambiguous policy means deny.
- FIA remains competition authority only and is never treated as system operator.
- No role is granted from Discord guild membership, Discord username, OAuth scopes, or client-submitted values.
- UI visibility is not an authorization boundary. Every protected server operation must call the centralized permission service.

### 5. Operator provisioning

- Only an authenticated player whose persisted `is_operator` is true may provision or revoke a Discord identity link.
- Provisioning links an existing player to an existing Discord user ID. It does not create a player or assign a role.
- Discord identity must be obtained from a verified provider callback or entered through a controlled operator workflow. No client can self-assign `player_id`, role, or operator status.
- The unique provider identity index and transaction boundary prevent duplicate account linking.
- Every provisioning/revocation operation writes an `audit_logs` record in the same MongoDB transaction as the account change.

### 6. Security audit events

Use the existing `audit_logs` collection, not a new collection. Use the already-defined fields:

- `actor_type`: `PLAYER`, `OPERATOR`, or `SYSTEM`
- `actor_id`: player ID when known; otherwise omitted
- `action`: controlled authentication/identity event code
- `target_type`: `AUTH_ACCOUNT`, `PLAYER_SESSION`, or `AUTHENTICATION`
- `target_id`: relevant record ID; for an unauthenticated event use the request correlation ID
- `reason`: non-sensitive outcome/reason code
- `ip_hash`: one-way hash when available
- `created_at`: event time

Never log OAuth authorization codes, access/refresh tokens, raw session tokens, client secrets, full cookie headers, or unredacted provider payloads. Audit failures must not turn a failed authentication into a successful one.

### 7. MongoDB indexes and migration

Add a versioned migration for the existing development/staging database only:

- Unique index on `player_sessions.session_token_hash`.
- Lookup index on `player_sessions.player_id, status, expires_at`.
- Index on `audit_logs.action, created_at` for security-event review.

Do not add collections. Do not run this migration against production without separate explicit approval. Keep migration checksums immutable.

## Consequences

- Login is intentionally closed to unprovisioned Discord accounts; this prevents account squatting and self-assigned roles.
- The operator must provision players and Discord identity links before users can sign in.
- Session persistence is database-backed and works across server instances.
- Role changes and account revocations take effect on subsequent session validation.
- The session field extension is an explicit ADR-approved schema extension because the existing Data Dictionary does not specify session fields.
- Authentication requires deployment environment values supplied by the project owner. No credential values are committed to the repository.

## Required environment variables

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

The project owner supplies the actual values in local/Vercel environment settings. Never commit secrets.

## Out of scope

- Self-service player registration.
- Automatic role assignment from Discord.
- Discord guild-role synchronization.
- Password authentication.
- FIA system-operator privileges.
- Production data seeding or production database migration.
