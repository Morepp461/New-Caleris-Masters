# Phase 00–01 Engineering Baseline

**Source baseline:** CALERIS_MASTERS_Complete_Game_Implementation_Blueprint v1.0; CALERIS_MASTERS_Master_Development_Roadmap_Final v1.0; Database Schema & Data Dictionary v1.0.  
**Repository:** `Morepp461/New-Caleris-Masters`  
**Implementation branch:** `feat/phase-00-01-governance-database-foundation`

## Phase 00 — Governance & project foundation

### Repository baseline
- Next.js 16.4.3, React 19.2.9, TypeScript strict mode.
- App Router; source contains the public landing page, layout, and global stylesheet.
- Baseline scripts: dev, build, start, lint. This phase adds typecheck, test, and guarded db:migrate.
- No package lockfile was present at the baseline commit; CI and Vercel use npm install. A committed lockfile remains a reproducibility follow-up.
- No existing GitHub Actions workflow was present in the main tree.
- Existing Vercel project is linked to the repository and production branch main.

### Changes in this phase
- Pin Node.js 24 in package.json engines and .nvmrc. Vercel's Node.js documentation confirms engines.node overrides the project setting for new deployments.
- Add CI for pull requests and relevant branch pushes: install, lint, typecheck, unit tests, production build, and Gitleaks scan.
- Add PR template, CODEOWNERS, changelog, environment matrix, and ADRs.
- Keep all credentials out of Git. The existing .env.local is not read, overwritten, or committed.
- Local template defaults to the isolated development database name.

### Environment inventory (values intentionally excluded)
| Environment | Vercel configuration observed | Database target |
|---|---|---|
| Local | .env.example template only; local secret file not inspected or modified | caleris_masters_dev |
| Preview | No Preview-scoped MongoDB variables were present in the inventory | Not configured |
| Production | Production-scoped MONGODB_URI, MONGODB_DB, and Admin variable names exist; sensitive URI and Admin values are blank placeholders | caleris_masters |

**Production credential blocker:** the production MONGODB_URI and Admin secret values are empty. No secret was guessed, generated, copied, decrypted, or overwritten. Production application-to-database connectivity is therefore not verified.

### Governance limitations
The connected GitHub interface supports repository content, branches, commits, PRs, and status checks, but does not expose a write operation for branch-protection/ruleset settings or repository label/milestone administration. CI and CODEOWNERS are committed; mandatory branch protection and issue-board labels remain an owner-side GitHub settings task.

## Phase 01 — Domain model & database architecture

### Baseline decisions
- MongoDB Atlas is the authoritative database.
- Database name for isolated work: caleris_masters_dev.
- IDs use UUID strings as defined in the data dictionary.
- Collections are domain-oriented; relationships use immutable IDs, not display names.
- Ledger records and historical race records are append-only/immutable by policy.
- Migration execution is explicit and environment-guarded; it is never run during Next.js build or deployment.
- No fictional players, teams, balances, seasons, periods, or races are seeded.

### Actual Atlas development bootstrap
- Database: caleris_masters_dev.
- Collections: 64 total = 63 domain collections from the data dictionary + schema_migrations.
- Documents: 0.
- Indexes: 103 total = 64 built-in _id indexes + 39 documented custom indexes.
- No game seed data was inserted.
- Production caleris_masters remains at 4 collections, 3 documents, and 9 indexes; existing Admin and session records were not modified.

### Schema validation and migration status
The repository migration defines a conservative MongoDB JSON Schema baseline requiring a string UUID _id and applies it with collMod. The Atlas connector used for direct development bootstrap can create collections and indexes but does not expose collMod / collection-validator operations. Therefore:
- Development collections and all 39 custom indexes have been created.
- Field validators have NOT yet been applied.
- schema_migrations exists but is empty; the versioned migration has not been recorded as applied.
- The migration runner must be executed with a development MONGODB_URI to apply validators and record the checksum before Phase 01 can be marked fully accepted.
- Detailed field-level validators are not invented where the source documents leave fields open or conflict.

### Known source conflicts / open decisions
1. Roadmap/blueprint mention role_history in some passages, while the Database Schema & Data Dictionary defines role_assignments as the authoritative role history and does not define a separate role_history collection. This phase uses role_assignments; no second history collection is created.
2. The data dictionary states common created_at and updated_at fields, while event and immutable record schemas use specialized timestamps and do not consistently list both. Only the universal UUID _id baseline is enforced until field-level schema ownership is reconciled.
3. The data dictionary labels itself Technical Draft. Its documented names and indexes are used as the baseline, but unspecified fields, enums, TTL policies, and additional uniqueness rules are not guessed.
4. The current Atlas cluster is a Free tier MongoDB 8.0.37 replica-set deployment. Transaction behavior and capacity limits must be validated before implementing multi-document money, contract, or race-finalization services.

## Acceptance evidence
- GitHub Actions CI on the PR commit: lint, typecheck, unit tests, production build, and secret scan all succeeded.
- Vercel Preview deployment for the PR head reached READY.
- Development database contains the expected 63 domain collections plus schema_migrations, with no game seed documents.
- The 39 custom index definitions were created from the source index plan.
- Production database counts and existing Admin/session records remain unchanged.
- Production deployment must be READY after merge to main.

## Not in Phase 00–01
Authentication providers, API routes, player/team lifecycle, economy execution, race engine execution, worker deployment, and gameplay UI remain in their later roadmap phases.
