# Website form inbound - 2026-10-29

A business's own website enquiry form can now send each enquiry straight into Enquiry. Gloss Beauty (glossbeauty.com.au) is the first trial company.

## How it works

- **Endpoint:** `POST /api/inbound/form` (`src/routes/api/inbound/form.ts`, logic in `src/lib/repo/inbound-form-core.ts`). Public, no sign-in.
- **Inbound key:** each business can hold one key (`enqin_` plus 43 random base64url characters). Only its SHA-256 hash is stored, in `business_inbound` (migration `0016_inbound_form.sql`). The key can only create a new enquiry for its own business and cannot read anything, so it is safe in a public website bundle in the same way a web3forms key is. The owner sees it once, when it is created or replaced.
- **Sending the key:** in the body as `key`, or as an `X-Enquiry-Key` header. The Gloss site sends it in the body with `Content-Type: text/plain`, which makes the browser send a CORS "simple request" with no preflight. The header form needs a preflight, and the endpoint answers that too.
- **Payload (zod):** `submissionId` (8-100 chars, `[A-Za-z0-9_-]`), `name` (1-160), `email` (valid, max 320), `phone` (max 40), `service` (max 200), `eventDetails` (max 1000), `message` (1-4000), `privacyConsent: true`, `honeypot` (must be empty). The body is capped at 16 KB.
- **Same path as a paste:** accepted submissions go through `createEnquiryAndRead` (`src/lib/repo/enquiry-intake-core.ts`), which `createManualEnquiry` now also uses: `insertManualEnquiry` in one transaction, an audit line, then the best-effort `interpretAndApply`. Name, email and phone fill the customer fields. The message, then `Service: ...` and `Event details: ...`, become the enquiry text. The enquiry is recorded with source `form`, message channel `form` and intake `channel`, and the desk shows it as "Website form".
- **The customer's service pick is not the owner's confirmed service.** It goes into the text for the engine to read, never into `serviceLabel`, because a typed service is recorded as an owner-asserted confirmed fact.
- **Idempotent:** `inbound_submission` has the primary key `(business_id, submission_id)`. The submission id is claimed inside the creating transaction, so a retry or a concurrent duplicate gets 202 and creates nothing. Ids are kept for 30 days.
- **Rate limits:** 30 accepted submissions per business per hour, and 5 per visitor (SHA-256 of business id and IP, never the raw IP) per business per hour, counted in the database so every serverless instance sees them. There is also a per-instance in-memory limit of 30 requests per IP per minute in front of the key lookup.
- **CORS:** answered from `business_inbound.allowed_origins`, set per business by the owner, never hardcoded. A POST whose `Origin` is not on that business's list gets 403 and nothing is written. A request with no `Origin` (not a browser) is authorised by the key alone.
- **Responses:** `{"ok":true}` or `{"ok":false}` only. 202 accepted or already accepted, 400 invalid (honeypot included), 401 unknown key, 403 origin not allowed, 413 too large, 429 too many, 500 unexpected (reported through `reportServerError`).
- **Owner side:** Settings, "Website form": create or replace the key (shown once), and list the allowed websites. Server functions are in `src/lib/server/inbound-key.ts` (`getInboundKeyStatus`, `rotateInboundKey`, `setInboundOrigins`), each behind `authMiddleware` plus `requireBusinessAccess`. Replacing the key stops the old one at once.

## Tests

`src/lib/repo/inbound-form.db.test.ts` (PGlite, every migration applied). It covers: unknown key gets 401 with nothing written; a valid key creates exactly one enquiry for the right business; form and paste produce the same decision and facts; a replay or a three-way race creates no duplicate; the honeypot is rejected; invalid payloads are refused; two tenants (the other key never writes into Gloss, a smuggled `businessId` is ignored, the owner functions throw Forbidden and change nothing); CORS per business; rotation; rate limits; origin normalisation.

## Go-live steps

1. Apply `migrations/0016_inbound_form.sql` to production Supabase (project `qzzvxfbitixpmfuirvhq`) as the owner role, then `insert into _migrations (name) values ('0016_inbound_form.sql');`. Do this BEFORE the PR merges. `0014_laser_send.sql` (PR #81) and `0015` come before it; `0016` has no dependency on `0014`.
2. Merge the PR and run `bash scripts/verify-live.sh`.
3. Louise signs in at https://enquiry-ashy.vercel.app/login with glossbeautylouise@gmail.com and creates her workspace.
4. In Settings, "Website form": Create key, copy it, and save the websites `https://glossbeauty.com.au` and `https://www.glossbeauty.com.au`.
5. In the Gloss site's Vercel project (production) set `VITE_ENQUIRY_INBOUND_URL=https://enquiry-ashy.vercel.app/api/inbound/form` and `VITE_ENQUIRY_INBOUND_KEY=<the key>`, merge the Gloss PR (branch `claude/enquiry-inbound`), and redeploy. Vite inlines these at build time, so a redeploy is needed after setting them.
6. Send one test enquiry from the live Gloss contact page. Check that Louise's email arrives AND the enquiry appears once in Enquiry as "Website form".
