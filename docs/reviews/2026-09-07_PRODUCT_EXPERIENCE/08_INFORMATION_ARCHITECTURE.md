# 08 - Navigation and information architecture

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
Do not add more destinations before each one has a clear purpose and a truthful live action set. The current navigation reflects product components more than the few decisions an owner makes, but a wholesale restructure is not yet justified by user evidence.

## I1 - Review destinations by task and capability
**Priority: P2. Evidence: source and design judgement.**
Desktop exposes Enquiries, Bookings, Insights, Business and Trust. Phone navigation uses Today, Booked and More. Within the case, two different More menus expose different action sets. Brain has nine desktop tabs, but only three phone tabs. These differences are not automatically bad; they need task-parity tests and consistent concepts.

A useful candidate architecture is: Enquiries as the daily work surface; recorded outcomes/bookings as the completed enquiry record and handoff boundary; Business for knowledge and operating preferences; clearly accessible permissions, pause and activity history. Insights can be secondary until it supports a real beta decision. Do not hide a safety pause simply to shorten the navigation.

Keep a booking/outcome record where it completes the first-enquiry-to-booked/lost promise. Do not expand local reschedule/deposit controls into a full fulfilment system just because a calendar is already drawn. Such controls need real persistence or explicit containment, as review 01 explains.

## I2 - An available-looking customer quote link leads to an intentionally unavailable route
**Priority: P2 dead-end removal. Evidence: source trace.**
`WaitingDesk` exposes the customer quote route unless embedded. `fixtureLinksAllowed` deliberately blocks that route whenever authentication is enabled. The operator can therefore be offered a control for a capability the deployment intentionally does not provide.

**Recommendation:** hide or clearly disable unsupported share actions and explain the manual alternative. Do not remove the route's security guard to make a menu item appear to work. Real public capability links remain a separately scoped feature.

## Workspace context
Several supporting views use the first business when the filter is All, and hide their workspace selector on a phone. For a multi-membership user, test that the business being taught or configured is explicit and deliberate. The normal initial onboarding creates one business, so this is a multi-workspace verification requirement, not a claim that every beta user edits the wrong tenant.

## Acceptance
Use a task inventory, not a preference poll: find an enquiry, inspect its raw message, correct a fact, update a rule, pause a permitted action, record loss/booking and inspect its history. Each must be reachable on desktop and phone with the same state meaning. Check unsupported destinations and browser back behaviour. Keep route and saved-link compatibility when proposing any rename.

## Source map
- `src/components/shell/app-shell.tsx`.
- `src/components/business/brain-screen.tsx`; `src/components/trust/trust-screen.tsx`.
- `src/components/enquiry/phone-desk.tsx`; `waiting-desk.tsx`.
- `src/routes/_app/bookings.tsx`; `src/lib/public-links.ts`; `src/routes/q/$enquiryId.tsx`.
