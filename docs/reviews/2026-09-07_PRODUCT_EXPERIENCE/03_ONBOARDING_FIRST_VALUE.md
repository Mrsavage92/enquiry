# 03 - Onboarding and the first useful decision

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
Do not rebuild onboarding as another long setup wizard. It is already two stages and waits for server creation before entering the workspace. The larger opportunity is the transition from an empty workspace to a useful, reviewed decision.

## Keep
Only the business name is required to continue. The browser time zone is detected and can be changed. The workspace-creation error keeps entered details available for retry. Fixture seeding is deliberately excluded. These are useful existing choices, not missing work.

## O1 - Setup completion is not activation
**Priority: P2, important before formative beta. Evidence: source and proposed workflow.**
Onboarding lands on the enquiry queue, where manual intake exists. The live empty message says 'Waiting for the first enquiry' and 'When someone writes in, it lands here', despite there being no connected inbox in this slice. A service-business owner can reasonably wait for an arrival that requires their own paste action.

Pricing setup lives elsewhere in Business Brain and requires the owner to name the quantity field. Default examples in intake and price setup still lean on makeup, people and guests for arbitrary businesses. The 'small team' and 'studio' choices both persist as `team`, so the screen should not imply that precise team size has been configured for capacity decisions.

**Recommendation:** offer one explicit next step, 'Paste an enquiry', followed by only the business knowledge needed to review that request. For the supported priced slice, ask for one missing price as part of that journey. For unsupported requests, provide a truthful owner-review path rather than pretending the business has been learned. Do not require mailbox integration or an entire catalogue before showing value. Label optional details clearly and use owner-specific or neutral examples.

A useful proposed sequence is: business basics -> paste request -> confirm the relevant service/rule -> review the next step. It is a proposal, not a claim that this sequence is implemented.

## O2 - The contact field's label and storage disagree
**Priority: P2 data correctness. Evidence: source trace.**
`AddEnquiry` labels one input 'Email or phone (optional)', but stores its value in `customerEmail` and submits no `customerPhone`. The server supports separate fields. A phone number entered as invited is therefore placed in the email field.

**Recommendation:** separate contact type explicitly or parse it with an owner-confirmable type. Preserve the original value, validate according to the selected type and leave unknown contact data unknown. No messaging integration is needed for this correction.

## Acceptance
A new owner can identify the manual nature of intake, add a non-fixture request and reach one meaningful review without visiting unrelated settings. An email and a phone-only contact must populate the correct fields. Test no price, no provider, an unsupported service, an empty business and an onboarding retry. Measure actual time and completion behaviour; no target time or conversion uplift has been established by this review.

## Source map
- `src/routes/onboarding.tsx`: two-stage flow, `canContinue`, `finish`, team mapping.
- `src/components/enquiry/queue.tsx`: live intake and empty-state text.
- `src/components/enquiry/add-enquiry.tsx`: inputs and submitted payload.
- `src/components/business/pricing-rules.tsx`: supported rule entry and default fields.
- `src/lib/server/enquiry-actions.ts`: manual intake fields and pricing persistence.
