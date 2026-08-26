# Phase 4 — Public Roadmap as a Sales / Trust Page

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 4.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

Dependency: ideally complete Phase 2B and Phase 3 first so the roadmap sells the product behaviour the site/app now visibly demonstrate.

---

## 1. Objective

Turn `/roadmap` from a detailed public product plan into a **high-trust sales narrative**.

The page should help a prospective customer answer:

1. What can Enquiry genuinely do now?
2. What major capability is being built next?
3. What meaningful leaps are coming later?
4. What is the long-term endgame?
5. Can I trust this company to be honest about what is and is not ready?

This is not an engineering backlog and not a changelog.

---

## 2. Keep the current design philosophy

Preserve the things already working well:

- editorial feel;
- generous whitespace;
- strong typography;
- vertical journey / progress rail;
- subtle motion;
- clear status language;
- visually stronger endgame section;
- current Enquiry colour / type / paper system;
- `I need this` intent capture where useful.

Do not copy Derive’s exact layout, animations or wording.

The page should feel like Enquiry’s own product story.

---

## 3. Public information architecture

Reduce the current eight-stage public structure to approximately **six major customer-facing eras**.

Recommended canonical structure:

### 00 — NOW
# Understand the enquiry

Customer promise:

> Messy inbound becomes an understood request with the right next action.

What may be shown:

- known / missing / ambiguous;
- only relevant checks;
- next action;
- Why?;
- review-first;
- cross-industry proof.

Honesty block can state that the product is still being validated across different businesses.

Do not list internal evaluator taxonomy.

### 01 — BUILDING
# Understand your business

Customer promise:

> Enquiry learns the services, rules and operating preferences it needs to make the right decision for your business.

Public concepts:

- Business Brain;
- services / rules / prices where relevant / policies / preferences;
- corrections can be one-off or teach Enquiry;
- consequential knowledge must be trusted/confirmed.

Do not expose knowledge-class/state implementation detail.

### 02 — NEXT
# One enquiry, even when the conversation moves

Customer promise:

> A form becomes a text or DM. The request changes. Enquiry keeps the enquiry and the next decision current.

Use the signature cross-channel proof if Phase 2 is complete.

Be explicit that supported/production connections will roll out progressively; do not imply every social integration is live.

### 03 — NEXT
# Keep enquiries moving

Customer promise:

> The useful parts of the pipeline maintain themselves, and follow-up comes back only when something genuinely needs attention.

Public concepts:

- waiting on customer / needs you / ready to progress;
- automatic enquiry state;
- follow-up;
- no manual CRM hygiene.

### 04 — LATER
# Trusted action

Customer promise:

> Enquiry handles selected routine actions only after the business has explicitly allowed them.

Show progressive trust:

Observe → Assist → Selected authorised actions.

Keep the key trust idea:

> There is no giant AI-on switch.

Examples may include acknowledgement, one known missing question, approved follow-up.

Avoid promising autonomous complex quoting/declines as near-term fact.

### 05 — ENDGAME
# The self-maintaining enquiry layer

Customer promise:

> From first interest to booked or lost, the business does almost nothing administrative.

Endgame flow:

Customer enquiry
→ Enquiry understands
→ business-specific decision
→ communication / authorised action
→ booked or lost
→ downstream fulfilment system

Owner stays for:

- judgement;
- exceptions;
- relationships;
- unusual commercial calls.

Boundary must remain explicit:

> first enquiry → booked or lost

---

## 4. What to remove from the public roadmap

Do not expose standalone public stages for:

- evaluator architecture;
- commercial leak/reporting unless later proven important enough to become a major buyer outcome;
- internal state model;
- API/database plumbing;
- quote drift;
- identity model;
- individual integrations;
- bug fixes;
- technical refactors.

These can exist internally without becoming public roadmap milestones.

The current `Connect` and `Leak` stages should not survive as equivalent top-level eras unless implementation/research creates a compelling customer-facing reason.

Integrations should be expressed inside the relevant customer outcome, especially continuity and trusted action.

Commercial intelligence can remain an internal/later hypothesis, not something the roadmap must advertise now.

---

## 5. Status language

Simplify the visitor-facing taxonomy.

Preferred visible labels:

- **Working now**
- **Building**
- **Next**
- **Later**

Use **Exploring** sparingly for a named capability that genuinely has not earned commitment.

`Shipped` should be used for meaningful historic/customer milestones, not every release.

Avoid showing two statuses on every stage unless there is a strong reason. The visitor should not need to decode roadmap mechanics.

---

## 6. Honesty / trust copy

Keep a strong opening idea similar to:

> Some of this works today. Some of it is being built. Some of it still needs to earn its place.

Add / retain a concise public-roadmap disclaimer near the end:

> **Roadmaps change.**
>
> This is our direction, not a contract with the future. Customer evidence can change the order, the implementation, or whether something gets built at all. If that happens, we’ll update this page rather than quietly leave an old promise here.

Do not use apologetic language.

Trust comes from clarity, not insecurity.

---

## 7. Customer-facing visual content

Every era should have a visual that demonstrates the **outcome**, not architecture.

Examples:

NOW: messy enquiry → understood → next action.

BUSINESS: short set of business truths / correction choice.

CONTINUITY: website form → text/DM → changed fact → updated decision.

MOVING: waiting → customer replied → needs you → ready.

TRUST: Observe → Assist → authorised action.

ENDGAME: the full first-interest-to-booked/lost flow.

Do not create a visual for every subfeature.

---

## 8. `I need this` rules

Keep feedback on future meaningful eras/capabilities where it produces useful intent.

Do not put `I need this` on:

- the current core product;
- Endgame as a vague vision;
- internal capabilities.

Good candidates:

- cross-channel continuity;
- self-maintaining follow-up/state;
- trusted authorised action.

The vote remains a research signal, never a delivery promise.

Phase 6 will improve persistence/attribution. Do not expand that work here unless required to preserve current behaviour.

---

## 9. Homepage preview

Update `ROADMAP_PREVIEW` / homepage roadmap section so it reflects the new curated public stages.

The preview should ideally show only 3 significant states, such as:

- Working now — Understand the enquiry
- Building — Understand your business
- Next — One enquiry, even when the conversation moves

Do not reproduce the entire roadmap on the homepage.

---

## 10. Shipped / updates policy

If a shipped-history component exists or is added, keep it sparse.

A public shipped item must represent a meaningful buyer-visible leap, such as:

- first cross-industry decision prototype;
- Business Brain setup usable;
- conversation continuity released;
- first controlled action class enabled.

Do not turn shipped into release notes.

`/updates` remains separate and is handled in Phase 5.

---

## 11. Data/code direction

Refactor `src/lib/launch/roadmap.ts` to represent the simpler public narrative rather than keeping obsolete stages and merely hiding them with CSS.

It is okay to simplify types if the current multi-status/outcomes structure creates unnecessary public complexity, but avoid needless architectural churn.

Preserve stable roadmap IDs used by stored feedback **where sensible**. If IDs must change, think through existing `roadmap_interest` data and guards so old data does not break public interactions.

Prefer semantic IDs:

- `understand`
- `business-brain`
- `continuity`
- `keep-moving`
- `trusted-action`
- `endgame`

But migration/backward compatibility matters more than naming aesthetics.

---

## 12. Do not do

- no engineering backlog UI;
- no quarterly delivery dates;
- no fake completion percentages;
- no logo wall of unbuilt integrations;
- no feature-vote leaderboard;
- no promises of exact launch dates;
- no pricing page work;
- no waitlist redesign;
- no Phase 6 analytics schema work unless essential for compatibility.

---

## 13. Likely files

Inspect first, likely:

- `src/lib/launch/roadmap.ts`
- `src/routes/roadmap.tsx`
- `src/components/site/roadmap-board.tsx`
- `src/components/site/roadmap-visuals.tsx`
- `src/routes/index.tsx` roadmap preview only
- guard tests if allowed roadmap feature IDs change

---

## 14. Acceptance criteria

- [ ] Public roadmap contains approximately six major customer-facing eras, not eight internal-ish stages.
- [ ] Every top-level era is meaningful to a prospective customer.
- [ ] The signature product uniqueness is visible in the roadmap narrative.
- [ ] Current capability vs future direction is unmistakable.
- [ ] The roadmap contains no engineering backlog/detail dump.
- [ ] Cross-channel continuity is framed as one coherent enquiry, not unified inbox software.
- [ ] Earned autonomy remains progressive and permission-based.
- [ ] Endgame and first-enquiry→booked/lost boundary are visually prominent.
- [ ] `I need this` continues to work for appropriate future items.
- [ ] Homepage roadmap preview matches the new narrative.
- [ ] Mobile and desktop remain visually strong.
- [ ] Reduced motion works.
- [ ] Typecheck/tests pass.

---

## 15. Handoff

Report:

- old public stages → new public eras mapping;
- what was deliberately removed from public view;
- exact files changed;
- roadmap feedback IDs changed/preserved;
- tests/typecheck;
- desktop/mobile/reduced-motion QA;
- any public claim that still feels ahead of current product reality.

Then stop. Do not begin Phase 5.