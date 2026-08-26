# Enquiry — Current Implementation Phase

## Current phase

**Phase 2B — Place and integrate the signature cross-channel proof**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

## Completed gates

### Phase 1
**SIGNED OFF.** Do not revisit unless a regression is introduced.

### Phase 2A
**SIGNED OFF.**

The Ridge & Co / Maya demo now passes the product-truth gate:

- website form → later text;
- same-enquiry link is grounded in the same known mobile number;
- Maya uses a distinct fixture phone value;
- scope and deadline visibly change;
- initial capacity is explicitly provisional;
- revised crew condition is grounded in an active Tom-sourced Ridge capacity rule;
- living-area measurement uncertainty remains visible;
- price is not the proof moment;
- changed facts change the business decision and next action.

Do not redesign the Phase 2A interaction unless integration exposes a genuine layout problem.

---

# Execute Phase 2B only

## Objective

Make the signature cross-channel decision demo the primary public proof of what Enquiry is.

A first-time visitor should encounter this story before the simple exact-price Priya proof:

> same enquiry → customer changes material facts on another channel → Enquiry re-applies the business truth → the decision and next action change.

The homepage must still feel like the current Enquiry site, not a redesign.

## Homepage

Update `src/routes/index.tsx` and only supporting site components required for placement.

Required order/direction:

1. Keep the existing hero: **Stop managing enquiries.**
2. Keep the waitlist CTA prominent.
3. Place the Ridge & Co signature demo as the primary/near-primary proof immediately after the hero/intro area.
4. Keep the existing phone/video/app proof as secondary evidence of the current product.
5. Keep the Priya `$625` proof only if it adds distinct evidence, but it must no longer be the main explanation of Enquiry.

Do not turn the homepage into a long feature catalogue.

## `/how`

The page must no longer lead with a proof case that makes Enquiry look primarily like a quote generator.

Preferred:

- reuse `CrossChannelDecisionDemo` in a compact/editorial form near the top; or
- use the same component/story with minimal wrapper changes.

Do not create a second bespoke cross-channel visual system.

The existing Priya proof may remain lower down only if page rhythm benefits and it demonstrates a distinct behaviour.

## Public truth / copy

Preserve:

- `One enquiry. Even when the conversation moves.`
- explicit same-phone linking evidence;
- provisional capacity wording;
- site-measure uncertainty;
- customer language rather than internal architecture terms.

Do not imply real production SMS/form integrations or arbitrary cross-channel identity matching are already generally available.

## Preserve

- waitlist flow;
- `Open the app` links;
- current visual identity;
- site navigation;
- mobile usability;
- reduced-motion behaviour;
- Phase 1 positioning improvements.

## Do not do

- do not start Phase 3;
- do not change app commercial/pricing UX;
- do not rewrite `/roadmap`;
- do not change Early Access copy;
- do not build real channel integrations;
- do not build identity resolution;
- do not redesign the entire homepage;
- do not alter Ridge decision truth merely to make placement easier.

---

# Acceptance criteria

- [ ] Signature Ridge demo appears before the simple exact-price Priya proof on the homepage.
- [ ] The homepage's first substantial product proof is decision continuity, not quoting.
- [ ] A visitor can understand `message changed → facts changed → decision changed → next action changed` without architecture language.
- [ ] `/how` no longer leads with the Priya/exact-price proof as the primary mental model.
- [ ] The same reusable signature-demo component/story is used rather than duplicated into another visual system.
- [ ] The Ridge demo retains explicit identity provenance and grounded capacity wording.
- [ ] Waitlist CTA remains prominent.
- [ ] `Open the app` remains available.
- [ ] Existing app behaviour is unchanged.
- [ ] Desktop visual QA passes.
- [ ] Mobile visual QA passes with no horizontal overflow.
- [ ] Reduced-motion presentation remains understandable.
- [ ] No new console/runtime errors are introduced.
- [ ] Typecheck passes.
- [ ] Relevant focused tests pass; pre-existing platform failures, if any, are clearly separated from new regressions.

## Required handoff

Report only:

1. homepage placement/order changes;
2. `/how` changes;
3. what happened to the Priya proof;
4. files changed;
5. typecheck/tests/build results;
6. desktop/mobile/reduced-motion QA;
7. any remaining product or visual risk.

Then stop.

**Do not begin Phase 3 until product management reviews Phase 2B and updates this file.**
