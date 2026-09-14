# UI1 - Quiet Signal working direction

Date: 2026-09-10 (Australia/Brisbane)
Status: **RESEARCH DRAFT ONLY - NOT IMPLEMENTATION AUTHORITY**
Branch: `design/ui1-quiet-signal`

This document starts the UI1 core-experience redesign. It does not authorise production UI changes, replace `CURRENT_PHASE.md`, or weaken the existing commercial-correctness, trust, tenant-isolation or truthful-action guarantees.

The purpose of this branch is to decide what Enquiry should feel like before Codex implements it.

---

## 1. Problem to solve

Enquiry has sophisticated product logic but currently exposes too much of that logic directly in the interface.

The product is meant to remove enquiry-management work. The current interface can instead make the owner feel that they have been given another operations system to manage.

The redesign must therefore solve two different problems at once:

1. **Information architecture:** only surface what the owner needs to understand or do now.
2. **Visual identity:** make the product feel calm, polished, recognisable and deliberate rather than like a generic SaaS dashboard, admin panel or digital notebook.

The redesign must not achieve simplicity by hiding material uncertainty, unsupported decisions, commercial conflicts or unsafe actions.

---

## 2. Working design philosophy: Quiet Signal

**Quiet Signal** is the current internal name for the design direction, not the public product name.

The idea:

> Enquiry absorbs the noise and surfaces the one signal that matters.

A customer may send a messy request across several channels. Internally Enquiry may interpret facts, select evaluators, check pricing, availability, policies, confidence, action authority and history.

The owner should normally see the result of that work:

> Sarah needs a reply. It is ready.

or:

> One thing is missing. Ask for the suburb.

The interface should make the system feel simpler as the engine becomes more capable.

### The Quiet Signal test

A UI decision fails if:

- several elements compete for primary attention;
- the owner is shown internal system terminology when a human outcome would do;
- a supporting detail is permanently visible only because the engine happens to know it;
- a screen looks like a dashboard before it looks like a task;
- decoration is being used to imply intelligence;
- the interface needs explanation before a normal service-business owner knows what to do next.

A UI decision passes when the important thing is obvious and supporting evidence remains easy to reach.

---

## 3. External reference research

The references below are principles to borrow, not skins to copy.

### Wispr Flow - restraint and separation of complexity

Current Wispr documentation separates the lightweight interaction surface from the management surface: desktop uses the Flow Bar plus the Hub, iOS uses the Flow Keyboard plus app tabs, and Android uses the Flow Bubble plus app tabs.

Useful principle for Enquiry:

> The controls and intelligence supporting the core job do not have to occupy the core interaction surface.

Wispr's public mission also explicitly talks about reducing screen time, context switching and cognitive overload.

Sources:
- https://docs.wisprflow.ai/articles/5096240724-navigating-the-wispr-flow-app-desktop-ios-and-android
- https://wisprflow.ai/media-kit

### Linear - attention must be earned

Linear's March 2026 visual refresh is directly relevant to Enquiry's current problem. Linear describes software gradually becoming crowded as individually sensible features add controls and states over time.

Two principles from that refresh are particularly useful:

- **Don't compete for attention you haven't earned.** Supporting navigation recedes so the work is visually dominant.
- **Structure should be felt, not seen.** Fewer and softer separators provide orientation without covering the page in boundaries.

Linear also reduced unnecessary icon treatment, made tabs more compact, dimmed navigation and moved its default palette toward a warmer, less saturated grey.

Source:
- https://linear.app/now/behind-the-latest-design-refresh

### Superhuman - obvious, fast, readable mobile interactions

Superhuman's September 2026 mobile redesign was built around four principles:

- important destinations one tap away;
- one minimal, consistent writing experience;
- intuitive interactions rather than hidden expert-only gestures;
- larger fonts, higher contrast, warmer colours and better readability.

Useful principle for Enquiry:

> Mobile should not be a compressed desktop dashboard. It should be a deliberate, obvious workflow designed around the next action.

Source:
- https://blog.superhuman.com/we-redesigned-superhuman-mail-for-ios-and-android/

### Granola - native-feeling working surface

Granola continues to refine spacing, contrast, focus behaviour and editor polish rather than surrounding the core note with heavy UI. In January 2026 it moved its Mac app from Inter to SF Pro specifically for a more native macOS feel.

Useful principle for Enquiry:

> The working surface can have very little brand decoration and still feel premium. Product character can come from typography, proportion, behaviour and motion rather than visual noise.

Source:
- https://www.granola.ai/updates/whats-new-2026-01-08

---

## 4. What not to copy

UI1 must not become a Wispr clone, Linear clone or generic minimalist dashboard.

Do not copy:

- Wispr's waveform as Enquiry's identity;
- Linear's developer-tool density or dark-first aesthetic;
- Superhuman's power-user command language;
- Granola's note-document metaphor;
- Apple's Liquid Glass as a decorative gimmick;
- purple/blue AI gradients, glowing orbs, sparkles, robot faces or neural-network motifs.

The product must still look appropriate for a makeup artist, hair stylist, tradie, photographer, consultant, clinic, dentist or other service business.

---

## 5. Personality

Enquiry should feel:

- calm;
- capable;
- adult;
- warm without being feminine or industry-specific;
- confident without sounding corporate;
- intelligent without looking like 'AI software';
- simple without feeling stripped or cheap;
- fast without looking aggressive.

It should not feel:

- like accounting software;
- like a CRM;
- like a project-management tool;
- like a paper notebook;
- like a chatbot;
- like a futuristic AI cockpit;
- like a beauty-industry template;
- like enterprise admin software.

---

## 6. Character: no mascot, one recognisable product signature

Recommendation: **no mascot or character**.

A face, robot, blob, animal or animated assistant would narrow the product's audience and make the intelligence feel more gimmicky.

Instead UI1 should develop one abstract product signature provisionally called **Resolve**.

### Resolve concept

The visual idea is several incoming fragments becoming one clear outcome.

Possible static form:

- three short, slightly offset strokes/dots on the left;
- resolving into one clean stroke/pill/point on the right;
- extremely simple at favicon/app-icon size;
- monochrome by default;
- brand colour used only for active/ready states.

Possible motion states:

- **quiet:** resolved mark, completely still;
- **reading:** incoming elements move gently toward alignment;
- **ready:** elements settle into the resolved form once, then stop;
- **needs you:** one restrained pulse, not a permanent animation;
- **blocked/error:** no frantic animation - semantic colour and copy do the work.

The mark should never become an AI waveform, equaliser or loading spinner.

This signature can eventually serve as:

- app icon;
- favicon;
- small brand mark;
- reading/decision state animation;
- empty-state anchor;
- onboarding transition.

It gives Enquiry recognisable behaviour without giving it a mascot.

---

## 7. Candidate visual directions

Three directions should be prototyped on identical content before one is locked.

### A. Quiet Signal - recommended starting point

**Feel:** calm, premium, warm-neutral, cross-industry.

- canvas: very light warm-neutral grey;
- working surfaces: clean white;
- text: soft graphite, never pure-black everywhere;
- secondary text: neutral grey;
- brand/accent: restrained deep forest;
- borders: very light and sparse;
- radius: medium, not bubbly;
- shadows: almost none;
- typography: highly legible neutral sans;
- motion: 150-220ms, subtle and state-led;
- Resolve mark used sparingly.

This keeps a trace of the existing forest identity while removing the paper/notebook metaphor.

### B. Soft Studio - warmer challenger

**Feel:** slightly more tactile, welcoming and lifestyle-friendly.

- warmer off-white canvas;
- white/cream surfaces;
- graphite/brown-black text;
- muted sage accent;
- slightly softer radii and spacing;
- warmer neutral illustration/photography treatment on marketing surfaces;
- app remains sans-serif and clean.

Risk: can drift toward beauty/wellness branding and feel less universal for trades, consulting or clinics.

### C. Native Utility - cleaner challenger

**Feel:** almost invisible, device-native and extremely functional.

- near-neutral system canvas;
- white surfaces;
- dark neutral text;
- very restrained accent;
- system-like controls and typography;
- minimal branding inside the work area;
- subtle platform-specific adaptation on phone/tablet.

Risk: easiest to use, but can lose product personality and become visually interchangeable with other modern apps.

The comparison must use the same information hierarchy. We are testing visual language, not allowing one candidate to cheat with less content.

---

## 8. Working visual rules for candidate A

These values are starting hypotheses for prototyping, not locked design tokens.

### Colour roles

- app canvas: around `#F6F6F3`;
- primary surface: `#FFFFFF`;
- secondary/recessed surface: around `#F0F0EC`;
- primary text: around `#1D1E1C`;
- secondary text: around `#666862`;
- quiet text: around `#858780`;
- border: around `#E7E8E3`;
- brand/action: deep desaturated forest around `#2F5A46`;
- brand hover/pressed: darker forest;
- warning: restrained amber/brown;
- danger: semantic red only;
- success: green only when something is actually complete, not merely 'ready'.

Colour is a semantic tool, not decoration.

### Typography

Do not lock a font before the visual comparison.

Prototype candidates:

- Inter Variable for neutral cross-platform clarity;
- system UI stack for maximum native feel;
- one slightly warmer humanist sans challenger.

Operational app rules:

- one sans family;
- no serif in the operator workspace;
- mono only for genuinely code-like/token data, which normal owners should rarely see;
- routine text generally 14-16px;
- primary decision/action 20-24px;
- screen title 26-32px depending on viewport;
- secondary/meta 12-13px;
- avoid 11px UI text except exceptional tertiary metadata;
- sentence case by default;
- uppercase eyebrow labels removed from routine workflow surfaces.

### Geometry

- cards only for independent objects or one intentionally elevated decision surface;
- whitespace is the default grouping mechanism;
- radii mostly 10-14px;
- avoid pill shapes for ordinary buttons and containers;
- shadows reserved for floating sheets/dialogs and selected elevated surfaces;
- routine boundaries use spacing or one subtle divider, not boxes inside boxes.

### Icons

- one consistent icon family;
- 16-20px in most app contexts;
- no decorative icon on every row;
- no coloured icon tiles unless colour communicates real state;
- text first when an icon would make an action less obvious to a non-technical user.

---

## 9. Density and progressive-disclosure rules

These are more important than palette.

### Global

- one visually dominant action per screen/state;
- maximum two permanent content panes on desktop for the core enquiry workflow;
- supporting evidence opens in a sheet/drawer/secondary route;
- no permanent dashboard of engine internals;
- no duplicated state explanation in multiple cards;
- if a concept is not relevant to the next decision, do not render it.

### Today row

Default row should normally communicate only:

1. customer;
2. request/service and useful date/time context;
3. human-readable next state/action.

Channel, internal confidence, commercial classification and engine details are secondary unless they change what the owner needs to do.

Target: maximum three visual lines per normal row.

### Open enquiry

Default hierarchy:

1. customer/context;
2. next action or one blocker;
3. prepared reply / immediate resolution control;
4. conversation/details/why available on demand.

Do not permanently display Recommendation + Confidence + Autopilot + Missing + Commercial Value + Evaluators + Facts + Case File + Draft as equal stacked sections.

### Business

Default surface should answer:

- what services Enquiry knows;
- whether pricing/rules are usable;
- what needs review;
- what is connected;
- one simple way to teach/correct the business.

Detailed service/rule/policy/voice data remains drill-down content.

---

## 10. Golden-screen skeletons

These three screens define UI1 before the rest of the product is touched.

### Golden screen 1 - Today

Phone concept:

```text
Today                                      [avatar]

3 need you

Sarah Mitchell
Bridal makeup - 19 Sep                     12m
Ready to reply

Jess Carter
Wedding hair - 4 Oct                       31m
Needs the venue

Mia Chen
Family photography                         1h
Waiting for Mia

[ Today ]             [ Booked ]             [ More ]
```

No top-of-screen dashboard cards. No commercial summary by default. Search/filter remains available but visually secondary.

### Golden screen 2 - Open enquiry

```text
< Today

Sarah Mitchell
Bridal makeup - 19 Sep - Noosa

READY TO REPLY

$625 total
4 people + travel

[ Review reply ]

Sarah is asking whether you're available for the morning of 19 September.

Conversation   Details   Why this?
```

If the next decision is blocked:

```text
ONE THING NEEDED

Where in Noosa is the booking?
The suburb changes the travel fee.

[ Ask Sarah ]

Why this?
```

The second state should feel even simpler than the first.

### Golden screen 3 - Your business

```text
Your business

Gloss Beauty
Everything Enquiry uses to handle your enquiries.

Services                         8
Pricing                    Up to date
How you work                12 things
Voice                   Natural + warm
Connections                       3

Tell Enquiry something
[ Travel outside the Sunshine Coast is... ]

Needs review                       1
```

Each row drills into detail. The page is a health/knowledge overview, not a database editor.

---

## 11. Product-name status

`Enquiry` remains the working product name during UI1 research.

Do not commission or lock a final logo yet.

The word is semantically strong but generic. Current search already surfaces adjacent Australian and global products/services using 'Enquiry' prominently, including EnquiryPilot Systems, Enquiry Systems and numerous enquiry-management features in broader service-business platforms.

This is not a trademark conclusion. It is enough to justify a separate short naming check before permanent brand assets are created.

Naming criteria for the later pass:

- simple to say over the phone;
- easy to spell in Australia, UK and US markets;
- not obviously restricted to one vertical;
- not another 'AI assistant' name;
- can support a clean app icon;
- suggests movement, readiness, clarity or resolution rather than CRM administration;
- strong searchability and collision profile;
- sensible domain/social/trademark checks before lock.

---

## 12. UI1 acceptance principles

A candidate is moving in the right direction only if:

- a first-time service-business owner can identify what needs attention within a few seconds;
- the interface feels lighter even when the underlying decision object is complex;
- the user does not need to understand Enquiry's evaluator/trust terminology to complete normal work;
- important uncertainty remains visible;
- the primary action is obvious without being a giant sales-style CTA;
- phone UI feels intentionally designed rather than compressed;
- desktop does not become a multi-pane control room;
- the app still feels recognisable with most colour removed;
- motion communicates state change and then gets out of the way;
- screenshots do not look like generic AI software, a CRM or a notebook.

---

## 13. Next research/prototype work

Before this document becomes implementation authority:

1. build the same three golden screens in candidate A/B/C;
2. compare at 390px, 768px and 1440px;
3. settle typography and colour token family;
4. settle or reject the Resolve mark;
5. test the high-risk states: unknown availability, price conflict, unsupported service, external-send confirmation and booked/waiting states;
6. conduct the short public-name review;
7. revise this document into the approved UI1 design contract;
8. only then update `CURRENT_PHASE.md` and hand Slice 1 to Codex.

Until that lock, no production UI rewrite should begin.
