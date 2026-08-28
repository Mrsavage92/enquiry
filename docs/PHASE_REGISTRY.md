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
| R1C | Complete | Signed-in operator/auth boundary | R1B code | Release blocker cleared |
| R1C1 | Complete | Same-origin auth return-path invariant | R1C review | Release blocker cleared |
| R1D | Complete | Contain short-ID public quote/booking routes to demo/local use | R1C1 | Release blocker cleared |
| R1 Final | Repo/runtime passed; operational close pending | Full release/security/runtime verification | R1A-D | Public traffic blocked by external rotation/visual QA |
| R2A | **Active** | Real workspace bootstrap + persisted onboarding | R1 repo/runtime gate | Required for first beta |
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

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` - relational product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` - RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` - tenancy/repository/workspace server boundary;
- `ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080` - removed live fixture seeding while still retaining placeholder auto-provisioning;
- `118b2a8e2f1d9dcc2d37a322e6134868372cb06b` - made that initial creation path concurrency-safe;
- `4fd5f480824001edd5aee8d8c78cdd860ee9e5f4` - moved workspace creation behind explicit onboarding, returned zero-membership as `needsOnboarding`, and moved the action-policy catalogue into the product/domain layer.

Current reviewed foundation state:

- normal workspace fetch no longer seeds fixture enquiries/bookings/knowledge/integrations into a real tenant;
- workspace fetch no longer auto-creates a placeholder business;
- zero membership is a valid onboarding state;
- initial server-side workspace creation is concurrency-safe;
- product action policies no longer depend on fixture businesses;
- the signed-in operator runtime is still not server-authoritative because operator components still use `usePrototype` broadly;
- the current R2A correction gate remains open because the live onboarding UI still completes through prototype-store behaviour rather than the authenticated persisted server operation;
- arbitrary non-fixture enquiry interpretation is not implemented.

Do not infer R2A completion from the accepted server foundation above. `docs/CURRENT_PHASE.md` remains the authority for the active onboarding correction gate.

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
- R1C complete after R1C1;
- R1C1 complete;
- R1D complete;
- final R1 repository/runtime gate passed;
- external credential rotation/revocation remains operationally pending for public traffic;
- Phase 9A final browser visual QA remains pending for public traffic.

### R1C1
`docs/phases/PHASE_R1C1_SAFE_AUTH_RETURN_PATH.md`

Complete. One tested invariant now protects same-origin post-auth return paths.

### R1D
`docs/phases/PHASE_R1D_PUBLIC_ROUTE_CONTAINMENT.md`

Complete. Fixture-backed no-account customer routes are contained; real capability links remain deferred.

### R1 Final
`docs/phases/PHASE_R1_FINAL_STABILISATION_GATE.md`

Repository/runtime verification passed. Result: `docs/phases/R1_FINAL_GATE_RESULT.md`.

External credential rotation + browser visual/public-claim checks remain in `docs/PUBLIC_TRAFFIC_GATE.md` and do not idle R2 engineering.

## R2
`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting source review: `docs/R2_FOUNDATION_REVIEW.md`.

R2 turns the fixture/session-storage operator prototype into a truthful first-beta product.

Split:

- **R2A:** real workspace bootstrap + onboarding persistence - detailed brief `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`;
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

> **9A landed/source-accepted -> R1 repo/runtime passed -> R1 public/operational items pending in parallel -> R2A active -> R2B -> R2C -> R2D -> R2E -> R2F -> first-beta core gate -> 9B -> 10A -> 10B**

### Market work in parallel

Qualified market traffic begins only after `docs/PUBLIC_TRAFFIC_GATE.md` passes. R2 engineering continues meanwhile.

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
