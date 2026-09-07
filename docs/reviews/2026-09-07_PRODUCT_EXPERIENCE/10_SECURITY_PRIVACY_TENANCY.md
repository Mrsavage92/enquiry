# 10 - Security, privacy and tenancy

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict and limits
Useful controls exist, but this review does not certify tenant isolation or production security. No live endpoint penetration test, real two-account test, secret rotation, deployment configuration inspection or provider-backed adversarial evaluation was performed. No cross-tenant exploit or unauthenticated disclosure was demonstrated.

## Preserve the existing boundaries
The inspected middleware verifies the user through Supabase, applies a request-origin guard and re-derives membership on product access. Auth-disabled plus a real database fails closed. Workspace queries are scoped through the verified user's business memberships. Public fixture quote links are deliberately unavailable in an authenticated build. Raw intake is saved before model interpretation, and proposed facts retain an unconfirmed status.

The tenancy code documents a table-owner database connection that bypasses RLS. This makes application permission checks particularly important; it is not, by itself, evidence that a tenant can access another tenant's data. Keep per-request checks and add adversarial endpoint proof rather than assuming schema RLS settings cover them.

## S1 - Privacy disclosure contradicts implemented live storage
**Priority: P1 before collecting real customer content. Evidence: source-confirmed mismatch.**
The privacy page says anything typed in the operator app stays on the device for the session and is not a kept customer database. Live intake writes customer and message records to the server. With a configured Anthropic interpreter, raw message content and business context are sent to that provider. The current notice does not describe those live paths.

**Recommendation:** make a precise data map and update the notice to distinguish waitlist, isolated demo and signed-in product. State actual storage, processing purposes, provider categories, retention/deletion choices and a usable contact route. Verify deployment-specific facts before publishing them; do not invent data residency, retention periods, model-training exclusions or certifications. This is a factual product/disclosure review, not a legal compliance opinion.

## S2 - Bind the client cache to identity, not just 'signed in'
**Priority: high-priority verification risk. Evidence: source, not reproduced account leakage.**
`useWorkspacePhase` depends on the session phase string, hydration callback and retry attempt, but not the user's ID. `useCurrentUserState` can update the identity from auth events. A direct identity change that remains 'signed-in' therefore deserves an explicit cache-purge/refetch test. Ordinary sign-out performs a full-page redirect, which mitigates that particular path; do not ignore it or call every account switch vulnerable.

Test membership revocation and responses arriving after an identity change. A permission check on a new request does not automatically remove already cached data from an open page. The public-demo/global-store issue is separately detailed as H1; it is not counted as a demonstrated cross-user server leak.

## S3 - Strict JSON is not proof that evidence came from the message
**Priority: P2 safety hardening. Evidence: source.**
The interpretation schema limits keys, fields, lengths and fact counts. It accepts `span` as a string, while the adapter asks the model for an exact supporting substring. The inspected adapter/application path does not validate that substring against the original message. It can therefore accept invented provenance in an otherwise valid response shape. Presence in the message is only a necessary check, not proof of semantic support.

Validate spans against the exact source and retain ambiguity. Exercise prompt injection, instruction-like customer text, malformed output, duplicated facts, negation and conditional acceptance. Keep deterministic commercial authority and human confirmation regardless of model claims. Test provider timeouts, concurrency, request limits, log redaction and cost controls; no production settings are verified here.

## Executed, bounded checks
Two dependency-free modules were reconstructed from complete connector content and matched against their Git blob hashes. Node v22.16.0 ran 12 diagnostic cases: 7 passed and 5 failed. Four passes are the public-link guard truth table; three are ordinary intent-parser cases. Five failures show the legacy reply parser treating negations, a question or a condition as acceptance.

The inspected simulated reply timer invokes that parser only under demo-mode gating; the no-account customer route is also contained. These failures are a warning against promoting that parser to real automated acceptance, not evidence that a live server presently books those messages. See `EVIDENCE.md` and `probes/review.probe.ts`.

## Required security acceptance before beta
Use separate legitimate accounts/tenants plus an unauthenticated client. Attempt every product read/write with another tenant's business, enquiry, fact and booking identifiers. Test revoked membership, expired token, forged client user ID, cross-site request, replayed request and stale identity responses. Verify public-demo isolation without weakening public-link guards. Check that logs/analytics omit tokens and unnecessary customer text. Review retention/deletion and actual provider deployment settings. Publish sanitised evidence tied to the candidate commit; do not put secrets or real customer examples in this public repo.

## Source map
- `src/lib/auth/middleware.ts`, `verify.server.ts`, `isolation.server.ts`, `client.ts`, `use-current-user.ts`.
- `src/components/shell/workspace-boundary.tsx`; `src/lib/repo/tenancy.server.ts`; `workspace.server.ts`.
- `src/routes/privacy.tsx`; `src/lib/server/enquiry-actions.ts`; `src/lib/repo/manual-enquiry-core.ts`.
- `src/lib/interpret/types.ts`, `index.server.ts`, `anthropic-interpreter.server.ts`.
- `src/lib/public-links.ts`; `src/routes/q/$enquiryId.tsx`; `src/domain/client-intent.ts`.
- Primary OWASP and W3C references are in `EVIDENCE.md`.
