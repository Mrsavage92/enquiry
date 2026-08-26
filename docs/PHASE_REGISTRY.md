# Enquiry - Implementation Phase Registry

This file is the management index for the sequenced Enquiry build.

**Execution authority remains `docs/CURRENT_PHASE.md`.**

A phase being `PREPARED` here does not mean Grok may execute it. A commit labelled with a later phase number also does not authorise or sign off that phase.

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

If later-phase code lands before authorisation, treat it as **ungated existing code**. Do not infer completion from git history. Product management must still review phases in the deliberate sequence and may require corrections before any later work continues.

---

# Registry

| Phase | Status | Purpose | Dependency | First-beta importance |
|---|---|---|---|---|
| 0 | Complete | Product/build management guardrails | - | Required |
| 1 | Complete | Reposition public site around decision layer | 0 | Required |
| 2A | Complete | Build signature cross-channel decision demo | 1 | Required |
| 2B | Complete | Place signature demo into public sales journey | 2A reviewed | Required |
| 3 | Complete | Remove universal price/commercial assumptions | 2B | Required |
| 4 | Complete | Curate public roadmap into sales/trust narrative | 2B + 3 | Required before public waitlist push |
| 5 | Complete | Polish Early Access + Updates trust copy | 4 | Required before public waitlist push |
| 6 | Active review gate | Persist roadmap qualitative feedback + attribution | 5 signed off | Strongly recommended before meaningful traffic |
| 7A | Prepared | Future-safe identity/contact-point model + deterministic match | 2A | Can defer until after first beta if needed |
| 7B | Prepared | Reviewable possible-match UX | 7A reviewed | Can defer until evidence requires it |
| 8 | Prepared - ungated code present | Pre-beta coherence/release QA gate | chosen phases complete | Required before first beta candidate |
| 9A | Prepared | Premium visual system + homepage polish; non-AI art direction | 8 preferred | Can follow first cohort, but required before broader polished launch |
| 9B | Prepared | Extend approved visual system across remaining public surfaces | 9A reviewed | Same as 9A |
| 10A | Prepared | Productise existing PWA installability + Enquiry branding | 9 preferred | Required before claiming Enquiry is installable |
| 10B | Prepared | Installed standalone mobile shell + operator-flow polish | 10A reviewed | Strongly recommended before mobile-first expansion |

`CURRENT_PHASE.md` remains authoritative if this table ever lags behind a phase transition.

Current sequencing incident:

- Phase 6 implementation commit `6d326e39ff4156d654ec515c7799779c87f2cfd6` landed before Phase 5 was formally advanced. It is now the subject of the active Phase 6 review gate.
- A Phase 8-labelled commit `836a79fccb6079b44dd4769acf56422978c75ac8` also landed early. It is not signed off and must not be extended or treated as Phase 8 completion until the formal Phase 8 gate is reached.

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

Pre-beta release/coherence gate, not a feature phase. Phase 8 proves the product and sales surfaces are coherent before later aesthetic/productisation work.

## Phase 9
`docs/phases/PHASE_9_VISUAL_BRAND_POLISH.md`

Premium visual polish and non-AI art direction.

The design should feel considered, expensive, calm and real without relying on generic AI/SaaS clichés. Preserve the existing Enquiry identity and product truth rather than redesigning from scratch.

May be split:

- **9A:** visual system + homepage + signature proof;
- **9B:** remaining public surfaces after 9A review.

## Phase 10
`docs/phases/PHASE_10_INSTALLABLE_PWA_MOBILE.md`

Installable/PWA-first mobile productisation.

Important: the repo already contains Grok platform PWA/manifest/install infrastructure. Phase 10 audits and productises that existing capability rather than blindly building a new PWA stack.

May be split:

- **10A:** installability, Enquiry app identity, manifest/icon/install flow and real-device evidence;
- **10B:** standalone mobile shell, safe areas, keyboard/back/network behaviour and operator-flow polish.

Native iOS/Android packaging remains a later evidence-based decision, not automatic Phase 10 scope.

---

# Recommended sequencing

## Lean first-beta critical path

Unless product evidence changes priorities:

> Phase 1 -> 2A -> review -> 2B -> 3 -> 4 -> 5 -> 6 -> 8 -> first 5 businesses

Phase 7 can be inserted before Phase 8 if cross-channel identity behaviour becomes necessary for the first cohort, but should **not** delay first beta merely to build infrastructure for hypothetical channel ambiguity.

Why:

- Phase 2 demo can truthfully use deterministic same-phone continuity without a general identity graph;
- first beta can begin with controlled channel/input paths;
- real identity ambiguity should be validated before building a larger system.

## Productisation path

After the product is coherent - and either before a broader public launch or after the first cohort, depending on evidence:

> Phase 8 -> 9A -> review -> 9B -> 10A -> review -> 10B

Product management may choose to run Phase 9 before the first five businesses if public visual quality is judged important enough to justify the delay. Phase 10 should not block learning unless installability is specifically required by the cohort.

Do not claim Enquiry is installable until Phase 10A has verified the real production install experience.

---

# Stop conditions

Pause sequencing and return to product management if any phase reveals:

- the core Decision Engine cannot support the intended behaviour without major architecture work;
- a public claim would require pretending an integration exists;
- a phase requires turning Enquiry into a CRM/workflow builder/shared inbox;
- cross-industry behaviour requires niche hard-coding;
- a meaningful security/privacy issue is discovered;
- Grok proposes broad refactoring unrelated to the phase acceptance criteria;
- visual polish starts changing product truth rather than presentation;
- installability work starts becoming an unjustified native/mobile-platform rewrite;
- Grok implements a later phase before `CURRENT_PHASE.md` authorises it.

---

# Parking lot - not part of this sequence

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
- post-booking project/fulfilment management;
- native iOS/Android app or wrapper unless Phase 10 evidence justifies it;
- push notifications unless a real cohort need is proven.

---

# Management principle

The internal plan can be detailed.

The public product should feel simple:

> enquiry arrives -> Enquiry understands -> business-specific decision -> next action -> booked or lost.

Never copy this registry or implementation detail onto the public roadmap.
