# Enquiry - First-Beta Engineering Readiness Gate

**Status:** PREPARED

This is the engineering/product gate for putting the first external businesses onto Enquiry.

It is **not** a market-validation scorecard.

Passing this file means:

> Enquiry is a technically truthful first-beta candidate that can safely learn from real service-business enquiries.

It does **not** mean product-market fit, willingness to pay or retention have been validated.

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# 1. Identity and tenancy

Required:

- [ ] Real authentication is enabled for the beta environment.
- [ ] Signed-out visitors cannot enter operator surfaces.
- [ ] Pending auth state does not create redirect/session flicker.
- [ ] Post-auth return paths cannot escape the application origin.
- [ ] Every product read/write re-derives access from the verified user identity.
- [ ] Two test tenants cannot read or mutate one another's businesses, enquiries, bookings or Brain state.
- [ ] Auth-off + real database fails closed.
- [ ] The previously committed preview credential has been revoked/rotated externally.

---

# 2. Live workspace is not the demo

Required:

- [ ] A new signed-in account is not silently provisioned as Glow & Co or another fixture business.
- [ ] F01-F20 and fixture bookings are not written into a normal live tenant.
- [ ] Real onboarding creates/persists the user's actual business workspace.
- [ ] Reload returns the persisted live workspace.
- [ ] Client/session storage cannot overwrite newer server-authoritative business/enquiry state.
- [ ] `/demo` remains isolated, public and safe.
- [ ] Live operator mode does not auto-play a fake arriving enquiry.

---

# 3. Real onboarding

At minimum the first-beta business can persist:

- [ ] business name;
- [ ] timezone;
- [ ] base location/city;
- [ ] solo/team shape;
- [ ] initial service/rule information needed for the first use case;
- [ ] voice/preferences where they actually affect prepared output;
- [ ] high-impact Business Brain rules only after explicit confirmation.

Onboarding must not mark future integrations connected merely because the user selected a preferred channel.

---

# 4. Server-authoritative operator state

The signed-in product must read/persist the meaningful tenant state through the authenticated server boundary:

- [ ] business;
- [ ] Business Brain knowledge/services;
- [ ] enquiries;
- [ ] facts + provenance;
- [ ] messages;
- [ ] current Decision Object / snapshot;
- [ ] quote versions where used;
- [ ] bookings/end-state where used;
- [ ] trust/action policies;
- [ ] meaningful audit events.

A UI/cache store is allowed. It is not allowed to be the durable source of truth for these records.

---

# 5. Non-fixture enquiry path

Required before external first-beta use:

- [ ] An authorised operator can create/process a new enquiry that is not a repository fixture.
- [ ] Manual/private paste is sufficient as the first ingestion path.
- [ ] Raw inbound content is persisted with provenance.
- [ ] Interpretation produces structured candidate facts/inferences/ambiguities/missing information.
- [ ] Applicable evaluators are selected based on the enquiry + Business Brain.
- [ ] Irrelevant evaluators remain not applicable rather than inventing missing fields.
- [ ] Unknown is preserved when the product cannot safely decide.
- [ ] Model/provider failure results in a safe human/unknown outcome.
- [ ] Missing live service duration does not fall back to demo defaults.
- [ ] Missing live travel data does not fall back to generic 10/15/20/25-minute guesses.
- [ ] Missing booking date/time does not create a synthetic "now" or 09:00 booking.
- [ ] Live real enquiries are not labelled with demo `fixtureId` values.

Production Gmail/Instagram/SMS ingestion is not required for this gate.

---

# 6. Decision correctness boundary

Required:

- [ ] LLM/model interpretation cannot directly authorise a commercial/customer action.
- [ ] Important structured rules are validated deterministically where available.
- [ ] Price is not universal.
- [ ] Availability and capacity remain distinct.
- [ ] Minimum blocker means decision-critical missing information, not every empty field.
- [ ] Same wording can produce different decisions for different Business Brains.
- [ ] A changed fact re-runs the affected decision state without erasing history.
- [ ] Customer prompt-like content cannot modify system authority/Business Brain rules.

---

# 7. Correction and persistence loop

Required:

- [ ] Operator can correct/confirm a fact.
- [ ] Prior fact/provenance remains recoverable through supersession/history.
- [ ] Decision is recomputed and persisted after correction.
- [ ] Operator can distinguish "just this enquiry" from "Teach Enquiry" where the correction is teachable.
- [ ] High-impact learned rule changes still require confirmation.
- [ ] Notes/snooze/follow-up/lost-or-declined state survive reload where exposed.
- [ ] Meaningful changes append server-side audit evidence.

---

# 8. Review-first action loop

The first cohort does not require fake integrations.

Required:

- [ ] Enquiry can prepare a grounded next action/draft.
- [ ] Owner can accept, edit or reject the recommendation.
- [ ] A copied/manual response is labelled as manual/copy/recorded, not falsely "sent by Enquiry".
- [ ] Later customer information can be added to the same enquiry.
- [ ] Decision state recompiles after that update.
- [ ] Enquiry can reach a truthful booked/lost/handoff end state.
- [ ] Recommendation remains separate from action authority.

---

# 9. Public/customer surfaces

Required:

- [ ] `/demo` is a safe no-account product proof.
- [ ] Normal operator routes require auth.
- [ ] Short fixture/internal IDs do not expose customer quote/booking records in production-capable public routes.
- [ ] If no real public capability-link model exists, public no-account quote/booking routes fail closed outside explicit demo/local mode.
- [ ] No public copy claims production integrations that are still simulated.
- [ ] No installable-app claim before Phase 10A verifies it.

---

# 10. Beta learning telemetry

The first cohort must generate evidence without requiring live interviews.

Capture enough structured evidence to determine:

- [ ] recommendation accepted unchanged;
- [ ] substantively edited;
- [ ] rejected;
- [ ] fact correction;
- [ ] Business Brain/rule correction;
- [ ] minimum-blocker correction where detectable;
- [ ] action-authority override;
- [ ] booked/lost outcome;
- [ ] repeat use / meaningful later session.

Do not send raw customer message bodies to generic marketing/analytics systems merely to obtain these metrics.

---

# 11. Verification gate

Before first external business:

- [ ] `npm run typecheck` passes.
- [ ] Full default test discovery executes the intended suite.
- [ ] Product regressions are green; any remaining platform/PWA harness failures are explicitly classified rather than hidden.
- [ ] Production build passes.
- [ ] Dev/runtime smoke passes.
- [ ] At least two users/tenants are used in an isolation test.
- [ ] New-account onboarding path is tested from zero membership.
- [ ] One arbitrary non-fixture enquiry completes the review-first loop.
- [ ] Reload persistence is tested after meaningful mutations.
- [ ] Desktop and phone QA pass.
- [ ] Reduced-motion QA passes for the core operator path.

---

# 12. Not required for the first five

Do not block first-beta learning solely because these are absent:

- production Gmail/Microsoft mailbox OAuth;
- Instagram/Facebook APIs;
- SMS provider;
- payment processor;
- deep external booking integration;
- public no-account capability links;
- complex cross-channel identity graph;
- native iOS/Android wrapper;
- push notifications;
- full offline sync;
- Phase 10 PWA installability.

They become evidence-driven roadmap work.

---

# Gate outcome

When every required item above is supported by the actual implementation and QA evidence, product management may declare:

> **FIRST-BETA ENGINEERING GATE PASSED**

Only then should external design partners use the operator product on real enquiries.

Market validation remains a separate behavioural process.
