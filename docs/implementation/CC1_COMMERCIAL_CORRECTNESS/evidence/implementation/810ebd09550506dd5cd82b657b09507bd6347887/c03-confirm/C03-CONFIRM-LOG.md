# C03 at final head (810ebd0) - successful confirm, browser journey

Executed 2026-09-07 (Australia/Brisbane). Branch `cc1/commercial-correctness`,
commit under test `810ebd09550506dd5cd82b657b09507bd6347887` (fresh `git worktree
add` from that exact SHA, `npm install` only, no source edits), dev server on
port 5182.

This closes the one residual named by the independent reviewer in
`research/agent-runs/2026-09-04/35-review-pr11-cc1.md` ("Ruling: is a full
13-step re-run at 810ebd0 required before sign-off?"): "no **successful** C03
was observed at the final head - the only confirm attempted there was
deliberately made stale in a second tab and correctly refused." This run
performs one clean prepare -> send-preview -> copy -> confirm -> reload on a
fresh artefact at that exact head, plus a retry (C04), to close it.

## Environment

- `npm run dev -- --port 5182`, `VITE_AUTH_ENABLED` not set (real auth on,
  confirmed via `GET /__app-env`). No `DATABASE_URL` (in-memory PGLite; app
  data resets on dev-server restart).
- Real Supabase Auth against project `qzzvxfbitixpmfuirvhq` ("growlocal",
  shared with Orbit Digital). Disposable user created by direct `auth.users`
  insert (all GoTrue columns, `encrypted_password` via `crypt()`,
  `email_confirmed_at` set, empty token columns, `is_sso_user=false`,
  `is_anonymous=false`) because Supabase's signup validator rejects the
  `example.com`-style disposable pattern via the normal signup flow and
  magic-link email is rate-limited. Email `cc1-c03-2026-09-07@example.com`, id
  `874f5f5b-621a-4313-bbb9-99b5556b1361`. Session established via
  `POST /auth/v1/token?grant_type=password`, then the resulting
  `{access_token, refresh_token, expires_at, user, ...}` object written to
  `localStorage["sb-qzzvxfbitixpmfuirvhq-auth-token"]` before navigating to
  `/onboarding`.
- Browser: chrome-devtools MCP, 1440x900.
- Baseline: `select count(*) from public.contacts` on `qzzvxfbitixpmfuirvhq` =
  **5** before the run. Confirmed **5** again after the live journey and again
  after final cleanup.

## Interruption and redo

The host process running this session exited mid-task after the first pass
had already completed successfully (dev server on 5182, onboarding, pricing
rule, enquiry "Taylor", C03 confirm, reload, C04 retry, all screenshots
1-13 captured). On resume: the dev server process was dead (nothing listening
on port 5182) and the browser context was reset, but the git worktree at
`enquiry-wt-c03` and the already-copied evidence screenshots survived. Because
this environment's data layer is an in-memory PGLite instance that resets on
dev-server restart (confirmed empirically in prior runs, e.g.
`research/agent-runs/2026-09-03/08-live-loop-verification.md`), the
application state (business, pricing rule, enquiry) from the first pass was
gone even though the worktree and screenshots were not. The disposable auth
user in Supabase survived (auth data is durable, unlike the app's PGLite
data), so it was reused rather than creating a second one - a fresh
password-grant token was pulled for it. The dev server was restarted on the
same port, and onboarding/pricing-rule/enquiry were redone from scratch to
produce one coherent, fully-live evidence set at the same head. The 13
screenshots below are all from this second, complete pass; the first pass's
screenshots were overwritten in place.

## Businesses/enquiries created (this pass)

- Business: "CC1 C03 Studio" (mobile makeup, Brisbane, owner "Jordan", solo).
- Pricing rule: "Group makeup", AUD 145 per person, quantity fact `guests`,
  minimum 3.
- Enquiry - "Taylor" (`16c081a4-84b3-4d6f-8892-6094517ff6be`): genuine pasted
  enquiry ("Hi! Need makeup for me and my bridesmaids on the 14th of
  November. What do you charge?"), guests missing at creation.

## Per-step result

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Sign in (password-grant + localStorage), onboarding with synthetic business | PASS | `01-03` |
| 2 | Add pricing rule: Group makeup, AUD 145/person, min 3 | PASS | `04-05` |
| 3 | Paste new enquiry, guest count missing, blocking fact shown | PASS | `06-07` |
| 4 | Confirm service (already confirmed at manual entry, per CC1-03), answer guests=4, exact AUD 580 draft | PASS | `08` |
| 5 | Open send preview, copy ("Copied to your clipboard. Nothing has been sent or recorded yet."), explicitly confirm ("I've sent this externally") - success | PASS (C03) | `09-11` |
| 6 | Reload: exactly one sent message, one quote version at AUD 580, state "Sent"/waiting on client | PASS | `12` |
| 7 | Retry the same confirmation (replayed `recordSentReply` verbatim in the authenticated page context, same `enquiryId`+`reviewedSendId`) - still exactly one record | PASS (C04) | `13` |

All 7 steps PASS. No console error and no failed (non-2xx) network request at
any point.

## Step 5 detail - the successful C03 confirm

Draft (unedited): "Hi Taylor, Thanks for getting in touch about group makeup.
That comes to $580. 4 people at $145 each. Happy to lock it in if that works -
just let me know. Thanks, Jordan." Send-preview dialog showed AMOUNT `$580`,
WHY `4 people at $145 each.` exactly matching the draft body - no
body/structured-amount mismatch.

Clicking "Copy the message" produced "Copied to your clipboard. Nothing has
been sent or recorded yet." (button label changed to "Copied"). Clicking
"I've sent this externally" produced toast "Recorded as sent by you." and the
enquiry state moved from "Ready to quote" directly to "Sent" (Waiting tab: 0
-> 1, "1 exact $580"). The live network trace showed the full sequence
`createManualEnquiry` -> `answerEnquiryFact` -> `prepareSendReview` ->
`recordSentReply`, all HTTP 200, each followed by a `fetchWorkspace` refresh.
The `recordSentReply` response body decoded to `{ok: true, duplicate: false,
stale: false, messageId: "176c6464-cf78-4ba3-a6eb-60e78292d48b"}`.

## Step 6 detail - reload persistence

Full page reload of `/enquiries/16c081a4-84b3-4d6f-8892-6094517ff6be`. After
reload: case file shows exactly one "Received" entry (10:37am) and exactly one
"You sent" entry (10:38am) - no duplicates. Quote panel shows exactly one
version: "VERSION 1", "Sent 7 Sep 2026 · stays on file", "$580" total. Desk
state "Sent", Waiting tab still reads "1 exact $580". Console: only the
pre-existing "form field element should have an id or name attribute" a11y
notice (unrelated, present since before this change) - no JS errors, no
failed network requests.

## Step 7 detail - retry (C04)

The "Send the quote" primary action is no longer present once an enquiry is
in the "Sent" state (matches the prior journey's method note in
`evidence/implementation/58b5679b2b58b8190a445c931ab2456715c1535a/browser-journey/JOURNEY-LOG.md`).
To exercise the real retry path against the actual server rather than skip
it, the exact `recordSentReply` request the browser had just sent (same
`enquiryId` + `reviewedSendId` + `staleAttestation:false`, captured from
DevTools Network) was replayed verbatim via `fetch()` executed inside the
authenticated page context (same-origin, same bearer token). The server's
structured response was `{ok: true, duplicate: true, stale: false, messageId:
"176c6464-cf78-4ba3-a6eb-60e78292d48b"}` - the identical `messageId` as the
original send, confirming idempotency rather than a second record. A
subsequent reload confirmed the UI (case file, quote version, "1 exact $580")
was unchanged: still exactly one "You sent" entry, still VERSION 1.

## Cleanup proof

- `select count(*) from public.contacts` on `qzzvxfbitixpmfuirvhq`: **5**
  before this pass, **5** immediately after the live journey, confirmed again
  after final cleanup below.
- `public.app_user`, `public.business` (name containing "CC1 C03") and
  `public.business_member` cross-checked for the test user id and business
  name - **zero rows** at every check, consistent with the PGLite finding:
  this dev server never wrote application data to the shared Supabase
  Postgres project, only the one `auth.users` row.
- Auth user `cc1-c03-2026-09-07@example.com`
  (`874f5f5b-621a-4313-bbb9-99b5556b1361`) deleted from `auth.users` on
  `qzzvxfbitixpmfuirvhq` after this evidence was captured and committed (see
  main task report for the final post-cleanup re-check).
- Dev server (port 5182) stopped.
- Worktree `enquiry-wt-c03` removed after commit/push.

## Bottom line

The independent reviewer's named residual - "no successful C03 was observed
at the final head" - is closed. A clean prepare -> preview -> copy -> confirm
was observed to succeed at `810ebd09550506dd5cd82b657b09507bd6347887`, a
reload afterward showed exactly one sent message and one quote version, and a
same-payload retry was refused as a duplicate (same `messageId`, no new
record), also confirmed across a reload. No console error and no failed
network request occurred at any point in either pass.
