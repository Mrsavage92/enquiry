# 05 - Empty, loading, failure and uncertainty states

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
The initial workspace-loading boundary is substantially more careful than several mutation and recovery paths. Bring the latter up to the same standard: a failed request, a saved record that failed to refresh, and an unsupported capability are different states.

## Keep
`WorkspaceGate` distinguishes pending authentication, no workspace and failed workspace loading. It offers a retry instead of falling back to fixture data. Raw enquiry persistence precedes best-effort interpretation. Those safeguards should remain.

## E1 - A committed mutation followed by failed refresh looks like a failed save
**Priority: P1 reliability. Evidence: source trace; fault injection not run.**
`useFirstBetaActions().addEnquiry` waits for creation, then awaits a workspace refresh before returning the ID. If creation succeeds but refresh fails, `AddEnquiry` displays an add error and retains the form. Retrying can create another enquiry because this creation request has no stable client request ID in the inspected input.

Other writes, including note and snooze, update local state before their server calls. The phone closes the note sheet or advances after snooze without awaiting confirmed success. A toast alone does not reconcile the displayed state. Trust controls have the related problem described in review 02.

**Recommendation:** distinguish `saving`, `saved_refresh_failed`, `failed_before_save` and `ready`. Preserve a server receipt once a mutation commits. Retry the read rather than the creation when appropriate. Use idempotent creation or stable request identity where an acknowledgement can be lost. Roll back optimistic changes or clearly show an unsaved state. Do not invent a durable offline outbox merely by keeping data in memory.

## E2 - Empty and unknown states sometimes tell the wrong story
**Priority: P2. Evidence: source.**
The live Needs you empty message uses 'first enquiry' even when the business may already have waiting or closed enquiries. The not-found route still mentions a 'fixture set'. The intake success toast says Enquiry is working on it after the server has awaited interpretation, including a possible null/failure outcome. That wording can imply work continues when no subsequent job is scheduled.

The interpreter schema accepts ambiguities and candidate missing facts, but the inspected application path persists candidate facts/service rather than those ambiguity arrays. Validate that decision-critical ambiguity remains visible rather than assuming schema presence means the UI displays it. Not every model-suggested missing field should become a blocker.

**Recommendation:** explicitly distinguish no enquiries, no items in this filter, no search results, missing/inaccessible record, reading failed, unsupported service, and unknown availability. Preserve a useful next action for each. Expose the original message alongside an honest manual correction path when interpretation fails.

## Acceptance
Inject database-write rejection, committed-write/failed-refresh, provider timeout, absent provider, stale session and network loss. Verify no duplicate intake, no false success, no discarded typed content and no fixture fallback. Test empty filters with existing waiting work. Ensure uncertainty is neither hidden nor turned into confidence by a cosmetic change. Runtime verification remains outstanding.

## Source map
- `src/components/shell/workspace-boundary.tsx`.
- `src/lib/workspace/live-mutations.ts`: `refresh`, `addEnquiry`, note/snooze/trust mutations.
- `src/components/enquiry/add-enquiry.tsx`; `phone-desk.tsx`; `queue.tsx`; `workspace.tsx`.
- `src/lib/repo/manual-enquiry-core.ts`; `src/lib/interpret/types.ts`.
