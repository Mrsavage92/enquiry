# Enquiry — Sequenced Product Change Plan

**Owner / product management:** ChatGPT acting from the agreed Enquiry product strategy and repository review.

**Primary implementer:** Grok Build.

**Execution rule:** implement **one phase at a time**. Do not batch the whole document into one build turn.

Before every phase, read `AGENTS.project.md`.

---

# Why this plan exists

The current prototype is stronger than the public site makes it look.

The code already contains substantial differentiated behaviour:

- modular evaluator families
- explicit missing / ambiguous / conflicting facts
- “blocking the next decision” UX
- Business Brain knowledge and provenance
- enquiry-only vs Teach Enquiry corrections
- quote versioning
- commercial document vs editable reply separation
- decision re-evaluation when facts change
- Why?/evidence
- trust modes and Autopilot gates
- multiple inbound / outbound channels
- follow-up state
- explicit unknown / integration-failure behaviour

The main risk is **presentation drift**: the public site currently makes Enquiry look more like a polished AI quoting/reply assistant than the deeper decision system it already is.

The work below makes the differentiated product behaviour obvious while removing accidental quote-centric assumptions.

---

# Global rules for all phases

- Preserve the headline **“Stop managing enquiries.”** unless explicitly changed later.
- Keep the existing visual identity unless a phase explicitly asks for visual restructuring.
- Keep Enquiry cross-industry.
- Do not add generic CRM features.
- Do not turn multi-channel support into a generic inbox pitch.
- Do not make pricing/capacity universal.
- Do not fabricate integrations or imply production availability where only prototype behaviour exists.
- Public roadmap and Updates are sales/trust surfaces, not engineering logs.
- Use realistic service-business language, not internal product-strategy jargon.
- Prefer showing behaviour over explaining architecture.
- Preserve accessibility and reduced-motion behaviour.

---

# Phase 0 — Baseline and guardrails

**Status:** COMPLETE — management layer created.

## Purpose
Establish a permanent product contract and sequenced work plan so implementation does not drift.

## Deliverables
- `AGENTS.project.md`
- this plan

No Grok work required.

---

# Phase 1 — Reposition the public site around the decision layer

**Priority:** P0

**Goal:** A new visitor should understand within ~10 seconds that Enquiry does more than draft replies or quotes.

## Problem observed
Current public copy repeatedly reduces the product to ideas such as:

- “On the phone, between jobs. You approve. You send.”
- “messy message → number → letter → send”
- a hero proof case that is primarily an exact-price makeup quote

Those are useful interactions, but they hide the strongest product behaviour.

## Customer-facing message to express

> However the enquiry arrives, Enquiry puts the request together, understands what matters for this business, works out what can safely be decided now, and prepares the next action.

Supporting ideas:

- email, text, Instagram, forms can all feed the same enquiry process
- Enquiry distinguishes known / missing / ambiguous information
- it applies only the business checks that matter
- it can say unknown instead of guessing
- it knows what should happen next and why

## Required changes

### Homepage
Review `src/routes/index.tsx` and supporting site components.

Keep:
- “Stop managing enquiries.”
- existing visual quality
- waitlist CTA
- current prototype access

Change:
- secondary hero/message so it no longer sounds primarily phone/quote centric
- “message, number, letter, send” language wherever it implies every enquiry becomes a quote
- public explanation of cross-industry fit into customer language rather than internal wording such as “the shape of the enquiry is the product”

### How It Works
Review `src/routes/how.tsx`.

Make the process clearly read as:

1. work arrives from any supported enquiry channel
2. Enquiry reconstructs the request / conversation
3. Business Brain supplies the relevant business truth
4. Enquiry determines what can be decided and what is blocking progress
5. owner reviews / sends when approval is required
6. Enquiry keeps the enquiry current until booked/lost

Do not turn the page into an architecture explanation.

### Footer / metadata / README product wording
Update public-facing product descriptions that currently frame Enquiry mainly as a “phone-first AI enquiry copilot”.

README can remain developer-oriented but should accurately describe the product thesis.

## Do not do in this phase
- do not build the new signature demo yet
- do not redesign the roadmap yet
- do not change core decision-engine logic
- do not add integrations

## Acceptance criteria
- [ ] Homepage still feels visually like the current site.
- [ ] A visitor can understand Enquiry without assuming it is only a quote generator.
- [ ] Multi-channel is visible as input continuity, not “unified inbox” positioning.
- [ ] Public copy mentions decision / next action behaviour in plain customer language.
- [ ] Public copy does not claim every enquiry has pricing or capacity.
- [ ] Cross-industry wording sounds like customer marketing, not an internal thesis.
- [ ] Typecheck passes.
- [ ] Existing routes remain functional on desktop and mobile.

## Likely files
- `src/routes/index.tsx`
- `src/routes/how.tsx`
- `src/components/site/site-shell.tsx`
- `README.md`
- possibly small supporting site components only

---

# Phase 2 — Build the signature “one enquiry, changing across channels” demo

**Priority:** P0

**Goal:** Create the demonstration that makes Enquiry difficult to mistake for “ChatGPT connected to email”.

## Product story

The customer begins through one channel and later changes important details through another.

Example pattern — use a cross-industry-neutral or non-beauty-first example if possible:

### Initial website form
Customer asks about a service for a date / scope.

Enquiry initially determines:
- request understood
- some facts known
- one or more checks applicable
- next action / preliminary decision

### Later Instagram / SMS message
Customer changes a material fact.

Example:
- quantity / attendees 5 → 6
- location unknown → known
- deadline changes
- requested scope expands

### Enquiry reaction
Visually show the meaningful consequence:

- fact diff
- evaluator result changes
- quote/estimate only if relevant
- feasibility changes if relevant
- prior commercial document superseded only when appropriate
- next action changes

## The demo must communicate

> Same customer. Same enquiry. Different channel. One continuously maintained business decision.

## Important trust behaviour
For the prototype, the identity link can be predetermined fixture data.

Do not imply that arbitrary cross-channel identity merging is already production-safe.

If the demonstration discusses how Enquiry linked the conversation, show evidence or a clear “linked to existing enquiry” state rather than magical invisible merging.

## Placement
Use this as a primary or near-primary homepage proof moment.

The existing simple exact-price proof case can remain as a secondary demo.

## Do not do in this phase
- do not implement a general production identity-resolution engine
- do not add real Instagram/SMS integrations
- do not redesign every fixture

## Acceptance criteria
- [ ] Demo begins on one channel and continues on another.
- [ ] The same Enquiry is visibly maintained.
- [ ] At least one changed fact materially changes the recommended decision or next action.
- [ ] The product shows the change, not merely a new AI-generated reply.
- [ ] The demo does not rely solely on pricing to create the “magic”.
- [ ] Mobile and desktop presentation both work.
- [ ] Motion respects reduced-motion preferences.
- [ ] Typecheck/tests pass.

## Likely files
- `src/components/site/*` new or existing proof/demo components
- `src/routes/index.tsx`
- `src/fixtures/channels.ts`
- `src/fixtures/enquiries.ts`
- possibly `public/product/*` only if new recorded assets are required

---

# Phase 3 — Remove universal quote/commercial assumptions from app UX

**Priority:** P0

**Goal:** Make the product architecture and visible UI agree: pricing is an evaluator, not a universal Enquiry field.

## Problems observed

### Enquiry detail
When no quote sheet exists, desktop may still render a universal “Commercial value” block and fall back to “Price not ready”.

For an enquiry where pricing is genuinely not relevant, that is the wrong concept.

### Queue
Desktop currently gives high visual priority to “Open exact” and total exact-price value.

This is useful for price-centric businesses, but cannot be the universal queue header for every business phenotype.

## Required behaviour

### Detail
- If pricing is applicable and unresolved → show appropriate price state such as estimate / exact / not ready.
- If pricing is **NOT_APPLICABLE** → do not show a price/commercial section simply to fill space.
- If pricing is applicable but unavailable due to missing facts → “Price not ready” remains valid.

### Queue / briefing
Make the top summary data-driven.

Possible priority:
- `N need you`
- `N waiting`
- `N at risk`
- commercial aggregate only when enough currently visible/open enquiries have meaningful commercial values and the business uses pricing as a material evaluator

Do not invent a generic dashboard.

## Preserve
- quote versioning
- quote/letter mismatch detection
- exact vs estimate logic
- evaluator visibility

## Do not do in this phase
- do not redesign the entire workspace
- do not add reporting
- do not remove pricing features

## Acceptance criteria
- [ ] An enquiry with pricing `NOT_APPLICABLE` shows no “Price not ready” placeholder.
- [ ] A pricing-relevant enquiry still correctly distinguishes exact / estimate / unresolved.
- [ ] The queue does not universally imply that monetary value is the main object.
- [ ] Existing price-centric fixtures still look good.
- [ ] At least one non-price-centric fixture demonstrates the correct UI.
- [ ] Tests cover the not-applicable case.
- [ ] Typecheck/tests pass.

## Likely files
- `src/domain/labels.ts`
- `src/components/enquiry/intelligence.tsx`
- `src/components/enquiry/queue.tsx`
- relevant tests / fixtures

---

# Phase 4 — Turn `/roadmap` into a tighter sales/trust narrative

**Priority:** P1

**Goal:** Keep the roadmap visually strong and transparent while removing backlog-like detail.

## Principle
`/roadmap` is **effectively a sales page**.

It should show only progress of customer significance.

The current eight-stage implementation contains excellent internal thinking but too much detail for a public sales/trust surface.

## Recommended public narrative

Use approximately 5–6 major eras. Exact titles can be refined during implementation, but the structure should remain outcome-based.

### NOW — Understand the enquiry
Messy inbound becomes an understood request with the correct next action.

### BUILDING — Understand your business
Business Brain learns the services, rules, prices where relevant, policies and operating preferences needed to make decisions.

### NEXT — One enquiry, wherever the conversation happens
Email, text, Instagram and forms contribute to one coherent enquiry as the customer conversation moves.

### NEXT / LATER — Keep enquiries moving
The enquiry state maintains itself and follow-up returns only when something genuinely needs attention.

### LATER — Trusted action
Enquiry handles selected low-risk routine actions only after the business has explicitly earned and granted that autonomy.

### ENDGAME — The self-maintaining enquiry layer
From first interest to booked/lost with almost no administrative maintenance.

## Keep the strong honesty
Good language already present:

> Some of this works today. Some of it is being built. Some of it still needs to earn its place.

Keep the principle of:
- Working now
- Building
- Next
- Later / Exploring
- Shipped

But do not overwhelm a visitor with status taxonomy.

## Public update granularity
Do not expose:
- evaluator implementation tasks
- state-model refactors
- quote-drift fixes
- DB/API plumbing
- individual bug fixes
- minor UI changes

unless they create a major new customer-visible capability.

## Roadmap interaction
Keep “I need this” where it helps gather intent.

Votes remain evidence, not promises.

## Endgame
Keep the clear boundary:

> Enquiry becomes the intelligence layer between “someone is interested” and “the work is booked”.

And explicitly preserve:

> first enquiry → booked or lost

## Acceptance criteria
- [ ] Public roadmap has materially fewer top-level stages/items than the current version.
- [ ] Every visible stage expresses a customer capability or outcome.
- [ ] It still feels substantial and visionary rather than stripped bare.
- [ ] Honesty about current vs future capability remains prominent.
- [ ] No internal implementation backlog is exposed.
- [ ] Endgame is visually and verbally clear.
- [ ] `I need this` still works on appropriate future milestones.
- [ ] Typecheck/tests pass.

## Likely files
- `src/lib/launch/roadmap.ts`
- `src/routes/roadmap.tsx`
- `src/components/site/roadmap-board.tsx`
- `src/components/site/roadmap-visuals.tsx`
- homepage roadmap preview

---

# Phase 5 — Polish Early Access and public trust copy

**Priority:** P1

**Goal:** Keep the unusual honesty but make it sound like confident customer communication rather than an internal founder memo.

## Problem observed
Some current copy is strategically correct but too process-oriented, for example concepts such as:

- “not pad a list”
- “only as learning can absorb them”
- “a say in the research, not a vote that ships features”
- “Founding-user pricing only if we later know the commercial model is real”

The meaning is good. The wording should be more polished.

## Direction
Say the same truth in customer language.

Example tone:

> **We’re starting small.**
>
> Early access will open gradually so we can work closely with the first businesses and improve Enquiry before opening it more widely.

> Enquiry is intended to be a paid product. We’ll share pricing before any paid access begins.

## Updates page
Review `/updates` under the same policy.

Updates should be curated product progress / build stories, not a changelog.

## Acceptance criteria
- [ ] Early Access remains transparent.
- [ ] Copy feels customer-facing and intentional.
- [ ] No fake scarcity.
- [ ] No unvalidated permanent pricing promise.
- [ ] Updates page states or demonstrates that only meaningful progress is published.
- [ ] Typecheck passes.

## Likely files
- `src/routes/early-access.tsx`
- `src/routes/updates.tsx`
- possibly shared site copy components

---

# Phase 6 — Fix roadmap feedback persistence and attribution

**Priority:** P1

**Goal:** Make the roadmap useful as actual product research, not just an interaction metric.

## Problems observed

### Qualitative roadmap feedback
The UI asks:

> What problem would this solve for your business?

but the current implementation appears to use the presence of that text only to fire an engagement event. Persist the actual response.

### Attribution
The generic roadmap tracking helper currently submits blank UTM/referrer fields for several roadmap events even though attribution helpers already exist elsewhere.

## Required changes

### Persist qualitative feedback
Store at minimum:
- feature / roadmap stage id
- session id
- waitlist id when available
- free-text problem statement
- timestamp

Prefer extending the existing roadmap-interest model rather than building a new analytics system unless schema constraints require otherwise.

### Preserve attribution
For roadmap views / feedback / stage engagement, attach the available current-touch or first-touch attribution consistently.

Do not duplicate attribution systems.

## Acceptance criteria
- [ ] A submitted roadmap problem statement is persisted and retrievable from the backing data.
- [ ] Roadmap engagement events retain available UTM/referrer attribution.
- [ ] No sensitive data is exposed to other visitors.
- [ ] Existing “I need this” toggling still works.
- [ ] Migration is safe for current prototype data.
- [ ] Tests/typecheck pass.

## Likely files
- `src/components/site/roadmap-board.tsx`
- `src/lib/launch/api.ts`
- `src/lib/launch/session.ts`
- `migrations/*`
- guard/tests as needed

---

# Phase 7 — Add safe cross-channel identity-linking as a prototype concept

**Priority:** P2

**Goal:** Establish the correct product model before real channel integrations make identity resolution difficult.

## Important
This is **not** a production identity graph project.

Implement only enough structure and UX to demonstrate the trust model.

## Product rule
Never silently merge two conversations because AI thinks they look related.

Identity evidence can be:

### Strong / deterministic
- verified email match
- verified phone match
- explicit customer-supplied cross-reference
- platform/account identifier already linked by the business

### Suggestive
- same name
- same service
- same event date
- same location
- message content similarity

Suggestive evidence may create:

> **Possible match**
>
> This Instagram message may belong to Sarah Jones’s existing enquiry.
>
> [Link conversations] [Keep separate]

## Data direction
Avoid assuming one email + one phone + one handle forever.

Introduce or prepare for an identity collection / contact-point model, for example conceptually:

```ts
CustomerIdentity {
  kind: "email" | "phone" | "instagram" | "facebook"
  value: string
  verified: boolean
  provenance: Provenance
}
```

Do not over-engineer a global customer CRM.

The identity exists to maintain enquiry continuity.

## Prototype fixture
Provide one fixture where a second-channel message is proposed as a match and can be linked safely.

After linking, the Enquiry Decision Object should update from the new message.

## Acceptance criteria
- [ ] Product model can represent multiple contact/channel identities without pretending they are automatically the same person.
- [ ] Weak matches are reviewable, not auto-merged.
- [ ] Linking a fixture conversation updates the existing enquiry rather than creating a permanent duplicate.
- [ ] Keep-separate is supported in the prototype.
- [ ] No full CRM/customer timeline is introduced.
- [ ] Tests/typecheck pass.

## Likely files
- `src/domain/types.ts`
- `src/domain/channel.ts` or a new small identity module
- fixtures
- enquiry/conversation UI
- tests

---

# Phase 8 — Final coherence and QA pass

**Priority:** P1 after Phases 1–7 that are actually chosen for the current release.

**Goal:** Ensure the site and app tell the same product story.

## Review questions

### Public site
- Can a new visitor explain Enquiry without using the phrase “AI email writer”?
- Is the differentiated behaviour visible before they read a long explanation?
- Does the site show more than one industry phenotype?
- Is multi-channel framed as enquiry continuity rather than inbox aggregation?

### App
- Are irrelevant evaluator families hidden?
- Can Unknown be represented proudly and clearly?
- Does a changed fact visibly change the decision?
- Can the user see Why?
- Does recommendation ≠ execution permission remain obvious?

### Roadmap / Updates
- Are they customer-facing sales/trust pages?
- Is every visible milestone meaningful to a prospective customer?
- Has internal engineering detail stayed internal?

### Waitlist
- Is email still the first conversion?
- Is qualification optional/progressive?
- Is attribution intact?
- Is roadmap qualitative intent stored?

## QA
- run unit tests
- run typecheck
- run lint if currently clean enough to be meaningful
- visual desktop QA
- visual mobile QA
- reduced motion QA
- keyboard/focus QA on primary conversion and app flows

## Acceptance criteria
- [ ] No obvious contradiction between public positioning and current prototype capability.
- [ ] No one niche dominates the entire public product identity.
- [ ] No universal price/capacity assumptions remain.
- [ ] Roadmap remains honest but curated.
- [ ] Waitlist/roadmap instrumentation is functioning.
- [ ] Core demo flow is visually strong on phone and desktop.

---

# Not now / parking lot

These ideas may matter later but should **not** be pulled into the phases above without a new product decision:

- real Gmail/Microsoft mailbox OAuth
- production Instagram/Facebook APIs
- production SMS provider
- deep booking-system integrations
- payment collection
- referral-gamification system
- paid ads
- full customer/contact CRM
- post-booking project management
- generic workflow builder
- industry-specific hard-coded product forks
- complex ML identity resolution
- tenant fine-tuning

---

# Grok execution prompt template

Use this exact pattern when handing a phase to Grok:

> Read `AGENTS.project.md` and `docs/PRODUCT_CHANGE_PLAN.md` first.
>
> Execute **Phase X only**.
>
> Inspect the existing implementation before changing it. Preserve behaviour that already satisfies the phase. Do not implement later phases or adjacent ideas.
>
> When finished, run the relevant tests/typecheck and visually verify the affected desktop and mobile flows.
>
> Report what changed, files changed, tests run, and any remaining contradiction or risk. Do not give me another strategy plan — make the changes.

---

# Management note

This document is deliberately more detailed than the public roadmap.

**Do not copy this implementation plan onto `/roadmap` or `/updates`.**

The public roadmap should contain only curated customer-facing milestones of significance.
