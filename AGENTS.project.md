# Enquiry — Project Contract

This file is the permanent product and implementation contract for anyone building Enquiry in this repository.

Read this **before changing product behaviour, public positioning, roadmap content, or core UX**.

The original product change programme lives in `docs/PRODUCT_CHANGE_PLAN.md`.

**Current execution authority lives in `docs/CURRENT_PHASE.md`**, with the management index in `docs/PHASE_REGISTRY.md` and detailed briefs under `docs/phases/`.

Work **one authorised slice at a time**. Do not infer permission from a later commit already existing on `main`, combine future phases, invent adjacent work, or broaden scope because it seems useful.

---

## 1. What Enquiry is

Enquiry is a **cross-industry enquiry decision layer for small service businesses**.

It sits between:

> someone is interested → the work is booked or lost

It receives messy inbound enquiries from multiple channels, reconstructs the customer request, applies how that specific business operates, identifies what can safely be decided now, determines the smallest blocker when something is missing, prepares the correct next action, and keeps the enquiry state current as the conversation changes.

It is not simply an AI inbox, quote generator, receptionist, CRM, or workflow builder.

### Core product behaviour

For every enquiry Enquiry should answer:

1. What does the customer want?
2. What facts are known?
3. What is inferred, ambiguous, conflicting, or missing?
4. Which business-specific checks are relevant to this enquiry?
5. What can be decided now?
6. What is the **minimum decision blocker**, if any?
7. What should happen next?
8. Why is that the correct next action?
9. Is Enquiry authorised to perform that action or only prepare it?
10. How has the enquiry changed since the last customer message?

The important product primitive is the **Enquiry Decision Object**, not a contact, pipeline card, or chat thread.

---

## 2. Multi-channel principle

Enquiries can originate or continue through supported channels such as:

- email
- website forms
- text / SMS
- Instagram
- Facebook
- forwarded messages
- manual/private intake

The product promise is **not** “all your messages in one inbox”.

The product promise is:

> **One coherent enquiry even when the conversation moves channels.**

Channels are ingestion and response surfaces. The commercial/customer decision state belongs to the Enquiry.

A customer changing scope on Instagram after originally submitting a website form should update the same enquiry when identity is safely established.

Never silently merge cross-channel identities based only on weak AI similarity. Ambiguous identity should remain a proposed match requiring review.

---

## 3. Business Brain

Enquiry learns how a business works through a persistent structured Business Brain.

Relevant knowledge includes:

- services and aliases
- prices and pricing rules where applicable
- required information
- eligibility / qualification rules
- travel / location logic
- availability and resource constraints where applicable
- policies
- operating preferences
- voice

Customer-specific facts must remain scoped to that enquiry unless explicitly promoted through a deliberate **Teach Enquiry** flow.

High-impact rules such as pricing, deposits, refunds, cancellation, eligibility, or capacity must never become authoritative silently.

---

## 4. Decision engine principles

### AI interprets. Deterministic systems validate important outcomes.

Enquiry should dynamically select only the evaluator families relevant to the current enquiry.

Possible evaluators include:

- pricing
- eligibility / service fit
- package / offer selection
- availability
- capacity / resource feasibility
- location / travel
- qualification / routing
- deposit / booking readiness

Do **not** force pricing or capacity into every enquiry.

If pricing is not relevant, do not render “Price not ready”. Render no pricing concept at all.

Unknown is a valid intelligent outcome.

Prefer:

> Availability unknown — calendar unavailable.

or

> Exact price cannot be decided until X is known.

rather than fabricated confidence.

---

## 5. Minimum blocker

The product should care about **decision-critical missing information**, not empty fields.

Do not ask for a missing fact simply because it is missing.

Ask for it only when it changes or blocks the next correct decision.

If 5 versus 6 people produces the same price, feasibility and next action, there is no reason to block progress on the exact count yet.

If 6 people requires a second resource and 5 does not, the count becomes decision-critical.

This behaviour is a major differentiation target.

---

## 6. Trust and action authority

A correct recommendation does not automatically mean Enquiry is allowed to execute it.

The conceptual flow is:

> Interpret → Validate → Decide → Authorise → Act

Autonomy is earned per action class, never enabled through one giant AI switch.

The system should visibly distinguish:

- the recommendation is correct
- the recommendation is safe
- the business has authorised this class of action

High-risk actions and ambiguous situations remain human-controlled.

---

## 7. Public website positioning

The website must make the differentiated behaviour visible quickly.

Avoid reducing Enquiry to:

> message → price → reply

or

> AI that replies to enquiries

The strongest public demonstrations show one or more of:

- the same enquiry producing different decisions for different businesses
- one changed customer fact materially changing the decision
- Enquiry refusing to guess
- the minimum blocker
- cross-channel conversation continuity
- a visible “Why?” grounded in facts and business rules
- Enquiry knowing the action but not being authorised to execute it

The current headline **“Stop managing enquiries.”** is strong and may remain unless deliberately changed by the product owner.

Public copy should be understandable to a service-business owner. Internal phrases such as “the shape of the enquiry is the product” may guide strategy but should not automatically appear as customer copy.

---

## 8. Public roadmap policy

`/roadmap` is a **customer-facing sales and trust page**, not a public engineering backlog.

It should show only **major customer-facing capability jumps** that help a prospect understand:

- what Enquiry can genuinely do now
- what meaningful capability is being built next
- how the product becomes more valuable over time
- the long-term endgame

Do not publish every internal implementation detail, bug fix, refactor, evaluator, integration task, state-model change, or minor feature.

The roadmap should be curated, editorial and honest.

Good honesty:

> Some of this works today. Some is being built. Some still needs to earn its place.

Good roadmap concepts:

- Understand the enquiry
- Learn the business
- One enquiry across channels
- Keep enquiries moving
- Trusted action
- The self-maintaining enquiry layer

Avoid exact delivery dates unless genuinely committed.

Votes / “I need this” are evidence, not roadmap democracy.

Public “Shipped” history should contain only meaningful milestones.

---

## 9. Public Updates policy

`/updates` is also customer-facing.

It is **not a changelog**.

Publish only meaningful progress that helps a prospect understand product momentum, capability, trust, or learning.

Examples:

- Business Brain can now learn a material class of business rule safely
- cross-channel continuity is working
- a first beta cohort has started
- Smart Follow-Up has shipped

Do not publish internal refactors, dependency updates, tiny UI fixes, test-count changes, or routine engineering work unless they materially affect the customer promise.

---

## 10. Product boundary / non-goals

Do not turn Enquiry into:

- a full CRM for the entire customer lifecycle
- ERP
- accounting or payroll
- POS or inventory
- generic project management
- a generic workflow builder
- a generic AI receptionist platform
- a field-service management suite
- an omnichannel inbox whose main value is message aggregation

Post-booking fulfilment should hand off downstream rather than expanding Enquiry into an operations suite.

The boundary remains:

> **first enquiry → booked or lost**

---

## 11. Cross-industry rule

Enquiry is horizontal across service businesses whose enquiries require interpretation and business-specific decision-making.

Beauty, photography, painting, cleaning, consulting, creative/agency and property-service examples are fixtures and proof cases.

Do not hard-code the product around one niche.

Different businesses should be able to run different evaluator sets and terminology through Business Brain / configuration.

---

## 12. Implementation protocol for implementation agents

When asked to implement authorised work from `docs/CURRENT_PHASE.md` / the referenced phase brief:

1. Read this file.
2. Read `docs/CURRENT_PHASE.md` and the named phase only.
3. Inspect the existing implementation before editing.
4. Preserve strong existing behaviour unless the phase explicitly changes it.
5. Do not execute later phases early.
6. Keep the authorised live product and the isolated demo functional throughout.
7. Run relevant tests, typecheck, and visual QA before declaring the phase complete.
8. Report:
   - what changed
   - files changed
   - tests/QA run
   - any contradiction or unresolved risk
9. Do not rewrite the product strategy or roadmap scope to suit the implementation.
10. If a material contradiction exists, flag it rather than inventing a new product rule.

### Scope discipline

If the user says:

> “Execute Phase 2 only”

then execute Phase 2 only.

Do not also “helpfully” redesign onboarding, add another integration, change pricing strategy, or refactor unrelated code.

### When you discover a later-phase defect

A durable contract can reveal that existing code is wrong outside the active slice.

That does **not** automatically authorise fixing it.

Unless the defect is an immediate security/data-loss incident on the currently exercised path:

1. record the exact conflict in the handoff or a review/status note;
2. leave the product implementation unchanged;
3. let product management place the correction into the correct phase.

Do not use a newly-added contract sentence as permission to jump ahead of `docs/CURRENT_PHASE.md`.

If the issue is an immediate security/data-loss incident that cannot safely wait, stop normal phase work, make the smallest containment only, and clearly flag the sequencing exception for product-management review.


---

## 13. Live tenant data and demo isolation

The public/demo fixture world and a signed-in business workspace are different trust domains.

### Signed-in operator data

For a real signed-in tenant, authoritative business state must live behind the authenticated server/tenancy boundary.

A client store may cache server state and hold transient UI preferences, but it must not be the durable authority for:

- businesses;
- Business Brain knowledge;
- enquiries and facts;
- messages;
- Decision Objects / snapshots;
- quotes;
- bookings;
- trust/action policies;
- audit history.

Refreshing the browser must not revert a real business to session-storage or fixture state.

### Demo/sample data

Fixture businesses and enquiries are product demonstrations/evals.

Never silently provision a real new tenant as a fixture business or write F01/F02/etc. sample enquiries into a live workspace merely to avoid an empty screen.

If sample data is offered, it must be explicitly isolated as sample/demo behaviour. `/demo` is the preferred public fixture surface.

---

## 14. First-beta truthfulness

A first-beta build must be able to process an enquiry that was **not pre-authored in fixtures**.

Manual/private paste is an acceptable first ingestion path.

Production Gmail, Microsoft, Instagram, Facebook, SMS, payment or booking integrations are **not** required merely to call the product a first beta.

Where an integration is not genuinely live:

- do not mark it connected;
- do not label a copied/manual response as sent by Enquiry;
- do not claim a payment or booking was performed;
- do not fabricate availability from a disconnected source.

The review-first first-beta loop may be:

> paste/import enquiry -> interpret -> validate against Business Brain -> prepare next action -> owner reviews/corrects -> owner acts manually -> Enquiry records the confirmed outcome/update

This is truthful product value and is preferable to fake automation.

---

## 15. Interpretation and transaction boundary

Customer content is untrusted input.

An LLM/model may help interpret:

- intent;
- candidate facts;
- inferences;
- ambiguities;
- possible missing facts;
- possible evaluator applicability;
- draft language.

The model must not directly become authority for:

- final price where deterministic pricing rules apply;
- eligibility/capacity outcome where structured rules apply;
- quote-sent status;
- booking;
- payment;
- autonomy/action authority.

Use the model to interpret. Use structured Business Brain evidence and deterministic evaluators to validate/decide important outcomes.

Prompt-like instructions inside customer content must never rewrite system rules, Business Brain authority or action permissions.

---

## 16. Public customer-link security

Internal enquiry/booking IDs are not public authorisation.

Short IDs, UUIDs or other values shipped in the client bundle are not secure capability tokens merely because they look opaque.

Until a dedicated server-backed capability-link model exists, customer quote/booking fixture routes must be contained to explicit demo/local use in production-capable deployments.

If public no-account links are later justified, require a deliberate server-side model with high-entropy capability tokens, server validation, expiry/revocation and minimal public projections.
