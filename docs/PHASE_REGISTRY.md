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
| 2A | Complete | Signature cross-channel decision demo | 1 | Required |
| 2B | Complete | Place signature proof into public sales journey | 2A reviewed | Required |
| 3 | Complete | Remove universal price/commercial assumptions | 2B | Required |
| 4 | Complete | Curate public roadmap as sales/trust narrative | 2B + 3 | Required |
| 5 | Complete | Early Access + Updates trust copy | 4 | Required |
| 6 | Complete | Persist roadmap qualitative feedback + attribution | 5 | Required |
| 7A | Deferred | Future-safe identity/contact-point matching | 2A | Evidence-driven |
| 7B | Deferred | Reviewable possible-match UX | 7A | Evidence-driven |
| 8 | Complete | Pre-beta coherence QA | 1-6 | Complete |
| 9A | Landed; final runtime sign-off held | Premium public visual system + homepage/Ridge polish | 8 | Direction accepted |
| R1A | Complete | Cross-platform launcher + truthful full test discovery | 9A landed | Release blocker cleared |
| R1B | Code complete; external rotation pending | Remove committed preview credential | R1A | Final R1 operational blocker |
| R1C | Landed; correction required | Signed-in operator/auth boundary | R1B code | Release blocker |
| R1C1 | **Active** | Same-origin auth return-path invariant | R1C review | Release blocker |
| R1D | Prepared | Contain short-ID public quote/booking routes to demo/local use | R1C1 reviewed | Release blocker |
| R2A | Prepared | Real empty workspace bootstrap + persisted onboarding | Final R1 + 9A sign-off | Required for first beta |
| R2B | Prepared | Cut signed-in operator reads over to persisted tenant state | R2A reviewed | Required for first beta |
| R2C | Prepared | Persist Business Brain/trust/business mutations | R2B reviewed | Required for first beta |
| R2D | Prepared | Persist enquiry decision-state mutations | R2C reviewed | Required for first beta |
| R2E | Prepared | Arbitrary manual enquiry ingestion + interpretation | R2D reviewed | Required for first beta |
| R2F | Prepared | Review-first manual action loop + beta telemetry | R2E reviewed | Required for first beta |
| 9B | Prepared | Extend approved visual system across remaining public surfaces | R2 beta-core preferred | Before broader polished launch |
| 10A | Prepared | Productise PWA installability + Enquiry branding | 9B preferred | Before claiming installable |
| 10B | Prepared | Installed standalone mobile shell/operator polish | 10A reviewed | Recommended after beta core |

`CURRENT_PHASE.md` remains authoritative if this table ever lags behind a phase transition.

---

# Reviewed ungated foundation already on main

These commits are useful foundation but do **not** count as R2 completion:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` — relational product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` — RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` — tenancy/repository/workspace server boundary.

Why they are not a beta gate:

- operator components still use `usePrototype` as runtime state;
- `fetchWorkspace` is not yet the authoritative app read path;
- normal provisioning currently seeds demo fixture data into a real tenant;
- arbitrary non-fixture enquiry interpretation is not implemented.

R2 is the controlled cutover from this foundation into a real first-beta product.

---

# Detailed briefs

## Phase 7
`docs/phases/PHASE_7_SAFE_IDENTITY_CONTINUITY.md`

Deferred unless real beta evidence requires broader identity continuity.

## Phase 8
`docs/phases/PHASE_8_FINAL_COHERENCE_QA.md`

Signed off pre-beta coherence gate.

## Phase 9
`docs/phases/PHASE_9_VISUAL_BRAND_POLISH.md`

- 9A landed and visually accepted.
- Final runtime sign-off waits for R1.
- 9B is intentionally secondary to making the operator product real/persisted.

## R1
`docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`

R1 state:

- R1A complete;
- R1B code remediation complete, external credential rotation/revocation pending;
- R1C implementation landed;
- R1C1 active correction;
- R1D prepared;
- final R1 gate after R1D.

### R1C1
`docs/phases/PHASE_R1C1_SAFE_AUTH_RETURN_PATH.md`

One narrow tested invariant for same-origin post-auth return paths.

## R2
`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

R2 turns the fixture/session-storage operator prototype into a truthful first-beta product.

Split:

- **R2A:** real workspace bootstrap + onboarding persistence;
- **R2B:** signed-in server-authoritative workspace read cutover;
- **R2C:** persisted Business Brain/trust/business mutations;
- **R2D:** persisted enquiry decision-state mutations;
- **R2E:** arbitrary manual enquiry ingestion + interpretation;
- **R2F:** review-first manual action loop + beta telemetry.

## Phase 10
`docs/phases/PHASE_10_INSTALLABLE_PWA_MOBILE.md`

Installable/mobile productisation remains prepared, but it is not a blocker for the first five if the web product is safe, persisted and mobile-usable.

---

# Current deliberate path

The approved product/coherence path is complete:

> **1 -> 2A -> 2B -> 3 -> 4 -> 5 -> 6 -> 8**

Current release/productisation path:

> **9A landed -> R1A complete -> R1B code fixed / rotation pending -> R1C landed -> R1C1 active -> R1D -> final R1 -> final 9A sign-off -> R2A -> R2B -> R2C -> R2D -> R2E -> R2F -> first-beta core gate -> 9B -> 10A -> 10B**

### Market work in parallel

After final R1 confirms the public demo/waitlist funnel is safe, qualified market traffic and asynchronous waitlist research may begin while R2 is being built.

Do not wait for PWA work to start audience building.

Do not put external first-cohort businesses onto the product until the R2 beta-core gate passes.

---

# First-beta engineering definition

The engineering definition is maintained in:

`docs/BETA_READINESS_GATE.md`

A first-beta candidate must have, at minimum:

- verified auth + tenancy;
- no silent fixture seeding into live tenants;
- real persisted onboarding;
- server-authoritative signed-in workspace;
- arbitrary non-fixture manual enquiry processing;
- structured interpretation + deterministic decision validation;
- persisted correction/re-evaluation;
- review-first/manual truthful action loop;
- audit/tenant isolation;
- beta correction/outcome telemetry;
- public demo isolated from live tenant data.

Production Gmail/Instagram/SMS/payment integrations are **not** required for the first five.

---

# Stop conditions

Pause sequencing and return to product management if any slice reveals:

- the core Decision Engine cannot support intended behaviour without major architecture work;
- a public claim requires pretending an integration exists;
- work starts turning Enquiry into a CRM/workflow builder/shared inbox/FSM;
- cross-industry behaviour requires niche hard-coding;
- a meaningful new security/privacy issue appears;
- later phases land before authorisation;
- demo fixtures leak into normal live tenant behaviour;
- an LLM is allowed to directly authorise/transact commercial outcomes;
- visual polish changes product truth rather than presentation;
- installability becomes an unjustified native-platform rewrite.

---

# Parking lot

Do not pull these into an active phase without evidence/new decision:

- production Gmail/Microsoft mailbox OAuth;
- production Instagram/Facebook APIs;
- production SMS provider;
- deep booking integrations;
- payment collection;
- full CRM;
- generic workflow builder;
- complex identity graph;
- post-booking project/fulfilment management;
- native iOS/Android wrapper;
- push notifications;
- public server-backed capability links unless beta requires no-account quote/booking sharing.

---

# Management principle

The internal plan can be detailed.

The public product stays simple:

> enquiry arrives -> Enquiry understands -> business-specific decision -> next action -> booked or lost.
