# Enquiry - Implementation Phase Registry

This file is the management index for the sequenced Enquiry build.

**Execution authority remains `docs/CURRENT_PHASE.md`.**

A phase being `PREPARED` here does not authorise implementation. A commit labelled with a later phase number also does not authorise or sign off that phase.

---

## Operating rule

1. The implementation agent (currently Claude) reads `AGENTS.project.md`.
2. It reads `docs/CURRENT_PHASE.md`.
3. It reads only the detailed brief referenced there plus source files needed for that slice.
4. It implements that bounded slice.
5. It tests/QA/reports and stops.
6. Product management reviews the actual diff.
7. Product management advances `CURRENT_PHASE.md` only after sign-off.

Do not tell the implementation agent to "continue through the phases".

If later-phase code lands before authorisation, treat it as **ungated existing code**. Do not infer completion from git history.

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
| 6 | Complete | Persist roadmap qualitative feedback + attribution | 5 reviewed | Complete before meaningful traffic |
| 7A | Deferred | Future-safe identity/contact-point model + deterministic match | 2A | Evidence-driven; not blocking first beta |
| 7B | Deferred | Reviewable possible-match UX | 7A reviewed | Evidence-driven; not blocking first beta |
| 8 | Complete | Pre-beta coherence/release QA gate | 1-6 complete | Passed pre-beta candidate gate |
| 9A | Landed - final sign-off held | Premium visual system + homepage/signature-proof polish | 8 | Direction accepted; runtime verification waits on R1 |
| R1A | **Active** | Cross-platform dev/build launcher + full default test discovery | 9A landed | Release blocker |
| R1B | Prepared | Remove committed preview credential + require safe server config/rotation | R1A reviewed | Release blocker |
| R1C | Prepared | Signed-in boundary for operator app/onboarding | R1B reviewed | Release blocker |
| R1D | Prepared | Contain short-ID public quote/booking routes outside demo mode | R1C reviewed | Release blocker |
| 9B | Prepared | Extend approved visual system across remaining public surfaces | R1 final + 9A sign-off | Required before broader polished launch |
| 10A | Prepared | Productise existing PWA installability + Enquiry branding | 9 preferred | Required before claiming Enquiry is installable |
| 10B | Prepared | Installed standalone mobile shell + operator-flow polish | 10A reviewed | Strongly recommended before mobile-first expansion |

`CURRENT_PHASE.md` remains authoritative if this table ever lags behind a phase transition.

---

# Detailed briefs

## Phase 2
`docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

Split into 2A component proof and 2B public placement.

## Phase 3
`docs/phases/PHASE_3_NON_UNIVERSAL_COMMERCIAL_UX.md`

Key gate: price disappears when genuinely not applicable while exact/estimate/unresolved pricing remains correct where it matters.

## Phase 4
`docs/phases/PHASE_4_PUBLIC_ROADMAP_SALES_PAGE.md`

Key gate: roadmap is customer-facing sales/trust narrative, not this registry or an engineering backlog.

## Phase 5
`docs/phases/PHASE_5_PUBLIC_TRUST_AND_EARLY_ACCESS_COPY.md`

Key gate: preserve honesty without founder/process language leaking into customer-facing copy.

## Phase 6
`docs/phases/PHASE_6_ROADMAP_RESEARCH_PERSISTENCE_ATTRIBUTION.md`

Key gate: volunteered roadmap problem text becomes durable research data and roadmap events keep attribution.

## Phase 7
`docs/phases/PHASE_7_SAFE_IDENTITY_CONTINUITY.md`

Deferred unless beta evidence makes broader identity continuity necessary. Do not build a production identity graph speculatively.

## Phase 8
`docs/phases/PHASE_8_FINAL_COHERENCE_QA.md`

Pre-beta release/coherence gate. Signed off.

## Phase 9
`docs/phases/PHASE_9_VISUAL_BRAND_POLISH.md`

Premium visual polish and non-AI art direction.

Split deliberately:

- **9A:** visual system + homepage + signature proof;
- **9B:** remaining public surfaces after 9A and R1 review.

Phase 9A implementation commit is `19843ee61fb7d2508bc0b810e8ead5cd58735ddc`. The visual direction has passed source review, but final sign-off waits for R1 to restore a trustworthy runtime/build verification loop.

## R1
`docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`

Release-blocker stabilisation inserted before Phase 9B after independent review found pre-existing issues.

Split deliberately:

- **R1A:** cross-platform launcher + truthful full test command;
- **R1B:** preview credential hygiene + rotation gate;
- **R1C:** operator-route auth boundary;
- **R1D:** contain short-ID public quote/booking routes outside explicit demo mode.

Execute one R1 slice at a time.

## Phase 10
`docs/phases/PHASE_10_INSTALLABLE_PWA_MOBILE.md`

Installable/PWA-first mobile productisation. Existing platform PWA/manifest/install infrastructure must be audited and productised rather than rebuilt blindly.

Split deliberately:

- **10A:** installability, Enquiry app identity, manifest/icon/install flow and real-device evidence;
- **10B:** standalone mobile shell, safe areas, keyboard/back/network behaviour and operator-flow polish.

Native iOS/Android packaging remains a later evidence-based decision.

---

# Current deliberate path

The product/coherence path is complete:

> 1 -> 2A -> 2B -> 3 -> 4 -> 5 -> 6 -> 8

Phase 9A implementation has landed, but a release-stabilisation gate now takes precedence:

> **9A landed -> R1A active -> review -> R1B -> review -> R1C -> review -> R1D -> final R1 gate -> final 9A sign-off -> 9B -> 10A -> review -> 10B**

The first five beta candidates can still be identified/recruited in parallel. Do not delay customer learning merely to invent additional feature phases.

Phase 7 remains deferred unless actual cross-channel ambiguity in the cohort creates evidence for it.

Do not claim Enquiry is installable until Phase 10A verifies the production install experience on real target devices/browsers.

---

# Stop conditions

Pause sequencing and return to product management if any slice reveals:

- the core Decision Engine cannot support the intended behaviour without major architecture work;
- a public claim would require pretending an integration exists;
- a phase requires turning Enquiry into a CRM/workflow builder/shared inbox;
- cross-industry behaviour requires niche hard-coding;
- a meaningful security/privacy issue outside R1 scope is discovered;
- the implementation agent proposes broad refactoring unrelated to active acceptance criteria;
- visual polish starts changing product truth rather than presentation;
- installability work starts becoming an unjustified native/mobile-platform rewrite;
- a later phase is implemented before `CURRENT_PHASE.md` authorises it;
- R1 security fixes are replaced with cosmetic client-side obfuscation.

---

# Parking lot - not part of the active sequence

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
- push notifications unless a real cohort need is proven;
- a production server-backed public capability-link system unless beta evidence requires no-account quote/booking sharing.

---

# Management principle

The internal plan can be detailed.

The public product should feel simple:

> enquiry arrives -> Enquiry understands -> business-specific decision -> next action -> booked or lost.

Never copy this registry or implementation detail onto the public roadmap.
