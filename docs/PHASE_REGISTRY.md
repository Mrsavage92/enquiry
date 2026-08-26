# Enquiry — Implementation Phase Registry

This file is the management index for the sequenced Enquiry build.

**Execution authority remains `docs/CURRENT_PHASE.md`.**

A phase being `PREPARED` here does not mean Grok may execute it.

---

## Operating rule

1. Grok reads `AGENTS.project.md`.
2. Grok reads `docs/CURRENT_PHASE.md`.
3. Grok reads only the detailed phase brief referenced there plus any source files it needs.
4. Grok implements that bounded phase.
5. Grok tests/QA/reports and stops.
6. Product management reviews the actual commit.
7. Product management advances `CURRENT_PHASE.md` only after sign-off.

Do not tell Grok to "continue through the phases".

---

# Registry

| Phase | Status | Purpose | Dependency | First-beta importance |
|---|---|---|---|---|
| 0 | Complete | Product/build management guardrails | — | Required |
| 1 | Complete | Reposition public site around decision layer | 0 | Required |
| 2A | Complete | Build signature cross-channel decision demo | 1 | Required |
| 2B | Complete | Place signature demo into public sales journey | 2A reviewed | Required |
| 3 | Active | Remove universal price/commercial assumptions | 2B | Required |
| 4 | Prepared | Curate public roadmap into sales/trust narrative | 2B + preferably 3 | Required before public waitlist push |
| 5 | Prepared | Polish Early Access + Updates trust copy | 4 preferred | Required before public waitlist push |
| 6 | Prepared | Persist roadmap qualitative feedback + attribution | 4 | Strongly recommended before meaningful traffic |
| 7A | Prepared | Future-safe identity/contact-point model + deterministic match | 2A | Can defer until after first beta if needed |
| 7B | Prepared | Reviewable possible-match UX | 7A reviewed | Can defer until evidence requires it |
| 8 | Prepared | Final coherence/release QA | chosen phases complete | Required before first beta release candidate |

`CURRENT_PHASE.md` remains authoritative if this table ever lags behind a phase transition.

---

# Detailed briefs

## Phase 2
`docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

Phase 2 is deliberately split:

- **2A:** build and prove the component/demo in isolation;
- **2B:** after review, place it into homepage/How sales flow and demote quote-first proof.

## Phase 3
`docs/phases/PHASE_3_NON_UNIVERSAL_COMMERCIAL_UX.md`

Key gate: price must disappear when pricing is genuinely not applicable, while exact/estimate/unresolved pricing still work for businesses where it matters.

## Phase 4
`docs/phases/PHASE_4_PUBLIC_ROADMAP_SALES_PAGE.md`

Key gate: roadmap is customer-facing sales/trust narrative, not this implementation registry or an engineering backlog.

## Phase 5
`docs/phases/PHASE_5_PUBLIC_TRUST_AND_EARLY_ACCESS_COPY.md`

Key gate: preserve honesty without founder/process language leaking into customer-facing copy.

## Phase 6
`docs/phases/PHASE_6_ROADMAP_RESEARCH_PERSISTENCE_ATTRIBUTION.md`

Key gate: volunteered roadmap problem text becomes actual research data and roadmap events keep attribution.

## Phase 7
`docs/phases/PHASE_7_SAFE_IDENTITY_CONTINUITY.md`

Split into:

- **7A:** model + deterministic continuity only;
- **7B:** suggestive possible-match UX after 7A review.

Do not collapse this into a production identity graph.

## Phase 8
`docs/phases/PHASE_8_FINAL_COHERENCE_QA.md`

Release gate, not a feature phase.

---

# Recommended first-beta critical path

Unless product evidence changes priorities:

> Phase 1 → 2A → review → 2B → 3 → 4 → 5 → 6 → 8 → first 5 businesses

Phase 7 can be inserted before Phase 8 if cross-channel identity behaviour becomes necessary for the first cohort, but should **not** delay first beta merely to build infrastructure for hypothetical channel ambiguity.

Why:

- Phase 2 demo can truthfully use deterministic same-phone continuity without a general identity graph.
- first beta can begin with controlled channel/input paths;
- real identity ambiguity should be validated before building a larger system.

---

# Stop conditions

Pause sequencing and return to product management if any phase reveals:

- the core Decision Engine cannot support the intended behaviour without major architecture work;
- a public claim would require pretending an integration exists;
- a phase requires turning Enquiry into a CRM/workflow builder/shared inbox;
- cross-industry behaviour requires niche hard-coding;
- a meaningful security/privacy issue is discovered;
- Grok proposes broad refactoring unrelated to the phase acceptance criteria.

---

# Parking lot — not part of this sequence

Do not pull these into an active phase without a new decision:

- real Gmail/Microsoft mailbox OAuth;
- production Instagram/Facebook APIs;
- production SMS provider;
- deep booking integrations;
- payment collection;
- full customer CRM;
- generic workflow builder;
- referral gamification;
- paid acquisition;
- tenant fine-tuning;
- complex ML identity resolution;
- post-booking project/fulfilment management.

---

# Management principle

The internal plan can be detailed.

The public product should feel simple:

> enquiry arrives → Enquiry understands → business-specific decision → next action → booked or lost.

Never copy this registry or implementation detail onto the public roadmap.