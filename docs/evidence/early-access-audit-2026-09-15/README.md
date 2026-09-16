# Early-access go-live audit, 15 September 2026

Audited: production https://enquiry-ashy.vercel.app at `main` `9ebff84`. Auditor: Claude, delivery role. This file records what was exercised on the deployed target so the reviewer can tick `docs/PUBLIC_TRAFFIC_GATE.md` sections 2 and 5 from evidence rather than from unit tests. Nothing here signs off a gate.

## Exercised on production

| Gate item | What was done | Result |
| --- | --- | --- |
| Production equals main | `/roadmap` renders the PR #29 headings | Yes, `9ebff84` |
| Desktop homepage | Full-page capture at 1440x900 | No overflow, no clipped controls, no console errors |
| Phone homepage | Full-page capture at 390x844 | No horizontal overflow, product capture switches to the mobile image, 44px targets |
| Waitlist usable | Fresh browser context, `/early-access?utm_source=audit-test&utm_content=claude-audit`, submit `claude-audit-2026-09-15@example.com` | Joining state, success moved focus to the optional questions, step 2 saved, completion focused "You're on the list" |
| Waitlist persists on the deployed target | `select ... from public.waitlist where email like 'claude-audit%'` | Row present with email, business_type, enquiry_volume, channels, beta_interest, utm_source, utm_content, first_touch, latest_touch, created_at, qualified_at |
| Attribution recorded | Same row | `utm_source=audit-test`, `utm_content=claude-audit`, landing_path in first_touch |
| Privacy and Terms resolve | Direct GET | 200, one H1 each |
| No public waitlist read | RLS enabled, zero policies, anon grants exist but RLS blocks; MCP query as owner only | Confirmed |
| Sign-in on the deployed target | `/login` with a real inbox (mr.savage.0092@gmail.com, pre-existing auth user, no membership); email arrived from `Supabase Auth <noreply@mail.app.supabase.io>` within seconds; link followed | Supabase redirected to `https://enquiry-ashy.vercel.app/auth/complete?redirect=%2Fenquiries` with a session; app landed on `/onboarding` step 1 of 2 ("Your real business. Nothing here is a sample.") |
| Bad link handling | A mistyped token followed | `/auth/complete` showed "That link has expired" with "Request a new link" and "Set up an invited account" |
| Lighthouse, mobile, home | chrome-devtools lighthouse_audit | Accessibility 100, Best Practices 100, SEO 100 |
| Suite at `9ebff84` | `npm test -- --test-concurrency=1` on the Windows PC | 763 passed, 0 failed; typecheck and lint clean |

Not exercised: OS-level reduced motion (browser emulation unavailable in this connection); Vercel production environment variables (CLI on this machine is on a different Vercel team).

## Cleanup

The waitlist row and its `launch_events` (utm_source `audit-test`) were deleted; `public.waitlist` is back to 0 rows. No auth user, business, membership or workspace row was created; the gmail auth user already existed since 2026-09-02.

## Findings that led to the accompanying change set

1. The sign-in email a client receives is sent by the Supabase built-in mailer: provider From name, a "powered by Supabase / Opt out of these emails" footer appended below the branded template, best-effort delivery, a couple of messages per hour. Owner action (custom SMTP), not code.
2. No contact address existed anywhere on the public site; Privacy and Terms directed people to reply to an email that is a no-reply. Fixed in this change set with one constant in `src/lib/site/contact.ts`.
3. Privacy did not name the AI processor, the processing country or a retention period. Fixed.
4. No error alerting existed; a production exception was visible only in the Vercel log stream. Added `src/lib/server/alert.ts` and wrapped the launch and onboarding server functions. Sends only once `ALERT_WEBHOOK_URL` is set.
5. The hero named no audience. Added the kicker "For owner-run service businesses".
6. `/login` relied on robots.txt alone. Added `noindex,nofollow` meta, matching `/signup`.
7. The early-access offer had no onboarding call, no seat cap, no notice period and no feedback expectation. Copy updated on `/early-access`, the home FAQ and Terms. The "first 20 invited businesses" cap is a proposed number for the owner to confirm.
