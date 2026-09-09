# Live first-beta loop - implementation record

Date: 2026-09-02
Deployment: https://enquiry-ashy.vercel.app
Head at time of writing: `2b56371`

This records work that went beyond the R2A slice because the loop was walked
end to end on the deployed app and it did not work. Every defect below was
found by using the product as a business would, not by reading the code.

## What now works, verified on the deployment against the live database

A signed-in business can:

1. complete onboarding and get a real provisioned workspace;
2. state what it charges (`$145 per person, minimum 3 people`), stored as a
   typed `rule_payload`, state `Active`;
3. add a real enquiry by typing or pasting what the customer said;
4. see Enquiry refuse to guess - `NEEDS_INFORMATION`, naming exactly one fact
   (`guests`) - with a prepared reply that asks for it and nothing else;
5. answer that one fact, and watch the enquiry become `ACTION_READY` /
   `QUOTABLE` with a prepared quote reading
   **"That comes to $580. 4 people at $145 each."**;
6. record the send, producing a real outbound `message` row with `sent_at`,
   moving the enquiry to `WAITING_ON_CLIENT` / responsibility `CUSTOMER`.

Every figure is derived from that business's own rule. Nothing is fixture data
and nothing is invented.

## Defects found by walking it, and fixed

| # | Defect | Why it mattered |
|---|---|---|
| 1 | `/enquiries` while signed out redirected to `/login?redirect=/login` | Signing in returned the operator to the sign-in page. The guard re-rendered after its own navigation and overwrote the destination. |
| 2 | "Continue with Google" rendered from a hardcoded list | No OAuth provider is enabled on the project; the button answered "Unsupported provider". |
| 3 | The first enquiry added crashed the desk | `toEnquiry` cast a missing `decision_snapshot` to a complete one. `decision.evaluators` was `undefined` and the view read `.filter` on it. |
| 4 | A decided enquiry sat on `EVALUATING` | The desk showed "wait until Enquiry finishes reading" over a decision already made, with nothing coming to move it on. |
| 5 | `EMAXCONNSESSION - max clients reached in session mode` | The deployment used the session-mode pooler (5432) with pg's default 10 connections per warm instance. Real page loads failed. |
| 6 | "No message prepared." | The desk named the right action and gave the owner nothing to send. |
| 7 | A blocked enquiry could never be unblocked | The honest refusal was a dead end - no way to supply the fact it asked for. |
| 8 | "4 persons at $145 each" | Naive `${unit}s`, in a sentence a customer reads. |

## Test suite

Was 352/361 with nine failures treated as pre-existing. Now **380/380**.

Two of those nine were real bugs:

- `resolveOgTitle` preferred a whole-site title over an explicitly supplied
  `appName`, so a caller's answer lost to a filesystem fallback;
- og card resolution read `public/` on every call, making rendered tags depend
  on the process's working directory.

Four asserted the presence of `.grok/app-env.json`, which `.gitignore`
excludes - they could never pass in a clone or in CI. They now assert what the
repo actually guarantees: no committed override, therefore auth on.

## Infrastructure

- **Database credential.** Enquiry connects as a dedicated `enquiry_app`
  Postgres role with `BYPASSRLS` (the app enforces tenancy in code) and DML on
  its own 18 tables only. Verified that Orbit Digital's tables in the same
  project are unreachable from it. No password was reset, so Orbit's 23 Edge
  Functions were never at risk.
- **Pooler.** Transaction mode (6543), not session mode. Verified against the
  live database that transaction mode handles BEGIN/COMMIT, the
  `pg_advisory_xact_lock` guarding provisioning, rollback, and concurrency. No
  prepared statements are used anywhere, which is its one real constraint.
- **Pool sizing.** `max` 3 per instance (`DATABASE_POOL_MAX`), 10s idle
  timeout, 10s connection timeout.

All probe data was removed afterwards; Orbit's row counts were confirmed
unchanged before and after.

### Applying migrations in production (2026-09-09)

`enquiry_app` has `BYPASSRLS` and DML grants, but it owns no table - every
table is owned by `postgres`. It cannot run DDL. `npm run build` used to chain
`npm run db:migrate`, so migration 0007 (`alter table enquiry add column`)
failed on the first Vercel build of commit `d6d13d8` with Postgres error
42501, `insufficient_privilege`, and the build exited 1. The build no longer
runs `db:migrate` at all; migrations are applied out of band, before the
deploy that depends on them, as four steps:

1. Apply the migration file as the table-owner role (`postgres`). Run
   `npm run db:migrate` with an owner `DATABASE_URL`, or paste the file into
   the Supabase SQL editor.
2. Grant the new table to `enquiry_app`:
   `grant select, insert, update, delete on <table> to enquiry_app;`
3. Enable RLS on it: `alter table <table> enable row level security;`
   No policies are added. This is the same deny-by-default pattern as every
   other table (see `migrations/0005_rls_lockdown.sql`).
4. Confirm the row landed in `_migrations`.

0007 was applied this way on 2026-09-09, after the first build-time attempt
failed on `d6d13d8`. `reviewed_send`'s grants and RLS were set up in the same
pass. Migrations 0002 through 0006 were applied the same way, out of band, on
2026-09-02 - they share one `_migrations` timestamp, so build-time migration
through the app role never actually worked; it just never happened to touch a
DDL statement before 0007.

## Still blocking a sale - needs Adam

1. **Transactional email.** Magic-link delivery currently uses Supabase's
   built-in SMTP, which is documented as testing-only and rate-limited to a
   couple of messages an hour. A real customer signing up needs a proper
   provider configured (Resend or similar).
2. **Payments.** There is no Stripe integration, so nobody can be charged.
3. **Domain.** Running on `enquiry-ashy.vercel.app`.
4. **The Grok preview OAuth credential** remains in git history. Removing the
   code was not containment; it needs revoking at the broker.

## Known, not yet done

- The hero uses roughly half the viewport width on a 1440px screen, leaving a
  large dead zone on the right. Changing that is a design decision, not a bug
  fix, and is deliberately left for a reference-anchored pass.
- Around 29 store actions are still client-only, so their effects do not
  persist. The first-beta loop no longer depends on any of them.
