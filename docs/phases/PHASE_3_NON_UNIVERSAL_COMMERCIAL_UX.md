# Phase 3 — Remove Universal Commercial / Quote Assumptions

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 3.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

---

## 1. Objective

Make the visible app match the core product architecture:

> Pricing is one possible evaluator. It is not a mandatory property of every enquiry.

Enquiry must not visually imply that every enquiry is primarily a quote opportunity.

This phase is a focused UX/domain correction, not a workspace redesign.

---

## 2. Current problems to verify before editing

Inspect the current implementation first; some details may have moved during Phase 2.

Known baseline issues:

### Enquiry detail
`src/components/enquiry/intelligence.tsx` currently falls back to a `Commercial value` section whenever no quote sheets exist.

`commercialValue()` in `src/domain/labels.ts` can return `Price not ready` even when the pricing evaluator is `NOT_APPLICABLE`.

That incorrectly says there is a price problem when there is actually **no pricing question at all**.

### Desktop queue
`src/components/enquiry/queue.tsx` currently foregrounds:

- `Open exact`
- total exact-value amount
- `N exact · N active`

That is useful for some businesses but must not be the universal framing of Enquiry.

---

## 3. Required domain behaviour

Introduce or use a clear concept of **commercial applicability**.

The UI must distinguish these states:

### A. Pricing applies + exact
Show the exact commercial value / quote state normally.

### B. Pricing applies + range / estimate
Show the estimate normally.

### C. Pricing applies + not currently decidable
Show `Price not ready` only when pricing genuinely applies but facts/rules/integration state prevent a reliable outcome.

### D. Pricing does not apply
Render **no commercial-value section** and no placeholder price language.

Do not rename `NOT_APPLICABLE` into a fake unresolved state.

### E. Pricing evaluator absent
Treat this carefully. Prefer the architecture’s intended evaluator/result semantics rather than assuming absence always means `NOT_APPLICABLE`. Preserve current fixture compatibility where possible.

---

## 4. Detail-page implementation

Inspect:

- `src/components/enquiry/intelligence.tsx`
- `src/domain/labels.ts`
- quote components

Expected direction:

- expose a helper such as `pricingApplicability(enquiry)` or make `commercialValue()` capable of returning a true `not_applicable` result;
- do **not** make components infer applicability from `valueExact` alone;
- preserve quote sheets when they exist;
- preserve exact / estimate / unresolved presentation;
- hide commercial UI entirely when price is irrelevant.

Avoid adding a blank card, `N/A`, `$0`, `No price`, or `Price not ready` merely to preserve layout symmetry.

---

## 5. Queue implementation

The queue must continue answering the operator’s first question:

> What needs me?

The top desktop summary should be useful across different business phenotypes.

Preferred behaviour:

### Universal information
Prioritise attention/state information such as:

- `N need you`
- `N waiting`
- `N at risk`

### Optional commercial context
Commercial aggregate may appear only when it is materially meaningful for the current business/filter and supported by actual applicable values.

Do not create a dashboard full of KPI cards.

Do not replace one universal metric with another arbitrary universal metric.

A simple adaptive header is preferred.

If all/sufficient open enquiries in the current context are price-centric, retaining a compact value signal is fine.

If the current business/enquiries are non-price-centric, price should disappear without the layout looking broken.

---

## 6. Required proof fixture

Use an existing non-price-centric fixture if one already correctly models `pricing: NOT_APPLICABLE`.

The original prototype referenced F17 as a same-engine/different-evaluator example. Inspect whether it still exists and is suitable.

If no suitable fixture exists, add the **smallest possible fixture** using an existing business such as Atelier Field / professional service where the next decision is qualification/package/routing and pricing is not applicable at that moment.

Do not create a whole new industry just for this phase.

---

## 7. Tests

Add focused domain/component-adjacent tests where current test architecture allows.

Must cover at least:

1. pricing `NOT_APPLICABLE` does not become `Price not ready`;
2. applicable but blocked pricing still produces `Price not ready` or equivalent;
3. exact pricing remains exact;
4. estimate/range remains estimate;
5. queue summary does not require a commercial aggregate to render correctly.

Do not weaken existing commercial tests to make this pass.

---

## 8. Preserve

Do not regress:

- quote versioning;
- sheet vs letter separation;
- quote/letter mismatch detection;
- amount drift detection;
- exact vs estimate semantics;
- evaluator display;
- attention filters;
- mobile Today flow;
- Phase 2 cross-channel demo.

---

## 9. Do not do

- no reporting dashboard;
- no revenue analytics project;
- no removal of pricing functionality;
- no new accounting concepts;
- no generic CRM fields;
- no redesign of the whole queue;
- no changes to public roadmap in this phase.

---

## 10. Likely files

Inspect before deciding, but likely:

- `src/domain/labels.ts`
- `src/components/enquiry/intelligence.tsx`
- `src/components/enquiry/queue.tsx`
- relevant fixtures
- domain/component tests

---

## 11. Acceptance criteria

- [ ] An enquiry whose pricing evaluator is `NOT_APPLICABLE` displays no commercial-price placeholder.
- [ ] Applicable unresolved pricing still communicates that price cannot yet be decided.
- [ ] Exact and range pricing remain correct.
- [ ] Desktop queue still gives a useful attention summary when no meaningful commercial values exist.
- [ ] Price-centric businesses still look intentional, not degraded.
- [ ] At least one clearly non-price-centric fixture visibly demonstrates the intended product behaviour.
- [ ] Mobile app remains visually coherent.
- [ ] Typecheck passes.
- [ ] Relevant tests pass.
- [ ] Desktop and mobile visual QA completed.

---

## 12. Handoff

Report:

- how commercial applicability is represented;
- exact files changed;
- fixture used to prove non-applicable pricing;
- tests/typecheck results;
- desktop/mobile QA;
- any remaining place where the UI still assumes every enquiry has a price.

Then stop. Do not begin Phase 4.