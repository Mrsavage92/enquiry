# Phase 7 — Safe Cross-Channel Identity Continuity

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 7A or 7B.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

This phase is intentionally split because identity work can expand into a CRM/identity-graph project very easily.

---

# Product rule

Enquiry may maintain one enquiry across channels, but it must never silently merge two people/conversations merely because AI thinks they look similar.

The identity model exists only to maintain **enquiry continuity**.

It is not a general customer CRM.

---

# Evidence hierarchy

## Strong / deterministic evidence
Examples:

- exact verified email match;
- exact normalized phone match;
- a social/account identity the business has already linked;
- explicit customer cross-reference such as supplying the same booking/enquiry reference;
- an existing deterministic integration identifier.

Strong evidence may support automatic association if the product policy explicitly permits it.

For the prototype, be conservative.

## Suggestive evidence
Examples:

- same or similar name;
- same requested service;
- same event/job date;
- same location;
- strongly similar message content;
- same company name.

Suggestive evidence must **not** silently merge conversations.

It may create a reviewable proposal.

---

# Phase 7A — Model + deterministic fixture only

## Objective

Prepare the domain model for multiple channel/contact identities and prove deterministic continuity without changing the app into a contact database.

## Current model issue

`Enquiry` currently has singular convenience fields:

- `customerEmail`
- `customerPhone`
- `customerHandle`

while messages also carry channel-specific addresses.

That is sufficient for the prototype today but becomes brittle once one enquiry legitimately spans several contact points.

## Required model direction

Add a small identity/contact-point type, conceptually:

```ts
export type IdentityKind = "email" | "phone" | "instagram" | "facebook";

export type CustomerIdentity = {
  id: string;
  kind: IdentityKind;
  value: string;
  normalizedValue?: string;
  verified: boolean;
  provenance: Provenance;
};
```

Exact naming may differ if the existing domain style suggests a better name.

Add a collection to `Enquiry`, e.g. `identities: CustomerIdentity[]`.

### Backward compatibility

Do not force a repository-wide rewrite in one turn.

The existing convenience fields can remain temporarily if they are widely used.

If retained, define a clear compatibility rule:

- identities are the future-safe source for multi-channel continuity;
- convenience fields remain display/fixture compatibility until a later cleanup;
- no conflicting truth should be introduced.

Do not create a global `Customer` entity unless the current repo already genuinely needs it. It should not for this phase.

## Normalisation

Implement only deterministic normalisation needed for fixture-safe matching.

Examples:

- lower-case/trim email;
- normalized phone digits/country-format using the simplest existing Australian prototype assumption that is already used in fixtures.

Do not build international phone identity infrastructure.

Do not fuzzy-match social handles.

## Deterministic match helper

Introduce a small domain helper that can answer whether an incoming known contact point is a deterministic match for an existing enquiry.

Preferred result shape is explicit, not boolean-only, e.g.:

```ts
{
  matched: true,
  strength: "deterministic",
  reason: "Same mobile number supplied on the website form",
  identityId: "..."
}
```

This allows Phase 2/7B trust UI to explain why something was linked.

## Fixture

Use or adapt the Phase 2 Ridge & Co scenario.

The website form contains Maya Chen's phone number.

The later SMS comes from that exact normalized phone number.

That is the deterministic reason the second message can join the existing enquiry.

Do not create magical fixture metadata that bypasses the identity helper if the helper can model it cleanly.

## Tests

Must cover:

- exact email match;
- normalized exact phone match;
- different phone does not match;
- similar name alone does not count as deterministic;
- social identity only matches when explicitly represented/linked;
- match reason is available for UI.

## Do not do in 7A

- no possible-match UI;
- no fuzzy AI matching;
- no global customer/contact page;
- no merge history UI;
- no production integrations;
- no identity persistence backend project;
- no deletion/deduplication engine.

## Likely files

- `src/domain/types.ts`
- new `src/domain/identity.ts` (preferred if logic is non-trivial)
- fixtures from Phase 2
- focused domain tests
- small format/channel compatibility changes if needed

## 7A acceptance criteria

- [ ] One enquiry can represent multiple contact/channel identities.
- [ ] Deterministic match evidence is represented explicitly.
- [ ] Phase 2 Ridge scenario can truthfully explain the exact-phone link.
- [ ] Similarity alone never produces a deterministic match.
- [ ] Existing fixtures/app remain compatible.
- [ ] No global customer CRM has been introduced.
- [ ] Typecheck/tests pass.

## 7A handoff

Report model shape, compatibility approach, deterministic matching rules, fixture used, files/tests. Then stop. Do not begin 7B.

---

# Phase 7B — Reviewable possible-match UX

**Do not execute until 7A has been reviewed and `CURRENT_PHASE.md` explicitly advances to 7B.**

## Objective

Demonstrate the correct trust behaviour for a **suggestive**, non-deterministic cross-channel match.

The UI must prove:

> Enquiry can notice a likely relationship without pretending that likely means certain.

## Fixture

Create the smallest possible fixture using an existing business.

Example pattern:

Existing enquiry:
- Sarah Jones
- service/date/location known
- email/form channel

New Instagram DM:
- account name resembles Sarah;
- mentions same service/date;
- no deterministic phone/email/platform link.

Enquiry may produce:

> **Possible match**
>
> This Instagram message may belong to Sarah Jones’s existing enquiry.
>
> Same date and service. No verified contact match.

Actions:

- **Link to enquiry**
- **Keep separate**

Do not use confidence percentages unless already meaningful elsewhere.

## Link behaviour

When the user chooses `Link to enquiry`:

- preserve the new message/provenance;
- attach/add the new identity only as appropriate;
- re-evaluate/update the existing enquiry fixture state;
- show a small audit/change indication;
- do not erase the fact that this was manually linked.

When the user chooses `Keep separate`:

- preserve the new conversation as separate;
- dismiss/suppress that specific suggestion for the prototype session;
- do not repeatedly nag the user immediately.

## Trust copy

Use plain language.

Good:

> Same date and service, but no verified contact match.

Bad:

> AI confidence 87.4% based on semantic embedding similarity.

## Where it appears

Prefer a small reviewable state in the existing enquiry/arrival flow rather than creating a new Identity Management section.

Do not add another top-level navigation item.

## Audit/provenance

If the existing audit event model can support it cleanly, record:

- suggested match;
- manually linked;
- kept separate.

Do not build a comprehensive merge undo/history product in this phase.

## Tests

Cover:

- suggestive match does not auto-link;
- link action updates intended enquiry;
- keep-separate does not update intended enquiry;
- deterministic matches do not unnecessarily show the weak-match confirmation UI if the chosen policy says they may link automatically in the prototype;
- no unrelated enquiry is modified.

## Do not do in 7B

- no ML model;
- no vector database;
- no global customer entity;
- no production social lookup;
- no bulk dedupe;
- no fuzzy matching across the full dataset;
- no new CRM screens.

## Likely files

- identity helper from 7A
- fixture/store prototype actions
- arrival/enquiry UI
- audit events if already suitable
- tests

## 7B acceptance criteria

- [ ] Weak/suggestive evidence is visibly reviewable and never silently merged.
- [ ] UI explains the evidence in customer language.
- [ ] User can link or keep separate.
- [ ] Linking updates one existing enquiry and re-runs the appropriate decision state.
- [ ] Keep-separate preserves separation.
- [ ] No CRM/customer-management surface is introduced.
- [ ] Desktop/mobile remain usable.
- [ ] Typecheck/tests pass.

## 7B handoff

Report the evidence rules shown in UI, actions, fixture, files/tests, and any identity ambiguity that cannot be safely handled by the current model. Then stop.