# CC1 - Acceptance matrix and verification gate

Status at package creation: **implementation pending**. This is the specification of required evidence, not a record that these checks passed.

Use synthetic non-fixture data and disposable tenants/databases. Amounts below are test values, not actual business tariffs or customer incidents. Tie every result to the actual tested commit. Add the tests to the default discovered suite where possible.

## Core scenarios

| ID | Input / action | Required result and proof |
|---|---|---|
| Q01 | AUD 100/person; confirmed `5-6`, no billing floor | Not exact AUD 5,600; preserve unresolved meaning or reject clearly. Test server input and decision path. |
| Q02 | Same rule; `4 or 5` | Not exact AUD 4,500. No destructive text stripping. |
| Q03 | Same rule; `-5` | Not exact positive AUD 500. |
| Q04 | Empty/whitespace, zero, malformed decimal, multiple quantities, excessive/overflowing quantity | Deliberate validated result; no fabricated or non-finite exact price. Define valid zero handling, not a blanket guessed rule. |
| Q05 | Confirmed 4 people at AUD 145 | Exact AUD 580; ordinary case remains supported. |
| Q06 | 2 people at AUD 145, minimum billable 3 | Exact AUD 435 under the existing rule semantics. |
| Q07 | A legitimately fractional hourly/area quantity | Supported precision preserved; no universal integer coercion. |
| S01 | Bridal makeup AUD 190 and Event makeup AUD 170; request `makeup` | Explicit service ambiguity/owner choice, not first-match pricing. |
| S02 | S01 with rule order reversed | Same semantic outcome and choices; ordering cannot change the price/decision. |
| S03 | Same service with different simultaneous Active prices | Conflict or explicit authorised version selection, never incidental array order. |
| S04 | No match, one confirmed exact match, identical duplicate rule and deliberate alias | Correct distinct outcomes; do not regress valid matching or invent aliases. |
| S05 | Save/update a price where an Active rule already exists | Explicit supersession/versioning or surfaced conflict; historical price preserved. |
| A01 | Blank service; model proposes a matching fixed-price service marked `check_this` | Not an already-confirmed commercial decision. Provisional display, if any, is explicit and cannot bypass server approval. |
| A02 | Owner confirms or corrects A01 | Persist authority/provenance and recompute correctly; survives reload. |
| A03 | Manual service entry, model absence/error and legacy nonblank service without authority evidence | Deliberate confirmation path; no hidden promotion because a label exists. |
| A04 | Model result arrives after an owner changes service/fact | Owner value and authority remain; snapshot reflects current state. |
| C01 | Prepare/review/copy, then abandon without external confirmation | No outbound `sent_at`, no sent quote row, no automatic customer responsibility/WAITING transition. |
| C02 | Clipboard success, denial, missing API, manual copy and dialog cancellation | Accurate feedback; none is itself proof of sending. |
| C03 | Owner confirms an actual external send | One durable owner-attested outbound message, the correct quote if applicable, and valid state transition. Reload confirms it. |
| C04 | C03 double-click, concurrent identical submission, response lost, failed workspace refetch, refresh/reopen and retry | Same logical send recorded once, including one quote version. No false error-induced duplicate. |
| C05 | Two genuinely different external follow-ups | Both recordable with distinct identities; idempotency does not suppress legitimate messages. |
| C06 | Main composer and waiting/follow-up path, desktop and phone | Shared review/copy/confirm semantics; neither retains copy-as-sent behaviour. |
| P01 | Prepared AUD 580; edit amount in text to AUD 500 | Server prevents inconsistent recording or deliberate structured change produces reviewed text and quote both at AUD 500. Warning-only is a failure. |
| P02 | Tone-only edit | Retained correctly with unchanged structured amount; editable prose is still usable. |
| P03 | Open preview; change quantity/service/rule in another session; initiate a new approval/action | Stale review rejected/refreshed or revalidated explicitly. Never pair old text with the new snapshot amount. |
| P04 | Owner already sent the previously approved older quote, then current enquiry changes | Record actual historical body and reviewed amount/revision truthfully; flag newer-state conflict rather than silently advancing it or losing evidence. |
| P05 | Crafted client amount/recipient/revision/edited values or direct handler call | Server validates authority, ownership and reviewed-content consistency. UI checks cannot be bypassed to create an inconsistent quote. |
| T01 | Failure after fact/service change but before snapshot/audit completion | Related writes roll back consistently; no new fact with stale saved decision. |
| T02 | Overlapping owner edits and interpreter completion in controlled order | No stale snapshot overwrite, duplicate authoritative active facts or model supersession of owner truth. |
| T03 | Failure during message/quote/state/audit persistence | All required record components commit together or none; retry works. |
| T04 | Concurrent logical-send retries and distinct sends | Correct uniqueness/version behaviour against the database engine used; no swallowed aborted transaction masquerading as success. |
| T05 | Decline/close while old preview or interpretation is in flight | No stale write silently reopens/requotes the closed enquiry. |
| I01 | User A calls each changed endpoint with tenant B's IDs/review token | Denied, no writes, no leaked commercial content. Use endpoint/auth-level tests as well as repository tests. |
| I02 | Explicit demo and fresh signed-in tenant | Demo still works; live tenant has no fixture business/enquiry/arrival leakage. |
| I03 | Null interpreter, provider error, invalid model output and prompt-like customer content | Raw inbound persists; no promoted rule/action authority or lost enquiry. |

The three quantity probes, service ambiguity/order probes and unconfirmed-service compiler probe are diagnostic seeds for the reviewed source. They are not complete tests for this matrix. Adapt to deliberate API/type changes only while preserving or strengthening the business invariant. A pure compiler may calculate a provisional amount if integration tests prove it cannot become an authorised quote until explicit confirmation.

## Evidence levels

- Domain tests prove pure decisions and parsing, not database persistence.
- Repository/PGLite tests prove exercised SQL/transaction behaviour, not every production concurrency schedule.
- Controlled multi-connection PostgreSQL tests are required before claiming true concurrent-write races are resolved. When unavailable, mark that gate blocked and state exactly what narrower test did run.
- Signed-in browser checks prove the exercised live path, not all paths or real-provider model quality.
- Provider quality requires actual provider cases; injected failures and skipped cases must retain those labels.

## Browser journey

Create a disposable signed-in non-fixture business with synthetic rules. Add a genuine new pasted enquiry, confirm/correct a blocking fact, review the correct price, copy without confirming, reload and verify it remains unsent. Explicitly confirm external sending and reload to verify one consistent sent record. Repeat with clipboard denial, amount edit, stale preview and a follow-up. Check a supported desktop viewport and a phone viewport around 390px; capture console/errors and evidence for both.

No real customer message needs to be sent by a provider. The test owner can attest a synthetic external-send event in a disposable workspace. Clearly label it as a test; do not place fictitious commercial records in a production tenant. Browser screenshots of fixtures alone do not satisfy this gate.

## Required command ledger

Record the working tree/commit, environment (without secrets), exact command, exit code, test counts and evidence path for each:

```sh
npm test
npm run typecheck
npm run check:auth
npm run lint
npm run benchmark:r2e
npm run build
```

Also record the actual targeted test commands and browser/database harness commands. Inspect the current package scripts first. `npm run build` invokes `db:migrate`; require safe disposable/non-production database configuration. If unavailable, do not run against production and do not claim a build pass. Keep auth checks enabled.

## Gate decision

Ready for independent review only when each CC1 ID is mapped to implementation and evidence, required focused commercial tests pass, regressions are classified against a real baseline, necessary migrations have safe evidence and both client recording paths are covered. Missing required evidence means blocked verification, not passed acceptance.

Passing CC1 does not itself sign off R2B-R2F, real-model quality, external beta use, credential rotation, SMTP/auth production readiness, public claims or PWA work. The independent reviewer owns the sign-off and next-slice decision.
