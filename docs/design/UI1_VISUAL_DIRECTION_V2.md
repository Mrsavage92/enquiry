# UI1 visual direction v2

Date: 2026-09-10
Status: RESEARCH / DESIGN DECISION DRAFT - NOT PRODUCTION AUTHORITY

This revision exists because the first Quiet Signal mock remained too visually close to the existing Enquiry product. It improved hierarchy but inherited too much of the current warm-paper + forest-green identity and therefore looked like a tidier version of the existing UI rather than a new product language.

## 1. Core correction

**Quiet Signal remains the UX doctrine, not the visual style.**

Quiet Signal means: surface the important outcome, keep supporting reasoning available on demand, and do not make the owner manage the intelligence engine.

It does **not** mean blank, monochrome, characterless or stripped of useful application structure.

The visual language will be developed separately under the working name **Editorial Utility**:

- the clarity and legibility of a native productivity app;
- selective expressive colour rather than a single corporate accent everywhere;
- deliberate typography and proportion;
- a light application shell with a recognisable tinted navigation plane;
- brand character concentrated in moments that earn it: onboarding, empty states, plan/referral surfaces, state transitions and marketing;
- working surfaces remain quiet enough that the enquiry is the subject.

## 2. Green decision

Deep forest green is no longer proposed as Enquiry's primary brand colour.

Reasoning:

- there is no requirement for a service-business SaaS product to use green in order to appear trustworthy;
- brand-colour congruity and consistent use matter more than simplistic colour-psychology rules;
- the founder does not personally like green, which is a poor foundation for a colour that would need to be lived with everywhere;
- the existing Enquiry product already uses forest green, so retaining it keeps the redesign visually anchored to the current identity.

Green remains available as a **semantic success/available/healthy state colour**, not the brand identity.

## 3. Proposed palette direction

The target is not "AI purple". Avoid neon gradients, glowing violet orbs and purple on every selected state.

### Foundation

- App canvas: warm-neutral fog, approximately `#F6F5F3`
- Work surface: `#FFFFFF`
- Navigation plane: very pale lilac-grey, approximately `#F0EEF4`
- Primary ink: warm near-black, approximately `#1C1B1F`
- Secondary ink: approximately `#68656D`
- Hairline: approximately `#E7E4EA`

### Brand colour

Use a restrained **violet / aubergine family** as Enquiry's distinctive accent.

Working range:

- Primary violet: approximately `#6C55C7`
- Dark violet: approximately `#49378E`
- Soft violet: approximately `#EDE7FA`
- Pale violet: approximately `#F6F2FC`

The exact values are not locked until accessibility and side-by-side screen testing.

### Supporting colour

One warm counter-accent may be used for expressive brand moments, never general UI decoration:

- soft apricot / clay / amber family.

Semantic colours remain separate:

- success / available: green;
- caution / waiting risk: amber;
- destructive / error: red.

## 4. Colour-use rule

The brand should not be "a purple app" in the same way the current product can feel like "a beige-and-green app".

Use colour in three layers:

1. **90% neutral application structure** - canvas, surfaces, text and navigation.
2. **~8% brand expression** - key active moments, occasional controls, identity surfaces and motion.
3. **~2% semantic status colour** - green, amber, red only when the meaning warrants it.

Primary actions may often use dark ink rather than violet. This preserves violet as a recognisable brand moment instead of turning it into generic button chrome.

## 5. Logo / mark decision

The existing boxed E mark is not part of UI1.

Do not spend implementation time polishing or animating it.

Until product naming is locked:

- use a clean text wordmark in the application shell;
- do not force a replacement mascot, monogram or abstract AI symbol;
- treat the eventual app icon / mark as a separate identity exercise.

The earlier Resolve concept remains an exploratory motion metaphor only. It is **not an approved logo concept**.

## 6. Application structure: do not over-strip

The first UI1 pass over-corrected toward too few destinations. Wispr Flow is a useful reminder that a simple product can still expose several clear pages while keeping each page focused.

Desktop target:

### Primary navigation

1. Today
2. Enquiries
3. Booked
4. Business
5. Insights

These labels are working labels, not final copy.

### Secondary / sidebar footer

- plan and usage;
- Refer a friend;
- Help / Support;
- Settings / Account.

Connections, permissions, automation/trust controls and implementation-heavy administration should live inside Business/Settings rather than occupying permanent primary navigation.

### Freemium / referral surface

Reserve a compact area in the sidebar/footer for:

- current plan;
- usage remaining / usage this period;
- upgrade entry point;
- Refer a friend.

The UI may be designed before the actual free quota is chosen, but must not invent a real quota or entitlement in production.

## 7. Mobile navigation

Do not merely compress desktop.

Target 4-5 obvious destinations at most. Candidate structure:

- Today
- Enquiries
- Booked
- Business
- More

Insights can sit in More if testing shows five full destinations create unnecessary noise.

Account, referral, usage, support and settings should be reachable from the profile / side menu, similar in principle to Wispr's mobile separation of primary app tabs from account/support surfaces.

## 8. Character without clutter

The core app should be calm, but the brand should not be blank.

Character should come from:

- a very distinctive navigation-plane tint;
- excellent type scale and spacing;
- selective violet and warm counter-accent;
- subtle state motion;
- crafted empty states;
- lightweight editorial illustration on onboarding, referral, upgrade and marketing surfaces;
- occasional large brand typography outside the working enquiry surface.

### Illustration direction

No mascot and no AI character.

Explore an abstract editorial system around **messy fragments becoming a clear outcome**:

- snippets of message-like lines;
- loose marks / fragments;
- one resolved path or object;
- slightly hand-made / human geometry rather than perfect neural-network diagrams;
- static in the working app, more expressive on marketing/onboarding.

The concept should be recognisable without literally drawing chat bubbles, robots or waveforms.

## 9. What we are borrowing from Wispr

Borrow:

- simple left navigation with a calm main surface;
- several focused pages rather than one dashboard trying to explain everything;
- account/support/referral/usage separated from the primary task navigation;
- warm neutral foundations;
- multiple restrained brand colours instead of one accent everywhere;
- illustration and motion outside the core working surface;
- brand through rhythm and proportion rather than constant decoration.

Do not borrow:

- their exact lavender, green, cream or iconography;
- their waveform / voice metaphor;
- their serif choices verbatim;
- their exact sidebar layout or visual assets.

## 10. Golden-screen visual target

The next prototypes must look **materially different** from current Enquiry before they can pass.

A screen fails if a reasonable observer could describe it as "the current Enquiry UI with cleaner spacing."

Required differences include:

- no paper/ledger texture;
- no boxed E logo;
- no forest-green primary brand system;
- no serif-led operational UI;
- light tinted navigation plane instead of current visual metaphor;
- white, crisp work surface;
- new type scale and component proportions;
- selective violet-based identity;
- expressive brand treatment confined to earned surfaces;
- retained real application navigation rather than an artificially empty mock.

## 11. Next visual prototypes

Prototype the same real Enquiry state across:

1. Desktop Today / Enquiries shell
2. Desktop open enquiry
3. Desktop Business home
4. Mobile Today
5. Mobile open enquiry

The prototypes must include sidebar/footer plan/usage/referral treatment so the shell can be judged as a complete product, not a blank wireframe.

Do not implement production screens until this direction is visually approved.