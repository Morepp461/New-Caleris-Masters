# New Caleris Masters

Caleris Masters is a motorsport roleplay management platform. The initial release focuses on the private, admin-only workbook workspace: one admin dashboard with one page per workbook sheet.

## Stack

- Next.js App Router, React, TypeScript.
- MongoDB Atlas with the official Node.js driver.
- Server-side admin authentication using scrypt password hashing and HTTP-only session cookies.
- Responsive dark motorsport editorial interface.

## Initial state

- 0 members, 0 teams, 0 drivers and 0 financial transactions.
- Circulating balance ¢p0.
- Race 0, period 0, season 0.
- No historical workbook rows are imported.

## MongoDB collections

- `admin_users`: single administrator identity and password hash.
- `admin_sessions`: server-side sessions with automatic TTL expiration.
- `admin_sheet_records`: admin-only workbook records, partitioned by sheet key.
- `audit_logs`: audit event storage for future CRUD and finance auditing.
- `app_settings`: application configuration storage.

Indexes are initialized automatically by the application using the restricted MongoDB application user. The app user requires `readWrite` on `caleris_masters`.

## Environment variables

Configure these in local `.env.local` and the Vercel project settings:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@new-caleris-masters.3mzhxb3.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=caleris_masters
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-long-unique-password
ADMIN_DISPLAY_NAME=Caleris Administrator
```

The first login bootstraps the only administrator using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Keep these values private. Never commit `.env.local` or expose the MongoDB URI to browser code.

## Development

```bash
npm install
npm run dev
```

## Security notes

- The Atlas application user is restricted to `readWrite` on the Caleris database; it is not an Atlas administrator.
- The application validates the admin session on server-rendered pages and every admin API route.
- Session cookies are HTTP-only, SameSite strict, and secure in production.
- Passwords are stored as salted scrypt hashes, never as plaintext.
- Expired sessions are automatically removed by a MongoDB TTL index.
- Do not remove the legacy Supabase project until all remaining Supabase data and workflows have been audited and intentionally retired.
