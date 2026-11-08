# Deployment and first-admin checklist

## Supabase

The six migrations are already applied to the active `Clrs Mstr 2` project. The database currently has zero member profiles, teams, transactions, seasons, loans, transfers, and penalty/tax logs. Existing legacy tables `kv_store` and `Ledger` were left untouched.

Set these Vercel/local environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not add a service-role key to any `NEXT_PUBLIC_*` variable or browser bundle.

## First administrator

1. Create the owner account in Supabase Authentication.
2. Copy the new Auth user's UUID.
3. Run this one-time SQL in the Supabase SQL Editor, replacing the placeholders:

```sql
insert into public.member_profiles (user_id, display_name, role, status)
values ('AUTH_USER_UUID', 'Administrator', 'admin', 'active');
```

The administrator role is not counted as a regular member. FIA is a separate role and does not receive administrator write access.

## Vercel

1. Import `Morepp461/New-Caleris-Masters` as a Next.js project.
2. Keep the root directory at `.`.
3. Add the two Supabase environment variables above to Production, Preview, and Development.
4. Deploy the `main` branch.

The Vercel integration connected to this session currently returns HTTP 403 when creating a project, so project import must be completed by an account with Vercel project-creation permission.

## Current application scope

The command center is live-data-ready and reads member, team, transaction, loan, season, and bank summary views. The member, team, finance and bank tables are currently read-only. Create/edit workflows and role-specific FIA permissions remain to be implemented.
