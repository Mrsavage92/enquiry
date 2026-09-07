# 07 - Homepage positioning and product proof

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
Keep the decision-layer positioning, but distinguish demonstrated behaviour from the current live capability more locally and isolate the interactive proof from the owner's working data. This is a functional boundary issue as well as a marketing review.

## Keep
The site already has a decision demonstration, phone proof, a dark section and early-access caveats. It says access opens gradually and paid pricing will be shared before paid access begins. Do not invent the need for another dramatic section or claim all caveats are absent.

## H1 - The homepage's interactive phone shares live operator state
**Priority: P1 boundary correction. Evidence: source trace, not a reproduced public data leak.**
`LivePhone` reads the global prototype store and chooses the requested fixture ID or falls back to `s.enquiries[0]`. It renders `PhoneDesk` directly, and its Start again button invokes `restoreFixture` on that same store. `SiteShell` does not supply an isolated demo store, and the root AuthProvider is a passthrough.

On a client-side visit to the homepage after live workspace hydration, this path can select a cached real enquiry rather than the advertised sample. Resetting the example can insert a fixture into the live cache. The same signed-in owner seeing their data is not evidence that an unauthenticated stranger received it. No server tenancy bypass was demonstrated. The issue is public-demo and live-workspace UI state sharing and possible misrouting of live actions through a marketing component.

**Recommendation:** a dedicated demo data/action context or genuinely isolated demo surface. Never use a real enquiry as fallback content for a sales example. Demo reset and all embedded actions must be incapable of touching the live cache or live mutation endpoints. Do not fix this by globally switching the signed-in store into demo mode.

## H2 - Make the proof and the current capability legible
**Priority: P2, with factual copy corrected before public traffic.**
The opening explanation remains abstract, while the live decision code is currently primarily price/blocker/escalation driven. Some public sections describe broader per-business checks and cross-channel behaviour. Label the interactive demonstration clearly as a sample and state the current manual/review-first capability near the relevant claims, rather than relying solely on 'early access' elsewhere.

Keep 'Stop managing enquiries.' unless the owner chooses otherwise. Test a compact example of one changed fact changing the next action, or one refusal to guess, near the opening content. Use a real isolated demonstration or labelled recording; do not fabricate a connected customer inbox. The goal is immediate understanding, not an unmeasured conversion claim.

The prior palette proposal remains a design proposal. No colour or layout change is authorised by this review.

## Acceptance
Navigate live app -> homepage -> app in one tab, reset and interact with the example, and compare live cache/database before and after. Also test signed-out and signed-in visitors. The demonstration must always remain sample-only. Test whether a new visitor can distinguish current beta, sample proof and roadmap aspiration. This review could not open the live deployment, so no fresh first-screen, animation or visual-quality claim is made.

## Source map
- `src/components/site/live-phone.tsx`; `site-shell.tsx`.
- `src/routes/index.tsx`; `src/routes/__root.tsx`; `src/lib/auth/provider.tsx`.
- `src/store/prototype-store.ts`: `restoreFixture`.
- `src/domain/decide.ts` and the existing visual-direction review.
