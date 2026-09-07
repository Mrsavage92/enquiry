# 02 - Business Brain and Trust

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
The main issue is not simply density. Controls presented as ways to teach the same business use different authority and persistence models. Make those consistent before changing their visual layout.

## B1 - The natural-language teaching path is still a prototype path
**Priority: P1. Evidence: source trace.**
`BrainScreen` renders both `PricingRules` and 'Tell Enquiry' for a live business. `PricingRules` saves a typed payload through a server action. 'Tell Enquiry' calls `compileBrainChange`, followed by local `confirmBrainChange`. Voice and learning actions also use local store mutations in the inspected path.

The prototype compiler requires an existing knowledge target; a new empty business can enter text and get no preview at all. Its heuristics can select the first Active pricing item when the wording does not match. It can also add fixture-style commercial details, such as a four-hour minimum for hourly/event wording. `knowledgeAfterPreview` creates a prose item without the typed pricing payload used by the live compiler. The screen can thus look updated while the next server calculation still uses a different rule.

**Recommendation:** use one proposal/confirmation/persistence pipeline for supported teaching. Proposed text must preserve the owner's meaning, expose the exact structured rule and show affected open enquiries before confirmation. An unsupported statement should be retained as an unconfirmed note or explained as unsupported, not silently ignored or turned into a price. Keep prototype teaching explicitly demo-only until a live path exists. Do not replace the entire Brain with a generic rules builder.

## B2 - Trust settings need to describe real capability and confirmed state
**Priority: P1 for save-failure truthfulness; P2 for simplification.**
The current screen has Private/Observe/Assist choices, per-action automation choices, integration permissions and pause controls. These are distinct concepts, but their short descriptions can make them appear interchangeable. 'Private' describes no mailbox; it does not establish that pasted text is processed only on the device. A configured interpreter can send that text to a model provider.

`useLiveTrustMutations` updates the local state before the server request. Its failure path reports a toast, but does not undo the local change. A failed pause or policy update can continue to look applied. Enabling an automatic policy also calls the prototype autopilot function locally. Live decision snapshots currently default to ineligible for automation, so this review does not claim a real automated send was demonstrated.

Trust Access still contains store-only connection callbacks when an integration row is present. A new workspace has no such provider rows, so distinguish this conditional exposure from a connection button every new user can actually press.

**Recommendation:** show 'Available now', 'Not connected' and 'Not supported yet' distinctly. A policy preference is not a provider capability. Keep stop controls prominent, but show pending/failed saves accurately. Avoid offering live automation activation until the full server-authorised capability exists and is gated.

## Presentation recommendation
Organise around owner questions: 'What Enquiry knows', 'What needs my confirmation', 'What Enquiry may do' and 'What happened'. Keep provenance, authoritative versus proposed rules, and per-enquiry versus business-wide scope. A simpler interface must not hide those distinctions.

## Acceptance
Create a rule, amend it through every available teaching route, confirm it, reload and quote a new enquiry. Verify one consistent amount and version. Confirm that a new empty Brain produces an honest result for unsupported teaching. Inject a failed trust update and verify the displayed state returns to server truth or clearly remains unsaved. Validate that enabling an unsupported capability creates neither a fake connection nor a fake sent record.

## Source map
- `src/components/business/brain-screen.tsx`; `src/components/business/pricing-rules.tsx`.
- `src/domain/brain-apply.ts`: `matchKnowledge`, `compileBrainChange`, `knowledgeAfterPreview`.
- `src/store/prototype-store.ts`: teaching, voice, policy and autopilot actions.
- `src/components/trust/trust-screen.tsx`; `src/lib/workspace/live-mutations.ts`.
- `src/lib/interpret/index.server.ts`; `src/lib/interpret/anthropic-interpreter.server.ts`.
