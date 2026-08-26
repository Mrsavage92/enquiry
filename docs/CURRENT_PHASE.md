# Enquiry — Current Implementation Phase

## Current phase

**Phase 1 — Reposition the public site around the decision layer — CORRECTION GATE**

Source: `docs/PRODUCT_CHANGE_PLAN.md`

Phase 1 is substantially complete, but product management has **not signed it off yet**.

## Required corrections only

Make these small copy corrections. Do **not** begin Phase 2 and do not build the cross-channel signature demo yet.

### 1. Do not imply production-safe cross-channel identity linking already exists

In `src/routes/how.tsx`, the current line:

> “However the customer writes in, it becomes the same enquiry — not a new thread to reconstruct later.”

is too strong for the current product state.

The product direction is one enquiry across channels, but arbitrary cross-channel identity linking is not yet production-safe or implemented as a general capability.

Rewrite this step so it truthfully communicates that form, text, Instagram, Facebook and email are supported enquiry **input concepts / channels** and that Enquiry reconstructs the request, without claiming that it can already magically merge arbitrary identities across those channels.

Do not add an identity-resolution engine in this phase.

### 2. Make review-first language future-proof for Earned Autopilot

The homepage currently says:

> “It does not send, book, or refuse until you say so.”

and `/how` says:

> “Enquiry does not send until you say so.”

Those are accurate for the current prototype but accidentally imply Enquiry will always be manual-approval-only.

Rewrite them to preserve the current review-first trust model while leaving room for the already-planned Earned Autopilot model.

Preferred meaning:

> Nothing acts automatically unless that class of action has been explicitly allowed. Early access is review-first.

Use polished customer-facing wording, not internal policy language.

### 3. Broaden the cross-industry examples slightly

The homepage currently demonstrates breadth with only:

- Makeup
- Photography
- Painting
- Cleaning

This still visually clusters Enquiry around local consumer services.

Keep some of those examples, but add or substitute at least one clearly different service-business category such as:

- Consulting
- Creative / agency services
- Professional services

Do not hard-code the product around any one of these categories.

### 4. Keep everything else stable

Do not redesign the page, change the hero, change the proof case, touch the roadmap, or start Phase 2.

## Acceptance for this correction gate

- [ ] No public copy claims arbitrary cross-channel identity merging already works.
- [ ] Current review-first behaviour is clear without contradicting future Earned Autopilot.
- [ ] Cross-industry examples no longer read purely as local consumer-service niches.
- [ ] Typecheck passes.
- [ ] Desktop/mobile visual QA confirms no layout regression.

## Required handoff

Report:

- exact copy changed
- files changed
- typecheck result
- visual QA result

Then stop.

Do not begin Phase 2 until this file is updated by product management.
