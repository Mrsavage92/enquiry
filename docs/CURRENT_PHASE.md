# Enquiry - Current Implementation Phase

## Current phase

**Phase 5 - Public trust copy: Early Access + Updates**

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
**SIGNED OFF.**

The public roadmap is now a curated sales/trust narrative rather than an engineering backlog:

- six customer-facing eras replace the old detailed stage structure;
- the eras are Understand the enquiry, Understand your business, One enquiry even when the conversation moves, Keep enquiries moving, Trusted action, and the self-maintaining enquiry layer;
- Connect, Leak, evaluator architecture and other internal implementation concepts are no longer top-level public roadmap stages;
- continuity is explicitly framed as one coherent enquiry, not a unified inbox;
- channel support is described progressively and the page states that not every production integration is live;
- pricing/capacity remain conditional rather than universal;
- autonomy remains earned per action class and permission-based;
- the endgame remains bounded at first enquiry to booked or lost;
- `I need this` remains on continuity, keep-moving and trusted-action only;
- legacy roadmap-interest IDs map to the new canonical public-era IDs so existing intent does not become orphaned;
- the homepage roadmap preview is reduced to three meaningful states.

GitHub exposes no Actions/check status for the Phase 4 commit, so local typecheck/test execution cannot be independently verified from repository status. Source review found no implementation regression that warrants holding the product gate, and focused tests were added for the six-era structure, public statuses, intent placement, legacy-ID compatibility, non-universal pricing language, continuity framing and permission-based autonomy.

Do not revisit Phases 1-4 unless Phase 5 reveals a real regression.

---

# Execute Phase 5 only

Read the full detailed brief:

`docs/phases/PHASE_5_PUBLIC_TRUST_AND_EARLY_ACCESS_COPY.md`

## Objective

Polish the customer-facing trust/access language so Enquiry remains unusually candid without sounding like an internal founder or product-management memo.

The result should feel deliberate, confident and early - not apologetic, amateur, artificially scarce or over-marketed.

## Early Access

Preserve:

- email-first waitlist conversion;
- optional qualification after signup;
- gradual cohort rollout;
- no fake scarcity or queue-position gimmicks;
- no unsupported price or permanent founding-discount promise;
- clear intent that Enquiry is expected to become a paid product.

Replace process-heavy wording such as `not pad a list`, `learning can absorb`, feature-vote language and speculative founding-user pricing with plain customer language.

Preferred message:

- access opens gradually because Enquiry is making business decisions, not merely drafting text;
- early businesses can tell us where Enquiry helps and where it still gets in the way;
- pricing will be communicated before any paid access begins.

Do not make exact cohort sizes prominent unless there is a current operational reason.

## Updates

`/updates` must behave as curated meaningful build-in-public progress, not release notes.

Keep or create only entries that materially help a prospective customer understand:

- a meaningful product behaviour becoming real;
- an important product decision and why;
- a material correction or learning;
- first-user evidence when it actually exists;
- a major customer-visible roadmap milestone.

Do not publish routine implementation phases, dependency/database work, minor UI changes, test counts or quote-sheet trivia simply because they happened.

Do not manufacture historic dates or claim milestones that have not occurred.

## Cross-page consistency

Review only trust/access wording where relevant in:

- `/early-access`;
- `/updates`;
- homepage access/cohort wording if inconsistent;
- waitlist success copy or footer snippets if they repeat stale process language.

Do not launch a broad site rewrite. Preserve Phase 1 positioning, the Phase 2 continuity proof, Phase 3 non-universal evaluator behaviour and the Phase 4 roadmap narrative.

## Do not do

- no Phase 6 persistence/attribution/schema work;
- no pricing-model design;
- no waitlist CRM/admin system;
- no email automation;
- no referral system;
- no roadmap architecture changes;
- no identity engine;
- no PWA/mobile productisation;
- no Phase 9 visual redesign;
- no unrelated app changes.

## Acceptance criteria

- [ ] Early Access feels honest and polished rather than like an internal experiment description.
- [ ] Gradual access is clear without fake scarcity.
- [ ] Enquiry's intended paid nature is clear without an unvalidated price/discount promise.
- [ ] Current cohort mechanics are not over-explained.
- [ ] `/updates` is visibly curated meaningful progress, not release notes.
- [ ] Quote-specific implementation trivia no longer dominates public update history.
- [ ] Public copy remains consistent with the decision-layer positioning and Phase 4 roadmap truth.
- [ ] Waitlist remains email-first with optional qualification and no new required fields.
- [ ] No fabricated milestone/date/user evidence is introduced.
- [ ] Typecheck passes.
- [ ] Desktop/mobile QA is completed.

## Required handoff

Report only:

1. public copy sections changed;
2. update entries retained/removed/rewritten and why;
3. files changed;
4. typecheck/test results;
5. desktop/mobile QA;
6. any remaining public text that still sounds like internal strategy language.

Then stop.

**Do not begin Phase 6 until product management reviews Phase 5 and updates this file.**
