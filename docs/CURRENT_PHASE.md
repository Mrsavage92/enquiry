# Enquiry - Current Implementation Phase

## Current phase

**Phase 5 - CORRECTION GATE: finish public trust copy cleanup**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_5_PUBLIC_TRUST_AND_EARLY_ACCESS_COPY.md`
- `docs/TEST_REGRESSION_POLICY.md`

## Completed gates

### Phase 1
**SIGNED OFF.** Public positioning leads with the decision layer rather than phone-first quoting.

### Phase 2A
**SIGNED OFF.** Ridge & Co / Maya signature demo is grounded in explicit business truth and deterministic same-phone continuity.

### Phase 2B
**SIGNED OFF.** The Ridge decision-continuity proof is the first substantial public proof on the homepage and `/how`; Priya remains secondary exact-price evidence.

### Phase 3
**SIGNED OFF.** Pricing and capacity are no longer treated as universal. Non-price enquiries render without fake commercial placeholders and the queue is attention-first.

### Phase 4
**SIGNED OFF.** The public roadmap is now six customer-facing eras, continuity is framed as one coherent enquiry rather than a unified inbox, pricing/capacity remain conditional, autonomy remains earned, and the endgame stays bounded at booked/lost.

---

# Phase 5 review result

Commit reviewed: `140768bbc89c211080c6f81ae2e7c087772572a2`.

The Phase 5 implementation is materially correct and remains within scope:

- Early Access now leads with gradual access and working closely with early businesses rather than internal cohort mechanics;
- exact cohort sizes, `not pad a list`, `learning can absorb`, feature-vote language and speculative founding-discount wording were removed;
- intended paid nature is stated without a price or permanent discount promise;
- `/updates` was reduced to curated product/trust notes rather than quote-sheet trivia or engineering release notes;
- continuity is described as one enquiry, not a unified inbox;
- unknown/not-applicable pricing is represented as a trust behaviour;
- the waitlist remains email-first and qualification remains optional with `Skip for now`;
- no Phase 6 schema/attribution work was bundled in.

GitHub exposes no Actions/check status for the implementation commit, so local typecheck/visual-QA claims cannot be independently verified from GitHub status.

## Why Phase 5 is not signed off yet

Two public surfaces still use the phrase:

> `No fake scarcity.`

It appears in:

- the homepage Early Access heading;
- the waitlist success state.

The principle is correct, but the wording still sounds like founder/startup meta-commentary. Phase 5 exists specifically to express the same trust principle in calm customer language rather than telling visitors about marketing tactics we are not using.

This is a copy correction only. Do not reinterpret it as permission for further site changes.

---

# Execute this correction only

Replace the remaining customer-facing `No fake scarcity` wording with positive, plain language that communicates gradual access without artificial urgency.

Good direction:

- `We’re starting small.`
- `Access opens gradually.`
- `We invite businesses in small groups as the product is ready.`

Do not use all three mechanically. Fit the surrounding sentence/heading naturally.

## Preserve exactly

- email-first waitlist;
- optional qualification mechanics;
- gradual-access positioning;
- intended paid-product statement;
- current curated Updates entries unless a factual correction is required;
- Phase 1-4 positioning and product contract;
- roadmap structure and roadmap interactions.

## Do not do

- no new update posts;
- no Phase 6 persistence or attribution work;
- no waitlist backend changes;
- no pricing-model work;
- no visual redesign;
- no roadmap edits;
- no unrelated copy sweep outside the two identified surfaces unless the exact same phrase is found elsewhere.

## Correction acceptance criteria

- [ ] `No fake scarcity` no longer appears in customer-facing copy.
- [ ] Homepage Early Access language still clearly communicates gradual rollout.
- [ ] Waitlist success copy still clearly communicates gradual rollout.
- [ ] No fake urgency, queue-position promise, countdown or permanent discount language is introduced.
- [ ] No product implementation behaviour changes.
- [ ] Typecheck passes.
- [ ] Relevant desktop/mobile visual QA completed.

Then stop.

**Do not begin Phase 6 until product management reviews this correction and updates this file.**
