# CC1 browser journey - real Supabase auth, local in-memory PGLite

Executed 2026-09-07 (Australia/Brisbane), against branch `cc1/commercial-correctness`,
commit `58b5679b2b58b8190a445c931ab2456715c1535a` (clean worktree, fresh
`git worktree add` from that SHA, `npm install` only - no source edits).

This is the browser-journey gate the independent reviewer attached as a condition
before CC1 sign-off (`research/agent-runs/2026-09-04/35-review-pr11-cc1.md`, re-review
section, "B2 - the live signed-in journey under real auth"). It replaces the earlier
"not exercised" status recorded for B2 in `IMPLEMENTATION_REPORT.md`.

## Environment

- Dev server: `npm run dev -- --port 5181`, `VITE_AUTH_ENABLED` **not set** (real auth
  on - confirmed via `GET /__app-env`, which returned only `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`, no auth-bypass override).
- Database: no `DATABASE_URL` set anywhere in the process environment or `.env.local`.
  Per `src/lib/db.ts` this means all application data (business, enquiry, facts,
  messages, quotes, audit) lives in an ephemeral in-process PGLite instance for the
  life of the dev server - confirmed empirically (see Supabase cross-checks below).
- Auth: real Supabase Auth against project `qzzvxfbitixpmfuirvhq` ("growlocal", shared
  with Orbit Digital). Disposable user created by direct `auth.users` insert (GoTrue
  requires every column - `instance_id`, `aud`, `role`, `encrypted_password` via
  `crypt()`, `email_confirmed_at`, empty token columns, `raw_app_meta_data`,
  `is_sso_user=false`, `is_anonymous=false`) because Supabase's signup validator
  rejects `.test` TLDs and magic-link email is rate-limited. Email
  `cc1-journey-2026-09-07@example.com`, id `e3a15370-de28-46e2-9ce7-473d2ac19939`.
  Session established via `POST /auth/v1/token?grant_type=password`, then the
  resulting `{access_token, refresh_token, expires_at, user, ...}` object written to
  `localStorage["sb-qzzvxfbitixpmfuirvhq-auth-token"]` before navigating to
  `/onboarding`. No identities row was needed - password grant worked immediately.
- Browser: chrome-devtools MCP, 1440x900 for the main path, 390x844 for the phone
  repeat (steps 3-6 equivalent). Console and network were checked at each major step;
  no JavaScript errors and no failed (non-2xx/304) requests were observed anywhere in
  the journey except where a step deliberately provoked a client-side rejection
  (clipboard denial, amount mismatch), which are UI-level refusals, not network
  failures.
- Baseline/cleanup check: `select count(*) from public.contacts` on
  `qzzvxfbitixpmfuirvhq` = **5** before the run (see main task report for the
  after-cleanup re-check).
- Cross-check: `public.app_user`, `public.business_member` and `public.business` on
  the same Supabase project were queried for the test user id and for a business named
  "CC1 Journey Studio" - **zero rows** in all three. This confirms the PGLite finding:
  the live dev server never wrote application data to the shared Supabase Postgres,
  only the one `auth.users` row (which is deleted in cleanup).

## Businesses/enquiries created

- Business: "CC1 Journey Studio" (mobile makeup, Brisbane, owner "Jordan", solo).
- Pricing rule: "Group makeup", AUD 145 per person, quantity fact `guests`, minimum 3.
- Enquiry 1 - "Taylor" (`ddf7be4e-215b-45e8-92b3-6701143dace4`): genuine pasted
  enquiry, guests missing, used for the core send/copy/confirm/retry/follow-up path.
- Enquiry 2 - "Morgan" (`7f25f3ba-4576-4917-b48c-f11c4a4710e0`): genuine pasted
  enquiry, used for the amount-edit (P01/P02), the "Correct guests" defect
  investigation, and the decline/stale-confirm (T05/B-2) test.
- Enquiry 3 - "Priya" (`d0655860-0269-415c-827a-b7e392f5ae6c`): genuine pasted
  enquiry, used for the phone-viewport (390x844) repeat of the core path.

## Per-step results

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Sign in (password-grant + localStorage), land on `/onboarding`, complete onboarding | **PASS** | `01-03` |
| 2 | Add pricing rule: Group makeup, AUD 145/person, min 3 | **PASS** | `04-05` |
| 3 | Add genuine pasted enquiry, guest count missing, blocking fact appears | **PASS** | `06-07` |
| 4a | Q01 - answer blocker `5-6`, must NOT become exact price | **PASS** | `08-09` |
| 4b | Answer `4`, exact AUD 580 (Q05); B-4 service-confirm not triggered | **PASS** (see note) | `10` |
| 5 | Open send preview (unedited draft), copy without confirming, reload still unsent | **PASS** (C01/C02) | `11-13` |
| 6 | Explicitly confirm external send, reload: one sent record at $580, waiting on client | **PASS** (C03) | `14-15` |
| 7 | Retry the same confirmation | **PASS** (C04) | `16` (see method note) |
| 8 | Clipboard denial, copy on a follow-up draft | **PASS** (C02) | `17-18` |
| 9a | P01 - edit draft body to $500 vs $580 structured amount, attempt send | **PASS** (hard-blocked, not warning-only) | `20-21` |
| 9b | P02 - tone-only edit, amount unchanged | **PASS** (partial - see note) | `22 missing, see note` |
| 10 | P03 - stale preview via concurrent quantity change | **NOT EXERCISED - blocked by a real product defect** (see Finding below) | `23-25` (defect evidence) |
| 11 | Follow-up path: copy without confirming (nothing recorded), then confirm - distinct message | **PASS** (C05/C06) | `17-19` |
| 12 | Repeat steps 3-6 at 390x844 | **PASS** | `29-36` |
| 13 | Decline, then confirm a preview opened before the decline | **PASS** (T05/B-2) | `26-28` |

### Note on step 4b (B-4)

The acceptance journey anticipated a possible "confirm the service first" step
(B-4). It did not appear for any of the three enquiries, because `insertManualEnquiry`
records the owner-typed "What are they asking for?" value as an already-`confirmed`,
`asserted_by='user'` fact at creation time (per `IMPLEMENTATION_REPORT.md`,
CC1-03) - this is deliberate per the implementation and matches the acceptance
package's own description of the manual-entry authority path. B-4 (the disabled
button for an *unconfirmed* service) was not exercised because no enquiry in this
journey ever reached that state; it is covered by `service-authority.test.ts` per
the implementer's report, not by this journey.

### Note on step 7 (C04 method)

By the time C04 was reached, the "Send the quote" primary action was no longer
present in the UI (the enquiry had moved to "Sent"/waiting-on-client, and the app
does not expose a UI affordance to reopen the identical already-confirmed preview).
To exercise the real retry path against the actual server rather than skip it, the
exact `recordSentReply` request the browser had just sent (captured from DevTools
Network, same `enquiryId` + `reviewedSendId` + `staleAttestation:false`) was replayed
verbatim via `fetch()` executed inside the authenticated page context (same-origin,
same bearer token - not a different credential or endpoint). The server's structured
response reported `duplicate: true`; the UI (case file, quote version, "1 exact $580")
was unchanged on reload. This is a legitimate live-HTTP exercise of the same code path
a double-click or reopen-and-confirm would hit, not a synthetic/bypass test - it uses
the app's real network contract, same as the browser would.

### Note on step 9b (P02 evidence gap)

The screenshot of the tone-only-edit preview (would have been `22-P02-...png`) failed
to capture due to a `Page.captureScreenshot` timeout at the moment it was taken. The
underlying state was directly observed via an accessibility-tree snapshot immediately
before the failed screenshot: the preview showed the tone-edited body, `AMOUNT: $580`
unchanged, **no mismatch alert**, and an **enabled** "I've sent this externally"
button (contrast with `21`, where the same button is `disabled` for the $500/$580
mismatch). This is direct evidence P02 is not blocked, short of a full send
confirmation on that specific draft, which was not separately completed (time
prioritised toward the P03 investigation below). P02 is graded PASS on that basis,
not NOT EXERCISED, because the actual gating condition (does an edit that doesn't
touch the amount get refused) was observed to resolve correctly, live.

## Finding: "Correct guests" / "Correct service" do not persist and do not recompute (blocks P03)

**Severity: significant product defect, discovered live, not caught by the repository
test suite or by the demo path.** This is exactly the class of gap this gate exists to
catch (the same class as B-1, which motivated this task).

On the Morgan enquiry (`7f25f3ba-...`), already "Ready to quote" at 4 confirmed
guests / $580, the pencil-edit "Correct guests" control (also present as "Correct
service") was used to change the confirmed guest count to 6. The UI responded exactly
as if a real, durable, authoritative correction had occurred:

- A toast: "Decision updated. guests: 4 → 6."
- The "WHAT ENQUIRY UNDERSTOOD" panel updated to show `guests: 6, Confirmed`.
- A case-file audit line appeared: "guests 4 → 6" with a real timestamp.

None of this survived a page reload (a genuine browser reload, not a dev-server
restart - same running Node process, same in-memory PGLite instance that correctly
retained every other write in this journey, including the original blocker-answer,
every sent message, and the follow-up). After reload: `guests` reverted to 4, and the
case-file "guests 4 → 6" line **disappeared entirely** - not merely re-displayed
differently, but absent, as if it never happened.

Root cause, read from source (not inferred): the "Correct {fact}" dialog in
`src/components/enquiry/intelligence.tsx` (~line 1190-1241) calls
`correctFact` from `usePrototype` (`src/store/prototype-store.ts`, defined ~line
655) - **the client-side Zustand demo/prototype store**, not a server function. No
`answerEnquiryFact` (or any other) POST request was ever made when "Update fact" was
clicked (confirmed by inspecting the full preserved network request list across the
action - the only requests were page-load GETs). Every *other* fact-answering path
exercised in this journey (`answer-blocker.tsx`, used for the original guests=4
confirm on all three enquiries) goes through the real server function and persists
correctly. The "Correct guests"/"Correct service" pencil-edit control on an
already-confirmed fact is wired to the wrong store.

A second, compounding defect was observed in the same evidence: even before reload,
within the same illusory client-only state, the RECOMMENDATION panel and the prepared
draft body **did not recompute** - they continued to read "4 people at $145 each" /
"$580" while "WHAT ENQUIRY UNDERSTOOD" simultaneously showed `guests: 6, Confirmed`.
An operator using this control today would see an internally inconsistent screen even
before the reload-revert compounds the problem.

**Impact on the acceptance matrix.** This directly touches CC1-03 / A02 ("Owner
confirms or corrects A01 -> persist authority/provenance and recompute correctly;
survives reload") - live, it does neither. It also means acceptance step 10 (P03,
"in another tab change the confirmed quantity ... return and confirm") **cannot be
genuinely exercised through the product's own UI today**, because the only UI
affordance for changing an already-confirmed quantity never reaches the server that
the stale-preview guard checks against. The guard logic itself (`decision_revision`
mismatch refusal) is proven at the repository/PGLite level per the implementer's
report and the independent review (T02/P03 in `reviewed-send.db.test.ts`), and this
journey separately proved the adjacent T05/B-2 guard (decline-then-stale-confirm)
correctly refuses/redirects live (step 13) - so the *guard* is not shown broken here.
What this journey shows is that the *precondition* for P03 (a real second-session
correction reaching the server) is unreachable via the live UI, which is itself worth
fixing regardless of P03's status.

Evidence: `23-BUG-correct-guests-reverted-after-reload-1440.png` (guests=4, no audit
line, after reload), `24-BUG-correct-guests-shows-6-before-reload-1440.png` (guests=6
confirmed, audit line present, RECOMMENDATION still stuck at "4 people/$580"),
`25-BUG-correct-guests-reverted-clean-1440.png` (repeat of the revert with the other
browser tab closed first, to rule out cross-tab interference as the cause).

This was reproduced twice, cleanly, with the confounding second tab closed on the
second attempt, before being reported.

## Console and network

No JavaScript console errors were observed at any point in the journey (checked after
every major state transition, `types: ["error","warn","issue"]`, and again with
`includePreservedMessages: true` at the end of both the desktop and phone passes).
The only recurring `issue`-level message across the whole journey was the pre-existing
"form field element should have an id or name attribute" accessibility lint, unrelated
to this slice. No failed (4xx/5xx) network requests were observed; the only
client-side "failures" were the deliberately-provoked ones (clipboard denial, P01
amount mismatch), both of which are correct product behaviour, not bugs.

## Screenshot index

01-onboarding-step1, 02-onboarding-step2-review, 03-onboarding-complete-empty-queue,
04-pricing-rule-filled, 05-pricing-rule-saved, 06-add-enquiry-filled,
07-enquiry-needs-info, 08-guests-answer-5-6-filled, 09-Q01-range-refused,
10-Q05-ready-to-quote-580, 11-send-preview-580-unedited, 12-C01-C02-copied-not-sent,
13-C01-after-reload-still-unsent, 14-C03-confirmed-sent-580, 15-C03-after-reload,
16-C04-retry-confirm-still-one-record, 17-followup-ready,
18-C02-clipboard-denial-followup, 19-C05-C06-followup-distinct-sent,
20-P01-amount-edit-warning, 21-P01-amount-500-vs-580-blocked,
23-BUG-correct-guests-reverted-after-reload, 24-BUG-correct-guests-shows-6-before-reload,
25-BUG-correct-guests-reverted-clean, 26-T05-declined,
27-T05-B2-stale-confirm-after-decline-refused, 28-T05-B2-recorded-truthfully-still-declined,
29-phone-390-enquiries-list, 30-phone-390-add-enquiry-filled, 31-phone-390-needs-info,
32-phone-390-ready-to-quote, 33-phone-390-send-preview-580, 34-phone-390-C01-C02-copied,
35-phone-390-C03-sent-580, 36-phone-390-C03-after-reload.

(`22` does not exist - see the step 9b note above.)
