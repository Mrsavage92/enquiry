# Enquiry — Current Implementation Phase

## Current phase

**Phase 2A — Build the signature cross-channel decision demo**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

## Phase 1 status

**SIGNED OFF.**

Phase 1 repositioned the public site around the Enquiry decision-layer thesis and passed the correction gate:

- public copy no longer frames Enquiry primarily as a phone-first quoting assistant;
- cross-channel copy no longer overclaims arbitrary production-safe identity merging;
- review-first language leaves room for future Earned Autopilot;
- cross-industry examples now include a clearly different service-business category.

Do not revisit Phase 1 unless a regression is introduced.

---

## Execute Phase 2A only

Read the full detailed brief:

`docs/phases/PHASE_2_SIGNATURE_CROSS_CHANNEL_DEMO.md`

Phase 2A is the **demo itself only**.

Do not begin Phase 2B placement / homepage restructuring until product management reviews Phase 2A and updates this file.

### Objective

Build the signature demonstration that communicates:

> **The conversation can move. The enquiry stays coherent.**

Use the Ridge & Co Painting scenario specified in the Phase 2 brief.

The customer begins via a website form, then later sends a text from the same known mobile number with a material scope/deadline change.

The demo must visibly show:

1. initial enquiry received;
2. Enquiry reconstructs the request;
3. initial business decision/checks;
4. later text linked to the same enquiry for an explicit, trustworthy reason;
5. fact changes / diff;
6. relevant business checks re-run;
7. meaningful decision consequence;
8. next action changes.

The punchline is **not price**. The punchline is that Enquiry maintains and re-evaluates the business decision as the customer changes the request across channels.

### Trust rule

Do not imply general AI identity matching exists.

For this fixture, the later text is linked because the phone number is already known from the original form. Make that provenance visible enough that the demo feels trustworthy rather than magical.

### Scope rule

Build the reusable/demo component and fixture/state needed to prove the interaction.

Do **not**:

- replace the homepage Priya demo yet;
- restructure `/how` around the new demo yet;
- build production Instagram/SMS integrations;
- build a generic identity-resolution engine;
- alter the public roadmap;
- start Phase 3;
- broaden into adjacent product work.

Those are later gates.

## Acceptance criteria

- [ ] Demo begins on website form and continues via text.
- [ ] Both messages visibly belong to one enquiry for a defensible reason.
- [ ] The original request and updated request are understandable without reading internal architecture language.
- [ ] Material facts visibly change.
- [ ] Relevant evaluator/decision state changes as a consequence.
- [ ] The next action changes.
- [ ] The demo does not rely on price as its primary proof.
- [ ] The experience makes sense to a service-business owner in under ~15 seconds.
- [ ] Existing app behaviour remains stable.
- [ ] Reduced-motion behaviour remains usable.
- [ ] Desktop and mobile visual QA pass.
- [ ] Typecheck passes.
- [ ] Relevant tests pass, with any pre-existing platform failures clearly separated from new failures.

## Required handoff

When Phase 2A is complete, report:

- the exact scenario implemented;
- interaction sequence;
- files changed;
- fixture/state changes;
- tests/typecheck results;
- desktop/mobile visual QA;
- any unresolved product or implementation risk.

Then stop.

**Do not begin Phase 2B until this file is updated by product management.**
