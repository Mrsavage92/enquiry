# 09 - Beta instrumentation and metric correctness

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
There is existing marketing event persistence and useful product audit data. There is also a prepared beta telemetry specification. The next step is to implement and verify that existing evidence contract, not design a second analytics platform or treat demo click events as live review evidence.

## T1 - Distinguish operational records, reviews and marketing events
**Priority: P1 evidence requirement before an evidence-led beta.**
`trackLaunchEvent` persists launch events server-side. The prototype store's `track` appends in-memory events centred on fixture IDs. The send-recording core records a server-derived edited flag in audit text. These are different sources with different meanings. They do not by themselves establish accepted/edited/rejected/deferred recommendation reviews, substantive versus voice edits, or repeated business value.

`docs/BETA_TELEMETRY_SPEC.md` already specifies a version-bound owner review, correction reasons and non-fixture activation. Preserve it. Copying must not count as acceptance or sending. Do not infer satisfaction from no correction, or infer a factual error merely because the customer changed their request.

## Recommended initial measures
1. **Meaningful activation:** distinct eligible beta businesses with a first non-fixture reviewable decision and a meaningful owner review. Record first-real-enquiry and first-review times; onboarding alone is not activation.
2. **Reviewed decision acceptance:** accepted / (accepted + edited + rejected), as the prepared spec defines. Report the denominator and separate deferred and unreviewed coverage. Capture whether edits were voice-only, substantive or a new customer update before deriving assisted-usefulness measures.
3. **Repeat useful use:** activated businesses making another meaningful non-fixture review on a later day within a defined observation window. Only include businesses with a complete window, and show underlying counts for a small cohort. This is a proposed definition, not an existing metric or target.

Guardrails: incorrect commercial decisions and false action records; lost corrections/failed saves; provider failure and unresolved requests. No benchmark targets, conversion improvement or actual cohort results are asserted here. Derive evidence from tenant-scoped product state where possible; add structured events only for facts not recoverable from that state. Do not export customer messages or contact details to marketing analytics.

## T2 - The current Insights rendering can mislead
**Priority: P2. Evidence: source.**
- Composition bars use `Math.max(4, ...)`, so zero gets a nonzero bar.
- 'This morning' is a fixed label over calculations without a corresponding time-window filter.
- Waiting age uses `enquiry.updatedAt`. Updating a note changes that timestamp, so it can make an old wait appear recent even though no customer replied.
- Several outcome mutations are still local, so a visual count can disagree with a reload until the journey is made durable.

The page explicitly calls its chart Composition and says it is not a conversion rate. Preserve that restraint rather than criticising it as an asserted conversion funnel.

**Recommendation:** render genuine zero; label the actual reporting period; calculate waiting from the relevant outbound-confirmed/wait-start event, not general record maintenance. Keep operational counts separate from product-quality and revenue claims.

## Acceptance
Prepare deterministic records with zero counts, deferred/unreviewed decisions, voice edits, substantive corrections, new customer facts, repeated reviews and incomplete observation windows. Reconcile metrics to database records. Editing an internal note must not reset the waiting clock. Verify event attribution, tenant scoping and decision versions, with idempotent writes and no raw customer content in launch events.

## Source map
- `docs/BETA_TELEMETRY_SPEC.md`.
- `src/lib/launch/api.ts`; `src/components/site/site-shell.tsx`.
- `src/store/prototype-store.ts`: `track`, persistence.
- `src/lib/repo/sent-reply-core.ts`: audit detail.
- `src/routes/_app/insights.tsx`; `src/domain/briefing.ts`.
- `src/lib/server/workspace.ts`: note updates.
