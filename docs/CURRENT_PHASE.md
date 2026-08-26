# Enquiry — Current Implementation Phase

## Current phase

**Phase 4 — Public roadmap as a sales / trust page**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_4_PUBLIC_ROADMAP_SALES_PAGE.md`
- `docs/TEST_REGRESSION_POLICY.md`

## Completed gates

### Phase 1
**SIGNED OFF.** Public positioning leads with the decision layer rather than phone-first quoting.

### Phase 2A
**SIGNED OFF.** Ridge & Co / Maya signature demo is grounded in explicit business truth and deterministic same-phone continuity.

### Phase 2B
**SIGNED OFF.** The Ridge decision-continuity proof is the first substantial public proof on the homepage and `/how`; Priya remains secondary exact-price evidence.

### Phase 3
**SIGNED OFF.**

The visible app now agrees with the modular Decision Engine:

- pricing `NOT_APPLICABLE` is represented as a true `not_applicable` commercial result rather than `Price not ready`;
- non-price enquiries render no commercial placeholder or fake value;
- Rowan / F17 proves qualification and package selection can be the active decision while pricing is explicitly not applicable;
- applicable unresolved pricing still remains `Price not ready`;
- exact and estimate/range behaviour are preserved;
- desktop queue now leads with attention (`N need you`) rather than `Open exact` / a dollar aggregate;
- waiting / at-risk context remains visible;
- exact commercial aggregate remains secondary only when exact values actually exist;
- queue rows hide commercial marks when pricing is not applicable;
- mobile queue retains its attention-first model;
- no public-site Phase 4 work was bundled into Phase 3.

The current `pricingApplicability()` treatment of an absent pricing evaluator is accepted for this prototype because dynamic evaluator selection means an unselected evaluator is not currently applicable, while `EVALUATING` enquiries are presented as Reading rather than as a completed commercial result. Revisit only if a future engine state needs to distinguish `not selected yet` from `not applicable` after evaluation.

Do not revisit Phases 1–3 unless Phase 4 reveals a real regression.

---

# Execute Phase 4 only

Read the full detailed brief:

`docs/phases/PHASE_4_PUBLIC_ROADMAP_SALES_PAGE.md`

## Objective

Turn `/roadmap` into a high-trust customer-facing sales narrative rather than a public engineering backlog.

A prospective customer should be able to understand:

1. what Enquiry can genuinely do now;
2. what major capability is being built;
3. what meaningful customer outcomes come next;
4. the long-term endgame;
5. that future direction is communicated honestly rather than overpromised.

## Canonical public structure

Use approximately six customer-facing eras:

1. **NOW — Understand the enquiry**
2. **BUILDING — Understand your business**
3. **NEXT — One enquiry, even when the conversation moves**
4. **NEXT — Keep enquiries moving**
5. **LATER — Trusted action**
6. **ENDGAME — The self-maintaining enquiry layer**

Exact supporting copy may be refined, but do not turn these back into implementation stages.

## Required principles

- preserve the current editorial Enquiry visual identity;
- preserve a strong journey/progress feeling;
- retain `I need this` only where it provides useful intent evidence;
- keep honesty such as `Some of this works today. Some of it is being built. Some of it still needs to earn its place.`;
- explicitly keep the endgame boundary `first enquiry → booked or lost`;
- supported/production channel connections must be described progressively rather than implying every integration is live;
- future autonomy must remain permission-based / earned rather than a giant AI-on switch;
- roadmap items must describe outcomes a buyer cares about.

## Remove / demote from public roadmap

Do not expose top-level roadmap stages for:

- evaluator architecture;
- state-model implementation;
- database/API plumbing;
- quote drift;
- internal identity-model work;
- individual integration plumbing;
- bug fixes;
- technical refactors;
- internal implementation phases 0–10.

Those remain internal.

## Preserve

- homepage and `/how` Phase 2 positioning;
- Phase 3 non-universal pricing behaviour;
- waitlist flow;
- current navigation;
- roadmap intent capture where still appropriate;
- accessibility and reduced-motion behaviour.

## Do not do

- no Phase 5 Early Access / Updates rewrite;
- no Phase 6 persistence/schema work beyond what is strictly necessary to keep current roadmap interactions functioning;
- no identity engine;
- no PWA/mobile productisation;
- no Phase 9 visual redesign;
- no unrelated app changes.

## Acceptance criteria

- [ ] Public roadmap has materially fewer, larger customer-facing eras than the old detailed plan.
- [ ] Every visible era expresses a customer capability/outcome rather than an implementation task.
- [ ] `Working now` / `Building` / `Next` / `Later` status language is understandable without decoding internal planning mechanics.
- [ ] The signature continuity story appears in the roadmap without overclaiming production channel support.
- [ ] Pricing/capacity are not described as universal.
- [ ] Trusted action remains earned and explicitly permission-based.
- [ ] Endgame is clear and bounded at booked/lost.
- [ ] The page still feels substantial, visionary and visually Enquiry — not stripped down or generic.
- [ ] `I need this` remains functional where retained.
- [ ] Homepage roadmap preview, if affected, remains coherent with the new public structure.
- [ ] Typecheck and relevant tests pass.
- [ ] Desktop/mobile/reduced-motion QA passes.

## Required handoff

Report only:

1. old public roadmap structure removed/reduced;
2. final customer-facing eras and statuses;
3. how current vs future capability is communicated;
4. what happened to `I need this`;
5. files changed;
6. tests/typecheck/build results;
7. desktop/mobile/reduced-motion QA;
8. any remaining roadmap claim that may be ahead of implemented reality.

Then stop.

**Do not begin Phase 5 until product management reviews Phase 4 and updates this file.**
