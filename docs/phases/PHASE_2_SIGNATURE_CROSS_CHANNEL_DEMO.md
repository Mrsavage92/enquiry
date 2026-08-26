# Phase 2 — Signature Cross-Channel Decision Demo

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute this document until `docs/CURRENT_PHASE.md` explicitly points to Phase 2.**

This is the detailed implementation brief for Phase 2 of `docs/PRODUCT_CHANGE_PLAN.md`.

---

# 1. Objective

Build the public demonstration that makes Enquiry difficult to mistake for:

- an AI reply writer;
- an AI quote generator;
- a unified inbox;
- ChatGPT connected to email;
- a normal CRM with AI added.

The visitor should understand this product behaviour within seconds:

> **The conversation can move. The enquiry stays coherent.**

A customer starts through one channel, later changes a material detail through another channel, and Enquiry maintains one continuously updated **business decision**.

The demo must show that Enquiry does not merely collect messages. It reconstructs what changed, re-applies how this business works, and changes the next action when the facts change.

---

# 2. Customer-facing message

Primary public headline direction:

> **One enquiry. Even when the conversation moves.**

Supporting line:

> A form becomes a text. The scope changes. Enquiry keeps the request, the business checks and the next action current.

Alternative if the existing page rhythm needs shorter copy:

> **The channel changes. The decision stays current.**

Do not use:

- "omnichannel platform";
- "unified inbox";
- "360-degree customer view";
- "AI-powered communications hub";
- "single pane of glass";
- architecture jargon such as `Decision Object` in customer-facing copy.

Those either commoditise the product or sound like CRM software.

---

# 3. The signature scenario

Use the existing fixture business:

**Ridge & Co Painting** (`businessId: "ridge"`)

Existing business truth already gives us the right decision mechanics:

- interior painting is offered;
- standard bedrooms have a known room rate;
- living areas require a measure;
- normal crew = two painters on weekdays;
- a third contractor can be booked with 48 hours notice;
- feasibility depends on rooms/scope, access and completion deadline;
- this is a team service business, not a beauty fixture.

Do not invent a second painting business unless absolutely necessary.

## Customer

Use a new fictional customer, for example:

**Maya Chen**

The exact name can change if an existing fixture makes implementation materially cleaner, but keep the scenario non-beauty and property/service based.

## Known identity

The website form contains Maya's mobile number.

The later SMS comes from the **same phone number**.

This is important.

The demo must not imply that Enquiry magically guessed two unrelated identities were the same person.

Visible identity treatment should say something like:

> **Linked to Maya's existing enquiry**

with optional explanatory detail:

> Same mobile number supplied in the website form.

That is both a trust feature and a product feature.

---

# 4. Scene A — website form

## Customer message

Use natural customer language close to:

> Hi, we settle on a four-bedroom place in New Farm on 18 September. It's empty from Monday the 14th. We'd like the bedrooms and living areas painted before we move in. Is that doable?

The exact date can be adjusted to fit existing fixture chronology, but the relationship between access and deadline must remain clear.

## Enquiry should reconstruct

**Service**
Interior painting

**Location**
New Farm

**Scope**
4 bedrooms + living areas

**Access**
Property empty from 14 Sep

**Completion deadline**
18 Sep

## Relevant business checks

Only show checks that materially explain the decision.

Suggested:

**Eligibility**
Offered

**Scope**
Enough to assess initial feasibility; living area still needs measure before a final quote

**Capacity / timing**
Feasible with the standard two-person weekday crew

Do not manufacture a precise final total for the living areas.

The point of this scenario is **not quoting**.

If commercial information appears at all, it should be secondary and honest, for example:

> Final quote follows site measure.

Do not place a large dollar amount at the centre of this demo.

## Initial next action

Suggested customer-facing decision:

> **Offer a site measure**

Reason:

> The current scope fits the crew window, but the living areas need measuring before a final quote can be confirmed.

This gives us a valid initial decision that can later change.

---

# 5. Scene B — later text message

The demo then introduces a later inbound SMS.

## Customer message

Use natural wording close to:

> Hey, Maya from the website form. Settlement has moved forward — could we have it finished by Wednesday the 16th instead? And we'd like the ceilings done too.

Do not make the customer sound like a product test fixture.

## Identity treatment

Before the decision changes, visibly show:

> **Linked to existing enquiry**

Reason available on tap/click:

> Same mobile number as the website form.

This should be calm and factual, not celebratory AI magic.

## Facts that change

Animate or otherwise clearly expose the diff:

**Completion deadline**
18 Sep → **16 Sep**

**Scope**
4 bedrooms + living areas → **4 bedrooms + living areas + ceilings**

Do not dump every unchanged fact again.

## Re-evaluation

The key product moment is the consequence, not the data-entry diff.

Suggested decision change:

**Capacity**
Feasible → **Feasible with condition**

Condition:

> Third contractor required to protect the new deadline.

This uses an existing Ridge & Co operating rule rather than an invented generic AI answer.

Other checks that remain valid should stay visually quiet.

## New next action

The next action should visibly change.

Suggested:

> **Confirm the extra crew option and keep the site measure**

Supporting reason:

> The earlier deadline plus ceilings changes the crew requirement. Ridge & Co can still make it work if the third contractor is secured in time.

The exact wording can be tuned to fit the existing voice system.

---

# 6. The product moment to emphasise

The demo should make this sequence unmistakable:

```text
Website form
    ↓
Enquiry understands the job
    ↓
Business-specific decision A
    ↓
Customer texts a material change
    ↓
Known identity links to the same enquiry
    ↓
Only changed facts update
    ↓
Relevant business checks re-run
    ↓
Decision B replaces Decision A
    ↓
New next action is ready
```

The customer-facing takeaway immediately after the demo should be close to:

> **Enquiry doesn't just keep the messages together. It keeps the business decision current.**

That is the differentiated story.

---

# 7. Public-site placement

This should become the **primary product proof** on the homepage.

Recommended homepage order after Phase 2:

1. Hero — `Stop managing enquiries.`
2. Waitlist CTA
3. **Signature cross-channel decision demo**
4. Existing phone/video proof as secondary evidence of the current app
5. Problem
6. Who it is for
7. Product capabilities
8. rollout / roadmap / final CTA

The existing Priya `$625` example can remain, but it must become **secondary proof**, not the clearest explanation of what Enquiry is.

The visitor should encounter the harder decision demo before the simple exact-quote demo.

## How It Works

`/how` currently leads with the simple `ProofCase` exact-price example.

Phase 2 should stop that page from immediately collapsing the product back into quoting.

Preferred implementation:

- reuse the signature demo in a compact or editorial form near the top of `/how`; or
- replace the current leading proof case with a concise before/after version of the signature demo;
- keep the old exact-price proof lower down only if it adds something distinct.

Do not create two completely separate visual systems for the same story.

---

# 8. Interaction design

The demo should feel like product behaviour, not a carousel ad.

## Preferred interaction

Use two explicit moments:

### 01 — Website form
Show the initial message and resulting decision.

### 02 — Text update
User taps/clicks a clear control such as:

> **Then Maya texts…**

The second message arrives and the meaningful decision diff animates.

A visitor must also be able to move back to the first state.

Do not rely on an animation that plays once and becomes impossible to inspect.

## Animation hierarchy

Motion should explain causality.

Good:

- incoming SMS rises/fades in;
- identity-link line appears;
- changed facts briefly highlight;
- old values soften/strike and new values replace them;
- capacity status transitions from Feasible to Feasible with condition;
- old next action visibly gives way to the new one;
- unchanged information remains stable.

Bad:

- everything flying around at once;
- decorative particles / AI sparkles;
- arbitrary card shuffling;
- huge glowing gradients;
- animation that makes the viewer wait several seconds before understanding the point.

The viewer should perceive:

> **message changed → facts changed → decision changed**

not simply "nice animation".

---

# 9. Visual design

Preserve the current Enquiry design system.

Use existing:

- paper / ink visual language;
- serif + sans hierarchy;
- restrained borders;
- existing shadows;
- existing motion primitives;
- current status tones;
- calm spacing and editorial layout.

Do not introduce a new mini-brand for the demo.

## Channel labels

Use small factual labels such as:

- Website form
- Text message

Channel icons are optional.

Do not build a logo wall for Instagram, Facebook, Gmail etc. The demo is about continuity, not integrations marketing.

## Decision panel

The decision result should dominate more than the raw transcript.

At each state make the visitor able to answer quickly:

- what does Maya want?
- what matters?
- can the business do it?
- what changed?
- what happens next?

---

# 10. Trust design

Truth and trust are part of the differentiation.

The demo must visibly avoid three forms of AI theatre.

## No magical identity merge

Show why the SMS belongs to this enquiry:

> Same mobile number as website form.

## No fabricated quote

Living areas require a measure. Do not invent a complete final price just to make the UI look finished.

## No invisible decision change

When the scope/deadline changes, expose the material consequence.

The user should be able to see **why** capacity changed.

Optional `Why?` detail can reference the existing Ridge rule:

> Standard weekday crew: two painters. Third contractor can be booked with 48 hours notice.

Do not expose internal rule IDs in customer-facing UI.

---

# 11. Implementation architecture

Keep this phase bounded.

Do not implement real SMS ingestion or a production identity engine.

## Preferred structure

A dedicated public-site component, for example:

`src/components/site/cross-channel-decision-demo.tsx`

Use a small typed local data model for the two display states rather than scattering hard-coded strings throughout JSX.

Possible supporting file:

`src/lib/site/signature-demo.ts`

or an equivalent existing project location if there is a clearer established convention.

Do not create a new global state system for this demo.

Do not add a dependency solely for the animation.

Use existing motion/CSS capabilities.

## App fixture

Adding a full new application fixture is **optional**, not required for Phase 2.

Only add one if it materially improves the customer proof without bloating the implementation.

The core requirement is the public demonstration.

If a fixture is added:

- reuse Ridge & Co;
- preserve the existing domain types;
- make the conversation contain both channels;
- keep identity evidence explicit;
- do not build a general identity-resolution engine.

---

# 12. Accessibility and responsive behaviour

## Mobile

The story must remain obvious on a ~390px viewport.

Preferred:

- vertically stacked message + decision;
- no horizontally scrolling decision table;
- controls at least existing app/site touch size;
- changed values remain readable without hover.

## Desktop

Can use a two-column layout if useful, but maintain a clear reading order.

## Reduced motion

Respect `prefers-reduced-motion`.

The state transition must still be understandable with motion disabled.

## Semantics

- controls are real buttons;
- status changes should not rely on colour alone;
- animation should not move keyboard focus unexpectedly;
- the demo remains understandable as static content.

---

# 13. Copy constraints

Use customer language.

Preferred concepts:

- understood;
- changed;
- needs;
- can be decided;
- next action;
- same enquiry;
- linked because…;
- condition;
- needs you.

Avoid on the public demo:

- evaluator;
- decision object;
- state machine;
- deterministic engine;
- entity resolution;
- ingestion layer;
- RAG;
- orchestration;
- workflow.

Those concepts may exist internally but should not be required to understand the benefit.

---

# 14. Do not do in Phase 2

- Do not implement real Gmail/Outlook/SMS/Instagram/Facebook integrations.
- Do not implement a generic cross-channel identity-resolution engine.
- Do not redesign the roadmap.
- Do not fix the universal pricing UI yet — Phase 3 owns that.
- Do not rewrite the entire homepage again.
- Do not build a generic inbox.
- Do not add a CRM contact timeline.
- Do not add a contact-merging admin interface.
- Do not make the demo beauty-first.
- Do not make the main payoff a dollar quote.
- Do not begin Phase 3.

---

# 15. Suggested implementation slices for Grok

Grok performs better with narrow jobs. When this phase becomes active, execute it in this order.

## Phase 2A — build the demo component

Only:

- create the two-state Ridge & Co scenario;
- build the interactive cross-channel decision demo;
- make it responsive and reduced-motion safe;
- do not yet reposition the homepage sections.

Stop and report.

**Management should review 2A before 2B.**

## Phase 2B — place and integrate the proof

Only after 2A passes:

- make the new demo the primary/near-primary homepage proof;
- demote the Priya exact-quote proof to secondary evidence;
- update `/how` so its first demonstration also supports the decision-layer story;
- preserve existing waitlist and app links;
- QA page rhythm on desktop/mobile.

Stop and report.

This split is deliberate. Do not combine 2A and 2B unless `CURRENT_PHASE.md` explicitly authorises both.

---

# 16. Acceptance criteria — Phase 2A

- [ ] Uses Ridge & Co Painting or an explicitly approved equivalent non-beauty fixture.
- [ ] Initial enquiry begins as a website form.
- [ ] Later material update arrives by SMS/text.
- [ ] Same-enquiry linking has visible evidence; no magical merge.
- [ ] At least two meaningful facts visibly change.
- [ ] A relevant business decision/check visibly changes because those facts changed.
- [ ] The next action visibly changes.
- [ ] Price is not the central visual payoff.
- [ ] No real integration is implied.
- [ ] Interaction works with keyboard.
- [ ] Mobile has no horizontal overflow.
- [ ] Reduced-motion mode remains understandable.
- [ ] Typecheck passes.
- [ ] Existing focused tests still pass.

---

# 17. Acceptance criteria — Phase 2B

- [ ] Signature demo appears before the simple exact-price proof on the homepage.
- [ ] A first-time visitor can understand `same enquiry → changed facts → changed business decision` without reading architecture copy.
- [ ] Homepage still feels like the existing Enquiry site.
- [ ] `/how` no longer leads with an experience that makes Enquiry look primarily like a quote generator.
- [ ] Existing waitlist CTA remains prominent.
- [ ] Existing `Open the app` route remains available.
- [ ] Desktop visual QA passes.
- [ ] Mobile visual QA passes.
- [ ] No console errors introduced.
- [ ] Typecheck passes.

---

# 18. Required Grok handoff after each slice

Report only:

1. what changed;
2. files changed;
3. test/typecheck/build results;
4. desktop/mobile/reduced-motion QA performed;
5. anything that differs from this brief and why;
6. unresolved risks.

Then stop.

Do not self-authorise the next slice.

---

# 19. Product-management success test

Phase 2 succeeds if a visitor watches the demo and can naturally describe Enquiry as something close to:

> "It keeps the enquiry understood as the customer conversation changes, and recalculates what the business should do next."

It fails if the likely takeaway is:

> "It puts all your messages in one place."

or:

> "It writes quotes with AI."

or:

> "It's a CRM with Instagram messages."

That distinction is the entire reason this phase exists.
