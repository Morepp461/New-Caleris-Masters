# Phase 03 — Identity, Authentication & Authorization

Status: implementation in progress on `feat/phase-03-identity-auth`.

## Source alignment

This phase follows the approved CALERIS MASTERS project sources and ADR-0003. Discord is the identity provider; player identity remains a separate, permanent record in `players`. A Discord account does not create a player, team, role, or balance.

## Implemented in this branch

- Discord OAuth authorization start and callback routes.
- Random one-use OAuth state cookie and state comparison.
- Discord profile verification using the provider identity and verified email required by the existing `auth_accounts.provider_email` field.
- Login only for an operator-provisioned Discord-to-player mapping.
- Database-backed opaque sessions with SHA-256 token hashes, seven-day absolute expiry, server-side revocation, and HttpOnly cookies.
- Session endpoint and logout endpoint.
- Centralized permission checks using `permissions` and `role_permission_policies`; default deny when policy is absent.
- Operator-only Discord identity linking for an existing active player.
- Operator-only role assignment for the defined game roles. Operator authority remains `players.is_operator`; FIA is not an operator.
- Authentication and identity audit records in the existing `audit_logs` collection.
- Versioned Phase 03 migration script for the session validator and indexes.
- Landing-page Player Access link now starts Discord login.

## Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/auth/discord/start` | Begin Discord OAuth |
| GET | `/api/v1/auth/discord/callback` | Verify callback and create session |
| GET | `/api/v1/auth/session` | Return the current server-verified identity |
| POST | `/api/v1/auth/logout` | Revoke current session |
| POST | `/api/v1/admin/identity/links` | Operator links a Discord ID to an existing player |
| POST | `/api/v1/admin/identity/roles` | Operator assigns an allowed game role |

## Database migration

Run only against `caleris_masters_dev` after reviewing the diff:

```bash
npm run db:migrate:phase-03
```

The migration is blocked for production by default. It extends the existing `player_sessions` validator and adds:
- Unique `player_sessions.session_token_hash`.
- `player_sessions(player_id, status, expires_at)`.
- Unique partial `auth_accounts(provider, player_id)` for Discord links.
- `audit_logs(action, created_at)`.

No new collection is created. No production data is seeded or changed.

## Environment configuration

The project owner will supply these values later in local/Vercel environment settings:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

The redirect URI must exactly match the callback registered in the Discord application. No credential values belong in Git or chat.

## Known limitations / follow-up

- OAuth cannot complete until the project owner configures Discord credentials.
- A player must already exist and be active before an operator can link a Discord identity.
- An operator must already be provisioned securely by the project owner in MongoDB. No hardcoded bootstrap Discord ID or secret is introduced.
- Permission policies are read from the existing collections and fail closed. This branch does not seed a permission matrix because the source does not supply the complete permission-key catalogue.
- The Phase 02 process-local rate limiter remains a known deployment limitation until a shared rate-limit adapter is approved.
- Vercel deployment remains subject to the previously observed build-rate limit; CI must pass before merge and deployment retry.

## QA checklist

- OAuth state mismatch and missing callback code are rejected.
- Unlinked Discord identity cannot create a player or role.
- Inactive player cannot authenticate.
- Session token is never stored in plaintext.
- Expired/revoked sessions are rejected.
- Logout revokes the server-side session.
- Missing permission policy denies access.
- FIA does not receive operator privileges.
- Duplicate Discord link and duplicate player mapping are blocked by unique indexes.
- Production database is not migrated.
