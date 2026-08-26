# Phase 9 — Premium Visual Polish + Non-AI Art Direction

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 9.**

This is a productisation/polish phase, not permission to redesign Enquiry from scratch.

---

## 1. Objective

Make the public Enquiry experience feel visually exceptional, premium, calm and trustworthy while avoiding the generic visual language associated with AI-generated SaaS sites.

The target impression is:

> **This feels considered, expensive and real — not like another AI landing page.**

A useful test:

> If the words `AI` and `automation` disappeared from the page, the design should still feel complete and credible.

This phase is about visual quality and brand coherence. It must not change the product thesis established in Phases 1–8.

---

## 2. Art-direction principles

Preserve and improve the existing Enquiry visual character:

- paper / ink warmth;
- editorial typography;
- restrained green/mark accent;
- generous whitespace;
- quiet depth rather than glossy effects;
- product behaviour as the main visual evidence;
- calm, deliberate motion;
- strong hierarchy on small screens.

The experience should feel closer to a carefully designed premium productivity product or editorial software brand than a generic AI startup template.

### Human / product-first visual language

Prefer:

- real product UI;
- well-composed interface demonstrations;
- typography;
- grids and rules;
- subtle materiality;
- carefully framed evidence;
- real service-business language;
- restrained micro-interactions.

Do not add decorative imagery merely because a section feels empty.

---

## 3. Explicitly avoid AI/SaaS visual clichés

Do **not** introduce:

- purple/blue gradient washes as a default brand treatment;
- glowing orbs/blobs;
- AI sparkles / magic-wand motifs;
- robot/brain/circuit imagery;
- generic 3D abstract objects;
- chat bubbles as the dominant visual metaphor;
- glassmorphism everywhere;
- excessive rounded floating cards;
- fake dashboards full of vanity metrics;
- generic stock illustrations;
- generated people pretending to be customers;
- particle effects;
- gratuitous neon;
- giant gradient text;
- animated visual noise whose purpose is only to look “AI”.

Do not hide the fact that Enquiry uses AI where that fact is relevant. The rule is about **art direction**, not deceptive product positioning.

---

## 4. Scope

Audit the full public sales/trust journey:

- `/`
- `/how`
- `/roadmap`
- `/early-access`
- `/updates`
- global navigation/footer
- waitlist surfaces
- signature demo framing
- app-preview/phone/video framing

Also review the app shell where public-site changes expose obvious visual inconsistency, but do not turn this into a workspace redesign.

### Homepage is the priority

The homepage must receive the highest level of polish.

It should have:

1. an excellent above-the-fold composition;
2. clear visual progression from hero → proof → explanation → trust → CTA;
3. enough restraint that the signature decision demo remains the hero proof rather than becoming visual clutter;
4. a recognisable Enquiry identity rather than generic SaaS blocks stacked vertically.

---

## 5. Visual-system audit

Before editing, inspect the actual existing design system and identify inconsistencies in:

- font sizing / line-height;
- serif vs sans usage;
- max-widths;
- section spacing;
- card radius;
- border strength;
- shadow usage;
- colour contrast;
- button hierarchy;
- eyebrow labels;
- body-copy density;
- page backgrounds;
- motion timings;
- mobile spacing;
- media framing;
- state/status treatments.

Do not invent a completely new token system if the current one can be tightened.

Prefer consolidation over adding more visual variants.

---

## 6. Typography

Typography should do more of the brand work.

Goals:

- hero type feels distinctive without being gimmicky;
- headings have deliberate hierarchy rather than every section looking equivalent;
- body copy remains highly readable;
- serif use feels editorial and intentional;
- monospace is reserved for small factual/system detail where appropriate;
- line lengths remain comfortable on desktop;
- mobile headings do not create awkward 1-word orphan lines where avoidable.

Do not add trendy display fonts solely to make the site look different.

---

## 7. Layout + section rhythm

Reduce the feeling of a template assembled from independent sections.

Look for opportunities to improve:

- transitions between hero and signature demo;
- visual relationship between proof and explanation;
- section heights;
- whitespace rhythm;
- asymmetry where it improves composition;
- editorial rules/markers;
- use of background shifts;
- alignment of text and interactive proof;
- final CTA confidence.

Every section should earn its visual weight.

Avoid a page where every block is `headline + paragraph + rounded card`.

---

## 8. Signature demo presentation

Do not change the approved Ridge/Maya product truth simply for aesthetics.

Polish may improve:

- framing;
- spacing;
- changed-state emphasis;
- channel labels;
- causal hierarchy;
- desktop composition;
- mobile scanning;
- the prominence of the decision/next action relative to transcript text.

The visual lesson must remain:

> message changed → facts changed → business decision changed → next action changed.

Do not turn it into a flashy animation showpiece.

---

## 9. Motion

Motion should explain state and hierarchy, not decorate AI-ness.

Good uses:

- subtle section reveal;
- decision-state transition;
- small hover/focus feedback;
- incoming-message causality;
- button/state confirmation.

Bad uses:

- continuous floating elements;
- shimmering gradients;
- looping decorative animations;
- aggressive parallax;
- animation that delays comprehension.

Keep `prefers-reduced-motion` first-class.

---

## 10. Responsive quality

Do not treat mobile as a compressed desktop page.

At approximately 390px width:

- hero must feel composed;
- waitlist CTA must remain obvious;
- signature demo must scan in the correct order;
- section spacing must feel intentional rather than huge;
- buttons and controls must remain thumb-friendly;
- no horizontal overflow;
- text must not become visually dense;
- navigation must feel like a real product/site, not a desktop header collapsed awkwardly.

Check at least one small phone and one larger phone viewport.

---

## 11. Brand asset policy

If new visual assets are genuinely needed:

- favour custom Enquiry marks, product captures, simple diagrams or real interface assets;
- keep file sizes reasonable;
- create purpose-specific assets rather than generic decorative filler;
- ensure they still work with the site’s warm editorial palette.

Do not introduce generated lifestyle/customer imagery unless product management explicitly approves it.

Do not create a logo redesign unless the existing brand mark is demonstrably blocking the visual goal and product management approves that separately.

---

## 12. Performance + accessibility constraints

Premium must not mean heavy.

Preserve:

- semantic heading structure;
- visible keyboard focus;
- contrast;
- touch-target sizes;
- reduced motion;
- no horizontal overflow;
- sensible loading behaviour.

Avoid:

- large unnecessary JS animation libraries;
- oversized background video;
- multiple autoplay media elements;
- unoptimised giant images;
- layout shift introduced by decorative media.

---

## 13. Do not do

- do not change the product positioning;
- do not rewrite major copy unless required by layout and approved meaning is preserved;
- do not alter roadmap truth/statuses;
- do not introduce new product features;
- do not add real integrations;
- do not build the installable/PWA work — Phase 10 owns that;
- do not turn the site into a dark futuristic AI theme;
- do not make every surface look identical for “consistency”.

---

## 14. Suggested execution slices

Phase 9 may be executed in two bounded slices if product management decides the change set is too large for one Grok turn.

### 9A — visual system + homepage

- audit tokens/components;
- tighten typography/spacing/rhythm;
- polish homepage and signature proof;
- desktop/mobile QA;
- stop for review.

### 9B — remaining public surfaces

Only after 9A review:

- `/how`;
- `/roadmap`;
- `/early-access`;
- `/updates`;
- nav/footer/shared surfaces;
- final visual consistency and accessibility QA.

Do not assume both slices are authorised unless `CURRENT_PHASE.md` says so.

---

## 15. Acceptance criteria

- [ ] Homepage feels materially more premium and distinctive without changing the Enquiry thesis.
- [ ] The design does not depend on common AI-startup visual clichés.
- [ ] Signature demo remains the strongest product proof.
- [ ] Public pages feel part of one intentional brand system without becoming monotonous.
- [ ] Typography, spacing, borders, shadows and motion are visibly more coherent.
- [ ] Mobile experience feels intentionally designed, not merely responsive.
- [ ] Existing waitlist and public CTAs remain clear.
- [ ] No misleading AI/integration claims are added.
- [ ] Reduced-motion behaviour remains good.
- [ ] Keyboard/focus/contrast remain accessible.
- [ ] No obvious performance regression is introduced.
- [ ] Typecheck and relevant tests pass.
- [ ] Desktop + mobile visual QA completed.

---

## 16. Required handoff

Report:

1. visual principles applied;
2. exact pages/components changed;
3. design-system/token changes;
4. what was deliberately removed/simplified;
5. performance/accessibility checks;
6. desktop/mobile QA;
7. any visual inconsistency intentionally deferred.

Then stop. Do not begin Phase 10 until product management reviews Phase 9.
