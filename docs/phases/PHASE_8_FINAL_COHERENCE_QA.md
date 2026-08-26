# Phase 8 — Final Coherence + QA Gate

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 8.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

This is not a feature phase. It is a release-coherence gate.

---

## 1. Objective

Verify that the public site, roadmap, waitlist and prototype app now tell the **same product story** and that the strongest differentiating behaviour is visible without overclaiming production capability.

The phase should find contradictions and regressions, fix bounded ones, and stop.

Do not use this as permission for a redesign or new roadmap.

---

## 2. Product truth to verify

A reasonable visitor/operator should come away with this model:

> Enquiry receives messy service-business enquiries, reconstructs what the customer wants, applies how that business works, determines what can safely be decided now, identifies what is blocking progress, prepares the next action, and keeps the enquiry current until booked or lost.

They should **not** leave thinking the product is primarily:

- an AI email writer;
- a quote generator;
- a unified inbox;
- a generic CRM;
- an AI receptionist;
- a field-service platform;
- a wedding/beauty tool.

---

## 3. Public site gate

Review:

- `/`
- `/how`
- `/roadmap`
- `/updates`
- `/early-access`
- footer/global metadata

### Must be true

- `Stop managing enquiries.` remains strong and supported by the rest of the page.
- Differentiated decision behaviour is visible early, not buried below generic feature copy.
- Signature cross-channel demo proves continuity without claiming magical identity resolution.
- Examples demonstrate cross-industry fit.
- Pricing/capacity are described as conditional, not universal.
- Unknown/refusal-to-guess is represented as a trust feature.
- Review-first / permission-based action model is consistent with future Earned Autopilot.
- Public roadmap contains only meaningful customer-facing eras.
- Updates are curated meaningful progress, not engineering release notes.
- Early Access is transparent but polished.
- No fake scarcity or unvalidated pricing promise.

### Search for stale language

Search repository/public copy for old framing including phrases/concepts like:

- `phone-first`
- `AI enquiry copilot` where it materially understates positioning
- `message, number, letter, send`
- `the shape of the enquiry is the product`
- universal `quote` language in generic product promises
- old eight-stage public roadmap text
- `not pad a list`
- `learning can absorb`

Do not blindly delete legitimate developer/internal references. Fix only stale public/product-facing usage.

---

## 4. App UX gate

Review representative fixtures across different business phenotypes.

At minimum inspect:

1. straightforward exact-price enquiry;
2. missing-fact / minimum-blocker enquiry;
3. non-price-applicable enquiry;
4. changed-fact / decision-updated enquiry;
5. cross-channel continuity scenario;
6. unknown/integration failure scenario;
7. high-risk / Autopilot-blocked scenario;
8. professional/creative service where capacity/price may differ from local appointment businesses.

### Must be true

- irrelevant evaluators are hidden;
- pricing `NOT_APPLICABLE` creates no fake `Price not ready` state;
- applicable unresolved pricing remains clear;
- exact vs estimate remains correct;
- changed facts visibly change decision state when they matter;
- minimum blocker is visible where applicable;
- `Why?` provides evidence/provenance;
- recommendation does not imply execution permission;
- sent quote/document versions remain stable;
- customer-specific facts do not silently become Business Brain rules;
- cross-channel identity behaviour matches the current trust model.

---

## 5. Roadmap + Updates gate

### Roadmap

Check that each visible item passes this test:

> Would a prospective customer care that this became true?

If not, it probably belongs in internal docs rather than `/roadmap`.

Verify:

- statuses match reality;
- no stale exact dates/promises;
- no feature-vote democracy language;
- feedback CTA works;
- endgame boundary remains first enquiry → booked/lost.

### Updates

Each visible update should be a meaningful product/build story.

Remove/rewrite only if clearly inconsistent after earlier phases.

Do not add filler just to make the page look active.

---

## 6. Waitlist / research gate

Verify end-to-end:

- email first;
- duplicate signup safe;
- optional qualification works;
- attribution is retained;
- roadmap interest works;
- qualitative roadmap feedback persists if Phase 6 was chosen/completed;
- no visitor can see another visitor’s data;
- completion states have clear next actions;
- mobile form ergonomics are good.

Do not build an internal waitlist dashboard in this phase.

---

## 7. Technical QA matrix

Run the repository’s actual supported checks. Do not claim a generic `npm test` pass if the repo has known platform-specific failures.

### Required

- typecheck;
- focused unit/domain tests touched by Phases 2–7;
- production build;
- existing launch/app-data/gate/identity tests as relevant;
- inspect any known pre-existing test failures and distinguish them from regressions.

### Visual QA

Desktop and phone for:

- homepage;
- signature demo;
- How it works;
- roadmap;
- Early Access form + qualification;
- Today queue;
- enquiry detail;
- non-price fixture;
- any possible-match UI if Phase 7B shipped.

### Accessibility / interaction

- keyboard navigation on public CTAs/forms;
- visible focus;
- dialog/sheet close behaviour;
- reduced-motion mode;
- no horizontal overflow;
- sensible semantic headings;
- major status changes use appropriate accessible announcements where already designed.

---

## 8. Performance sanity

Do not launch a performance optimisation project.

Check only obvious regressions:

- oversized new media used by signature demo;
- autoplay/video behaviour that harms mobile;
- unnecessary repeated timers/listeners;
- roadmap motion causing jank;
- obvious console errors;
- server actions repeatedly firing due to render/effect mistakes.

Fix bounded regressions discovered.

---

## 9. Truth / claim audit

For each major public promise, classify internally as:

- **works in prototype now**;
- **being built/tested**;
- **future direction**.

No public sentence should blur those enough to materially mislead.

Particularly audit:

- real channel integrations;
- cross-channel linking;
- automatic actions;
- calendar/availability;
- quoting;
- follow-up;
- booking handoff;
- Business Brain learning.

Do not weaken the site into legalistic caveats. Correct the few claims that are genuinely ahead of reality.

---

## 10. No-niche dominance audit

Look at the page as a whole, not just individual sections.

Beauty may remain as one proof fixture, but it must not dominate:

- hero;
- first demo;
- industry examples;
- roadmap;
- Updates;
- app fixture tour.

Use existing painting, cleaning, photography, creative/professional fixtures to maintain breadth.

Do not add random industries solely for visual diversity.

---

## 11. Fix policy

During Phase 8, fix issues only if they are:

- clear contradictions;
- regressions;
- stale copy from prior phases;
- accessibility defects;
- broken interactions;
- small consistency issues.

If a finding requires a meaningful new product feature, do **not** implement it.

Add it to the handoff as a proposed next-phase item.

---

## 12. Final release report

Produce a structured handoff containing:

### Passed
List the major product/UX guarantees verified.

### Fixed during QA
Files/issues changed.

### Known pre-existing platform/test issues
Clearly distinguish from product regressions.

### Deferred
Only real unresolved work, ranked:

- blocker before beta;
- should fix during first cohort;
- later hypothesis.

### Current truth statement
One short paragraph stating what this build can honestly claim today.

---

## 13. Acceptance criteria

- [ ] Public site and app describe the same product.
- [ ] Signature decision behaviour is visible quickly.
- [ ] No one niche dominates product identity.
- [ ] No universal pricing/capacity assumptions remain.
- [ ] Cross-channel claims match implemented trust behaviour.
- [ ] Roadmap is curated customer-facing sales/trust content.
- [ ] Early Access remains simple and trustworthy.
- [ ] Instrumentation/research flows chosen for this release function.
- [ ] Typecheck passes.
- [ ] Production build passes.
- [ ] Focused product tests pass.
- [ ] Known platform failures are documented rather than hidden.
- [ ] Desktop/mobile/reduced-motion/keyboard QA completed.
- [ ] No new major scope was introduced during QA.

Then stop. Product management decides what becomes the first beta build.