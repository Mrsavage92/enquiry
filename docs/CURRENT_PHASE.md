# Enquiry — Current Implementation Phase

## Current phase

**Phase 2A — Signature cross-channel decision demo — CORRECTION GATE**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

## Phase 1 status

**SIGNED OFF.** Do not revisit unless a regression is introduced.

## Phase 2A review status

The interaction pattern itself passes the intended product story:

- website form → later text;
- explicit same-phone linking rather than magical identity matching;
- changed scope/deadline are visible;
- the next action changes;
- price is secondary;
- the demo is isolated at `/demo` and Phase 2B has not been started.

However, product management has **not signed off Phase 2A yet** because the flagship decision currently overstates the Business Brain evidence.

---

# Required corrections only

Do not begin Phase 2B.

## 1. Ground the capacity conclusion in explicit Ridge & Co business truth

Current public demo claims:

- initial scope is `Feasible with the two-person weekday crew`;
- after the deadline/scope change it becomes `Feasible with condition — third contractor required`.

The existing Ridge & Co Business Brain currently establishes only that:

- there are two painters on weekdays;
- a third contractor can be booked with 48 hours notice;
- feasibility needs scope/access/deadline facts.

That is **not enough** to deterministically conclude that the first job fits two painters or that the revised job specifically requires a third painter.

This matters because Enquiry's product contract says **Unknown beats guessing** and material recommendations must be grounded in business truth.

### Correct implementation

Add the smallest explicit, fixture-level Ridge capacity knowledge needed to make this particular demonstration valid.

Preferred shape:

- a confirmed/active operational or capacity rule attributed to Tom / setup;
- enough detail to explain the initial provisional crew fit and why the revised deadline + ceilings changes the crew requirement;
- preserve that the living areas still require a site measure for the final quote;
- if the capacity assessment is provisional pending the measure, say so rather than presenting certainty that the rule does not justify.

Do **not** build a generic scheduling/capacity engine.

Do **not** invent an invisible rule only inside JSX. The decision must be traceable to explicit demo/business truth.

Where practical, make the public `Why?` wording reflect that grounded rule without exposing internal IDs.

Add/adjust a focused test so the demo's capacity conclusion cannot drift away from the Ridge knowledge that supports it.

## 2. Remove the phone-number collision in fixture/demo data

The demo currently uses `0412 880 441` for Maya. That number is already present elsewhere in the repository as a business SMS contact.

Give Maya a distinct fictional/example mobile value that is not already used by another fixture or integration, while preserving the same-number linking proof between her form and later text.

Add a small fixture/test guard if it is cheap and local; do not build global contact validation infrastructure.

## 3. Keep everything else stable

Do not redesign the demo.
Do not place it on the homepage yet.
Do not modify `/how` yet.
Do not start Phase 3.
Do not add real integrations or identity resolution.

---

# Correction acceptance criteria

- [ ] Initial/revised capacity claims are supported by explicit Ridge business truth rather than an unstated assumption.
- [ ] Any remaining uncertainty from the site measure is represented honestly.
- [ ] `Why?` explains the decision using customer-facing language grounded in that rule.
- [ ] Maya's mobile no longer collides with another fixture/integration value.
- [ ] Website form and later SMS still match on the same known mobile.
- [ ] Existing Phase 2A interaction/visual behaviour remains intact.
- [ ] Focused signature-demo tests pass.
- [ ] Typecheck passes.
- [ ] Desktop/mobile/reduced-motion QA remains clean.

## Required handoff

Report only:

1. explicit Ridge rule/truth added or changed;
2. capacity/demo wording changed;
3. phone value changed;
4. files changed;
5. tests/typecheck/QA results;
6. any remaining uncertainty.

Then stop.

**Do not begin Phase 2B until product management updates this file.**
