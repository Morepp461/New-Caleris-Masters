# New Caleris Masters

Caleris Masters is a motorsport roleplay management platform. The foundation follows the VML portal's dark editorial motorsport direction: restrained red and gold accents, Anton headlines, and Inter body text.

## Foundation included

- Next.js App Router, React, and TypeScript.
- Responsive command-center dashboard.
- Economy calculation helpers in `lib/economy.ts`.
- Initial Supabase schema and row-level security policies in `supabase/migrations/`.
- Empty initial state: 0 members, 0 teams, ¢p0 circulating, 0 completed races, balancing period 0, season 0.
- No sample members, teams, or financial transactions are seeded.
- FIA is a separate role and is not treated as an unrestricted administrator.

## Economy rules encoded

- Active Premio driver salary: ¢p1,000 per race.
- Active Zwei driver salary: ¢p500 per race.
- Principal and inactive members receive no automatic driver salary.
- Team wealth tax uses the principal's balance, not the sum of team members.
- Wealth-tax tiers: up to ¢p150,000 = 0%; above ¢p150,000 through ¢p300,000 = 5%; above ¢p300,000 = 10%.
- Vreeo Bank late interest: simple interest, 5% of principal per late day, without compounding.
- Driver transfer tax: 10% when gross transfer is greater than ¢p50,000.
- One balancing period covers 5 races.
- Sponsorship components: T1 ¢p50,000, T2 ¢p40,000, T3 ¢p30,000, T4 ¢p10,000 (maximum ¢p130,000).

**Source caveat:** the uploaded reference named `FIXXRPCALERIS.xlsx` is actually a 22-page PDF. Its printed tax bands overlap at exactly ¢p150,000. This foundation assigns exactly ¢p150,000 to the 0% tier to avoid overlapping bands. Verify that boundary against the original workbook formulas before enabling automatic production posting. The source document did not expose the original spreadsheet formulas.

## Run locally

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project owned by the Caleris Masters project owner.
2. Copy `.env.example` to `.env.local` and fill in the public project URL and anon key.
3. Apply `supabase/migrations/202611080001_initial_schema.sql` using the Supabase CLI or SQL editor.
4. Configure authentication providers and storage after reviewing the member onboarding flow.

The current dashboard is a frontend foundation; it does not yet submit real transactions or manage live member records. The migration establishes the initial data model and admin-only mutation boundary. Never expose the Supabase service-role key in browser code.

## Permission model

`admin` is the unrestricted platform administrator. `fia` is a separate role and is deliberately not granted administrator policies by default. FIA capabilities should be granted narrowly by module after the final role matrix is approved.
