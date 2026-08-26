# Enquiry — Current Implementation Phase

## Current phase

**Phase 3 — Remove universal commercial / quote assumptions**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_3_NON_UNIVERSAL_COMMERCIAL_UX.md`
- `docs/TEST_REGRESSION_POLICY.md`

## Completed gates

### Phase 1
**SIGNED OFF.** Public positioning now leads with the decision layer rather than phone-first quoting.

### Phase 2A
**SIGNED OFF.** Ridge & Co / Maya signature demo is grounded in explicit business truth and deterministic same-phone continuity.

### Phase 2B
**SIGNED OFF.**

The signature demo is now the first substantial public proof on the homepage and `/how`:

- hero and waitlist remain intact;
- Ridge appears immediately after the hero/intro on the homepage;
- same enquiry → changed facts → changed business decision is visible before quote-first proof;
- current phone/app proof remains secondary evidence;
- Priya remains as a deliberately secondary example of a job where exact pricing can be decided;
- `/how` reuses the same signature component rather than creating another visual system;
- no Phase 3 product work was bundled into Phase 2B.

Do not revisit Phase 2 unless Phase 3 exposes an actual regression.

---

# Execute Phase 3 only

Read the full detailed brief:

`docs/phases/PHASE_3_NON_UNIVERSAL_COMMERCIAL_UX.md`

## Objective

Make the app visibly agree with Enquiry's modular Decision Engine:

> **Pricing is one possible evaluator. It is not a universal property of every enquiry.**

A non-price enquiry must not look incomplete merely because there is no price.

## Confirmed current-code problems

These have been re-verified after Phase 2.

### 1. Enquiry detail still forces commercial UI

`src/components/enquiry/intelligence.tsx` currently does:

- show quote sheets if present;
- otherwise, on desktop/non-compact, render a universal `Commercial value` section.

This means an enquiry can receive a commercial panel even when pricing is not applicable.

### 2. `commercialValue()` conflates NOT_APPLICABLE with unresolved pricing

`src/domain/labels.ts` currently maps pricing statuses including `NOT_APPLICABLE` into:

> `Price not ready`

That is semantically wrong.

Required distinction:

- pricing applies + exact → exact;
- pricing applies + estimate/range → estimate;
- pricing applies but cannot yet be decided → price not ready;
- pricing does not apply → **no price/commercial UI**.

Do not use `$0`, `N/A`, `No price`, or `Price not ready` for a genuinely non-applicable evaluator.

### 3. Desktop queue still makes money the universal headline

`src/components/enquiry/queue.tsx` currently leads with:

- `Open exact`;
- aggregate exact-dollar amount;
- `N exact · N active`.

Phone already leads with `N need you`, which is much closer to the universal operator question.

Desktop should become attention-first/adaptive without turning into a KPI dashboard.

## Required implementation direction

Use the smallest domain/UI change that makes applicability explicit.

A typed `not_applicable` commercial result or a dedicated applicability helper is acceptable.

Do **not** infer applicability only from whether an amount exists.

Preserve quote sheets and all commercial behaviour where pricing really applies.

### Detail behaviour

- If quote sheets exist and pricing is relevant, keep them.
- If pricing is applicable but unresolved, keep honest unresolved price language.
- If pricing is NOT_APPLICABLE, render no commercial-value section at all.
- If the pricing evaluator is absent, inspect the enquiry semantics rather than blindly treating absence as either price-ready or non-applicable.

### Queue behaviour

The desktop header should first answer attention/state, for example:

- `N need you`;
- useful waiting / at-risk context where appropriate.

A compact commercial aggregate may remain only when it is genuinely useful for the current business/filter and based on applicable values.

Do not replace the current header with a row of generic dashboard cards.

## Proof requirement

Use an existing clearly non-price-centric fixture if available. Inspect F17 / Atelier Field and choose the smallest valid proof.

The proof must visibly demonstrate that an enquiry can be complete/actionable without any price panel.

Do not create a new industry unless no existing fixture can prove it.

## Preserve

Do not regress:

- exact pricing;
- estimate/range pricing;
- unresolved-but-applicable pricing;
- quote versioning;
- quote sheet vs draft-letter separation;
- price-drift / mismatch detection;
- evaluator visibility;
- queue filters;
- mobile Today flow;
- Phase 2 public signature demo.

## Do not do

- no reporting dashboard;
- no revenue analytics;
- no removal of pricing functionality;
- no whole-workspace redesign;
- no roadmap work;
- no Early Access copy work;
- no Phase 4;
- no unrelated refactors.

## Acceptance criteria

- [ ] Pricing `NOT_APPLICABLE` cannot become `Price not ready`.
- [ ] An enquiry with genuinely non-applicable pricing renders no commercial-value placeholder/panel.
- [ ] Applicable unresolved pricing still renders an honest unresolved state.
- [ ] Exact pricing remains exact.
- [ ] Range/estimate pricing remains estimate/range.
- [ ] Desktop queue no longer universally presents `Open exact` / exact-dollar value as the primary object.
- [ ] Desktop queue remains useful when zero visible enquiries have applicable commercial values.
- [ ] Price-centric business/filter views still look intentional.
- [ ] At least one existing non-price-centric fixture visibly proves the behaviour.
- [ ] Mobile Today flow remains coherent.
- [ ] Focused tests cover not-applicable, unresolved-applicable, exact, estimate/range, and non-commercial queue behaviour.
- [ ] Typecheck passes.
- [ ] Relevant tests pass under the regression policy.
- [ ] Desktop/mobile QA passes.

## Required handoff

Report only:

1. how commercial applicability is represented;
2. detail-page behaviour changed;
3. desktop queue behaviour changed;
4. fixture used to prove non-applicable pricing;
5. files changed;
6. tests/typecheck/QA results;
7. any remaining UI location that still assumes every enquiry has a price.

Then stop.

**Do not begin Phase 4 until product management reviews Phase 3 and updates this file.**
