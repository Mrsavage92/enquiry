# CC1 browser recheck - A02 fact correction and P03 stale preview

Executed 2026-09-07 (Australia/Brisbane) against `cc1/commercial-correctness`
at `e037517`, after the fix for the browser-journey finding in research doc 38.

Scope is deliberately narrow: the two acceptance rows that the client-side
correction control blocked. It does not re-run the full 13-step journey - that
remains as recorded at `58b5679/browser-journey/`.

## Environment

- Dev server `npm run dev -- --port 5178`, `VITE_AUTH_ENABLED` **not set**.
  Real auth confirmed via `GET /__app-env`, which returned `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` and no bypass override.
- No `DATABASE_URL` anywhere, so all application data lived in the in-process
  PGLite instance for the life of the dev server.
- Real Supabase Auth, project `qzzvxfbitixpmfuirvhq`. Disposable user
  `cc1-a02-recheck@example.com` created by direct `auth.users` insert, session
  via password grant, token written to
  `localStorage["sb-qzzvxfbitixpmfuirvhq-auth-token"]`.
- `.env.local` was copied into the worktree to supply the Supabase keys and
  deleted afterwards. It is gitignored (`.env.*`); `git status` was clean
  throughout.
- Browser: chrome-devtools MCP at 1440x900.

## Setup

Business "CC1 A02 Recheck" (mobile makeup, Brisbane, owner Jordan), one pricing
rule - Group makeup, AUD 145 per person, quantity fact `guests`, no minimum.
One genuine pasted enquiry, "Alex Reid"
(`ee816c6f-eed0-46d3-9ced-d59ece02f3a2`), which arrived correctly blocked on
`guests`. Confirmed `guests = 4`, giving "Send the quote / 4 people at $145
each."

## Results

### A02 - correcting a confirmed fact (was: client-store only, reverted on reload)

1. Opened the "Correct guests" pencil control and changed 4 to 6.
2. `window.fetch` was instrumented before the submit. The correction fired
   **exactly two** requests, both to the server:
   - `/_serverFn/...enquiry-actions.ts...answerEnquiryFact_createServerFn_handler`
   - `/_serverFn/...workspace.ts...fetchWorkspace_createServerFn_handler`
   Before the fix this control fired **zero**.
3. The recommendation recomputed in place to "6 people at $145 each."
4. **Page reloaded.** The desk still showed `guests = 6 Confirmed` and "6 people
   at $145 each." - screenshot `A02-corrected-6-after-reload.png`.

**A02 verified live.** The correction reaches the server, persists, recomputes
the decision and survives a reload.

### B-1 - the composed draft, confirmed live

Opening the send preview on that enquiry produced, and the server accepted:

> That comes to $870. 6 people at $145 each.

with AMOUNT $870 - screenshot `P03-preview-frozen-870.png`. This is the
two-figure body that returned `amount_mismatch` before the B-1 fix. It is the
first live confirmation of that fix; the earlier journey could not reach it.

### P03 - a stale approval cannot be paired with a new amount

1. Left the preview above open, frozen against the $870 decision.
2. In a **second browser tab** on the same enquiry, corrected `guests` to 5.
   The enquiry moved to "5 people at $145 each." ($725).
3. Returned to the first tab and pressed "I've sent this externally".

The server refused it:

> This enquiry has changed since that message was prepared. Review it again -
> or, if you already sent that older message, say so and Enquiry will record it
> as it was.

and the primary control changed to "I already sent that older message", the P04
attestation path. Screenshot `P03-stale-preview-refused.png`.

4. Reloaded the second tab: "Needs you 1", "Waiting 0", recommendation still
   "Send the quote / 5 people at $145 each." **No outbound message and no quote
   were recorded, and the enquiry did not advance.**

**P03 exercised for the first time.** It was previously unreachable, because
there was no server-side way to change a confirmed quantity underneath a frozen
approval.

## Cleanup

- `public.business` rows named "CC1 A02 Recheck": **0**.
- `public.business_member` rows for the test user: **0**.
  (Both confirm application data stayed in PGLite and never reached the shared
  Supabase Postgres.)
- The disposable `auth.users` row was deleted; the delete returned the one row.
- `.env.local` removed from the worktree.

## Not covered by this recheck

The other eleven journey steps were not re-run; nothing in this change touches
them. The demo-mode correction path (which still uses the local store, now
explicitly gated) was not exercised in a browser.
