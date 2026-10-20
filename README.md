# [APP NAME]

A mobile-first PWA that shows Garmin activities next to body notes, with a read-only share link for a physio. The spec is in `Plan/spec.md`.

## Data location

Supabase project region: **fill in before first use** (London, `eu-west-2`, or another EU region). Health data must stay in the UK or EU.

## Setup

1. Create a Supabase project in London or an EU region.
2. Copy `.env.example` to `.env.local` and fill in the project URL, anon key and service-role key.
3. Apply the migrations in `supabase/migrations/` in order. Either paste each file into the Supabase SQL editor, or run `npx supabase link` then `npx supabase db push`.
4. In Supabase, go to Authentication, URL configuration. Set the site URL, and add redirect URLs `http://localhost:3000/auth/confirm` and your Vercel URLs ending in `/auth/confirm`.
5. Run `npm run dev`.

The service-role key is server-only. On Vercel, add it as a server environment variable and never prefix it with `NEXT_PUBLIC_`.

## Scripts

- `npm run lint`, `npm run typecheck`, `npm test`: the checks to run before each commit.
- `npm run test:e2e`: Playwright smoke tests (run `npx playwright install chromium` once).

## Tests that need a database

`tests/rls.test.ts` creates two users in the Supabase project named in `.env.local` and checks that neither can read or change the other's rows. Point it at a test project, not one with real data. It skips with a warning when the variables are missing.

## Rules

- Never commit real health data. Real Garmin exports stay outside the repo. `*.csv` is ignored except in `fixtures/`.
- UI text is sentence case. No all caps, no italics, no emoji.
