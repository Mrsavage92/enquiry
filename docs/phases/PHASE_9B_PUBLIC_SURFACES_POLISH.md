# Phase 9B — Remaining Public Surfaces + Shared Brand System

**Status:** PREPARED — NOT ACTIVE

Execution authority remains `docs/CURRENT_PHASE.md`.

9B extends the already-approved 9A visual language.

It does **not** independently invent a new style.

Reference:

- `docs/phases/PHASE_9_VISUAL_BRAND_POLISH.md`
- Phase 9A implementation `19843ee61fb7d2508bc0b810e8ead5cd58735ddc`
- `docs/PUBLIC_CLAIM_TRUTH_MATRIX.md`

---

# Objective

Make the remaining public Enquiry surfaces feel like one premium editorial product system:

- calm;
- deliberate;
- human-designed;
- paper/ink;
- restrained green;
- decision proof first;
- no generic AI-SaaS visual language.

9B is polish/consistency, not product work.

---

# Approved 9A language to reuse

Prefer the existing approved primitives rather than creating new variants:

- `site-display`;
- `site-display-proof`;
- `site-lede`;
- `site-caption`;
- `site-well`;
- `site-plate`;
- `site-chapter`;
- editorial rules;
- restrained radii;
- document-like proof framing;
- paper/raised surfaces;
- serif hierarchy.

Do not make every page a copy of the homepage.

Each route can have its own editorial rhythm while using the same underlying grammar.

---

# 1. Shared navigation

Audit:

- desktop nav spacing/hierarchy;
- mobile nav;
- active/current route treatment;
- `See demo`;
- `Join early access`;
- existing-user `Sign in/Open Enquiry`.

Public/operator separation must remain obvious.

Preferred hierarchy:

1. product understanding;
2. public proof;
3. early access;
4. existing-user app entry.

Do not let "Open app" be the main prospect CTA if it leads to authentication.

No install CTA in public nav before Phase 10A.

---

# 2. Footer

Footer should feel intentional rather than utility debris.

Keep:
- product routes;
- privacy/terms;
- restrained company/product identity.

Avoid:
- enormous link sitemap;
- fake social proof;
- speculative integrations;
- "AI platform" category stuffing.

Ensure phone layout remains clean.

---

# 3. `/how`

## Role
Explain the mechanism after a visitor has understood the problem.

Visual order should emphasise:

> enquiry arrives  
> → Enquiry reconstructs  
> → Business Brain  
> → relevant checks only  
> → Unknown/missing blocker  
> → review  
> → state stays current

Use editorial chapters/document framing rather than six generic feature cards.

### Preserve
- only checks that matter;
- Unknown is valid;
- review then send;
- continuity through booked/lost.

### Public-truth correction
Channel wording must respect `PUBLIC_CLAIM_TRUTH_MATRIX.md`.

Do not visually/presentationally imply all listed channel integrations are production-live.

---

# 4. `/roadmap`

## Role
Trust/sales narrative, not project-management board.

Keep the six customer-facing eras.

Visually:
- stronger editorial timeline/chapters;
- clear distinction between working now vs future direction;
- problem statements more prominent than feature jargon;
- `I need this` interaction remains secondary and calm.

### Copy consistency
Where practical, use:
> decision layer

rather than less-specific:
> intelligence layer

if meaning is unchanged.

Do not add implementation phase numbers.

Do not expose internal R1/R2 terminology publicly.

---

# 5. `/early-access`

## Role
Highest-conversion trust surface.

Needs:

- clear heading;
- calm explanation of gradual access;
- email-first form prominent;
- optional research/qualification remains optional;
- review-first trust;
- no fake scarcity.

Use `site-well`/raised form treatment consistently with homepage.

### Do not add
- phone field;
- meeting booking;
- ten mandatory research questions;
- public queue number;
- countdown;
- "founding member lifetime deal".

Public wording around "first service businesses" may remain future-facing.

---

# 6. `/updates`

## Role
Proof that the product is being thought through, not a changelog.

Visual treatment should support readable editorial notes:

- date/eyebrow;
- clear title;
- readable line length;
- subtle separators;
- enough whitespace;
- no giant card grid.

Current useful themes:
- continuity;
- Unknown;
- CRM boundary;
- learning/provenance;
- what "building in public" means.

Avoid engineering-detail updates that prospects do not care about.

---

# 7. `/demo`

Although 9A focused Ridge on homepage, 9B should ensure `/demo` feels like the canonical public proof route after auth hardening.

Requirements:

- clearly demo/sample context;
- no need to sign in;
- no customer-evidence implication;
- same premium proof language as homepage;
- easy path back to early access;
- no live tenant mutation;
- no short public customer-link dependency.

Do not turn demo into a full fake operator sandbox if the proof becomes less clear.

---

# 8. Shared waitlist components

Where waitlist appears across:

- homepage;
- how;
- roadmap;
- early access;
- updates;

ensure:
- same trust language;
- same success behaviour;
- visual consistency;
- no layout shift;
- phone keyboard usability;
- field/error/focus states.

Do not make every placement equally visually heavy.

Primary form can be strongest on homepage/early-access.

---

# 9. Media / video framing

9A moved videos into dark/product plates rather than full-bleed dark sections.

9B should reuse that approach only where video actually demonstrates product behaviour.

Do not add new autoplay video merely for visual polish.

All media:
- accurate alt/accessible label;
- no claim that fixture send/booking is a production integration;
- reduced-motion alternative where movement matters;
- no oversized mobile payload.

---

# 10. Copy hierarchy

9B may make minor copy changes only where:

- public-traffic truth requires it;
- duplicated wording creates visual problems;
- approved meaning remains intact.

Explicit truth corrections from `PUBLIC_CLAIM_TRUTH_MATRIX.md` may be included when 9B runs, but urgent public-traffic fixes do not need to wait for 9B if management authorises them separately.

Do not reopen:
- hero thesis;
- category;
- product boundary;
- roadmap strategy.

---

# 11. Responsive QA

At minimum:

### 390px-ish phone
- nav;
- headings;
- waitlist;
- chapter flow;
- roadmap controls;
- updates;
- demo proof.

### larger phone
Check spacing doesn't become awkward.

### tablet
No oversized empty voids/card stretching.

### desktop
Editorial hierarchy remains strong at wide widths.

---

# 12. Accessibility

Verify:

- one H1 per page;
- semantic section/heading order;
- visible focus;
- scene/tab controls keyboard accessible;
- `aria-pressed`/selected state meaningful;
- waitlist labels/errors announced;
- contrast;
- reduced motion;
- touch target size.

Do not trade accessibility for premium minimalism.

---

# 13. Performance

No broad performance project.

Check:
- page media sizes;
- duplicate video loading;
- unnecessary animation libraries;
- CLS around forms/media;
- public app bundle impact.

Premium must remain fast.

---

# Acceptance

- [ ] `/how`, `/roadmap`, `/early-access`, `/updates` use the approved 9A design grammar.
- [ ] Shared nav/footer feel intentional.
- [ ] `/demo` is the clear public no-login proof route.
- [ ] Public/operator CTA hierarchy is clear.
- [ ] Waitlist remains low-friction.
- [ ] No generic AI/SaaS visual clichés introduced.
- [ ] No unsupported integration/customer-evidence claim introduced.
- [ ] Phone/tablet/desktop layouts pass.
- [ ] Reduced motion/focus/contrast pass.
- [ ] Performance remains reasonable.
- [ ] Typecheck/build/relevant tests pass.
- [ ] No R2 product logic or Phase 10 install work pulled in.

---

# Handoff

Report:

1. shared-system changes;
2. each route changed;
3. nav/footer changes;
4. demo/public operator separation;
5. copy truth corrections;
6. media/performance changes;
7. desktop/tablet/phone/reduced-motion QA;
8. accessibility;
9. tests/build;
10. deliberately deferred items.

Then stop before Phase 10.
