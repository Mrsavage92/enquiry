# 06 - Product language and state vocabulary

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
Some wording is a genuine usability choice; other wording describes something that has not happened. Fix the state truth first, then simplify the vocabulary. A copy change must not conceal an implementation gap.

## Keep
'What the customer said', 'What you charge', 'Nothing sends without your approval' and the refusal to treat silence as rejection are understandable concepts. Preserve their meaning while making current manual capability explicit.

## L1 - Use a small vocabulary tied to authoritative events
**Priority: P2 generally; P1 where a label asserts an unperformed action. Evidence: source plus design judgement.**
Proposed dictionary:

| Current term/context | Proposed wording or rule |
|---|---|
| Send / Copy and record as sent | Copy reply, then separately Confirm sent externally. CC1 owns the actual state change. |
| Booked. Handed off. | Show Booked only for recorded booking; show handoff separately only with evidence. |
| They asked a question | Add their reply. Ask for the actual text; do not insert sample dialogue. |
| Waiting for the first enquiry | Paste your first enquiry only when there are none; otherwise Nothing needs you in this filter. |
| Read this one | A specific next step: Confirm the service, Add a pricing rule, or Review this request. |
| Private | Describe intake and model-processing boundaries explicitly; do not imply local-only processing. |
| Commercial value | Quote amount, Estimate, or no price concept when irrelevant. |
| Hold | Specify date hold, deposit requested or deposit received. These are not interchangeable. |
| Today / Done on phone | Use the same conceptual grouping as desktop; do not imply a date filter or fulfilled work that is not represented. |
| Fixture set in an operator error | This enquiry is unavailable in this workspace; offer a safe return/retry path. |

Do not mechanically replace every use of 'Trust' or 'Business Brain'. Those names may remain if their contents answer owner questions. The issue is the work needed to interpret them and whether their promises are true.

## Separate business facts from UI interpretations
Prepared is not sent. Customer accepted is not payment received. A proposed rule is not an active rule. A configured policy is not an available integration. Unknown is not unavailable. The same definitions must drive server transitions, component labels, audit wording and metrics.

The fixed 'This morning' Insights label is not backed by a corresponding time filter in the inspected calculations. Context-dependent time language should come from an actual reporting period, not be decorative copy.

## Acceptance
Create a small state-to-language contract shared across desktop, phone, previews and audit. For each critical action, a tester should answer what has happened, what remains unknown, who acts next and what the button does. Test with representative service-business owners before treating terminology preferences as proven. Do not expose internal enum names as the only explanation. Check copy for unavailable integrations and model failure as well as happy paths.

## Source map
- `src/components/enquiry/waiting-desk.tsx`; `queue.tsx`; `workspace.tsx`; `add-enquiry.tsx`.
- `src/components/trust/trust-screen.tsx`.
- `src/components/shell/app-shell.tsx`; `src/routes/_app/insights.tsx`.
- `src/domain/decision-snapshot.ts`; `src/domain/status-tone.ts`.
