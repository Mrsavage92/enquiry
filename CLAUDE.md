# Enquiry - instructions for Claude

`AGENTS.md` is the old Grok Build sandbox contract ("You are Grok Build", no shell). It does not apply to Claude. You have a shell and the normal toolset in this repo; ignore any AGENTS.md rule that says otherwise. Read `README.md`, `docs/` and `AGENTS.project.md` for what the app is and how it is built.

**Start here:** `docs/handover/2026-10-15-claude-projects/HANDOVER.md` describes the current state, the open PRs, what is next and what only the founder can do.

## Rules that bind every change

- Never use the em dash character anywhere: code, copy, commits, PR text. Use a hyphen.
- No commit or PR attribution lines.
- `main` deploys to production through Vercel's GitHub integration (https://enquiry-ashy.vercel.app). Merge only on a green Vercel check plus green local typecheck, lint, build and tests. After a merge, run `bash scripts/verify-live.sh` and read the content, not the status code.
- Every PR gets an independent review before merge. Send the findings back to the author, then re-review.
- Tests: `npm test -- --test-concurrency=2`. A file failing with "PGlite failed to initialize" or a timeout under load is memory: re-run that file alone before treating it as a failure.
- Tenancy is enforced in code (`authMiddleware` plus `requireBusinessAccess` / `requireEnquiryAccess`). Every new server function needs a two-tenant test proving both Forbidden and no mutation.
- Migrations are NOT applied by deploy. They are applied by hand to production Supabase (project `qzzvxfbitixpmfuirvhq`) as the owner role, with the grants for `enquiry_app`, RLS enabled, and a row in `_migrations`. A migration must be applied BEFORE the code that needs it merges.
- Public copy must stay true (`docs/PUBLIC_CLAIM_TRUTH_MATRIX.md`). No fabricated customers, counts, testimonials or integrations. Subscription prices live only in `src/lib/site/offer.ts`.
- The brand hero markup and h1 are locked. Every text/background pair must measure at least 4.5:1 (3:1 large) and be added to `src/lib/ui1-contrast.test.ts`.
- This repo is public. Never commit secrets, personal data or private business numbers.
