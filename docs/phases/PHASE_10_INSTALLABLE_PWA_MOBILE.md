# Phase 10 — Installable App Experience + Mobile Product Shell

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 10.**

This phase makes Enquiry installable and app-like on a phone using the web/PWA path first. It is **not** a native iOS/Android rewrite.

---

## 1. Objective

A service-business owner should be able to install Enquiry on their phone and use the core enquiry workflow in a standalone, intentional mobile experience.

Success should feel like:

> **Enquiry lives on my Home Screen and behaves like a lightweight work app — not a website I happened to save.**

PWA/web-install is the first productisation path because it lets us validate real mobile usage before taking on native-app distribution and maintenance.

---

## 2. Important existing foundation

Do **not** assume PWA work starts from zero.

The repository already contains platform-level install/PWA infrastructure, including:

- `scripts/grok-pwa-plugin.mjs`;
- `scripts/grok-pwa-shared.mjs`;
- `server/middleware/grok-pwa.ts`;
- injected manifest/head tags;
- an iOS `?install=1&platform=ios` tutorial path;
- an existing install icon asset under `public/__grok/`;
- standalone-display manifest behaviour.

`vite.config.ts` explicitly wires the PWA plugin and deployed Nitro middleware.

**Phase 10 must audit and productise this existing capability rather than replacing platform infrastructure casually.**

A source-level pre-audit has already been completed in:

`docs/PHASE_10_PWA_PRE_AUDIT.md`

That review confirms concrete current risks including host-dependent `Grok App` manifest fallback, Grok-branded install tutorial chrome, black manifest colours, a single visible 180px icon, and no obvious service-worker implementation. Verify these against the then-current tree rather than assuming they remain unchanged.

If platform-owned PWA code has constraints, work with them. Do not delete or fork it merely for aesthetic cleanliness.

---

## 3. Phase outcome

By the end of Phase 10, product management should be able to verify on real target devices/browsers that:

- Enquiry has correct install metadata/branding;
- the install flow is understandable;
- installed launch opens the intended Enquiry app experience;
- standalone mode looks intentional;
- mobile navigation and safe areas behave correctly;
- key enquiry actions are usable one-handed;
- network loss/failure does not create misleading behaviour;
- the product does not pretend to support native capabilities that have not been built.

---

## 4. PWA branding audit

Inspect the generated manifest/head tags and the source they derive from.

Current platform defaults may use host-derived or Grok-default identity and black PWA chrome. Verify rather than assuming the installed app will present exactly as Enquiry.

Required outcome:

- installed name is `Enquiry` or an intentionally approved short name;
- Home Screen/app launcher icon is Enquiry-branded and crisp;
- theme/background colours suit the approved Enquiry visual system from Phase 9;
- startup/standalone presentation does not expose `Grok App` or platform placeholder branding to the customer;
- manifest `start_url`, `scope`, `display` and identity are appropriate for the real product;
- Apple touch metadata is correct;
- metadata remains correct on the production host, not just live preview.

Do not break the platform’s OG/share-card behaviour while changing PWA identity.

---

## 5. Install experience

### iPhone / iPad

The repository already contains an iOS install tutorial path. Audit it as a customer flow.

It should:

- clearly say this installs Enquiry;
- use Enquiry branding rather than builder/platform language where customisation is supported;
- explain the minimum necessary Safari `Share` → `Add to Home Screen` interaction;
- return/open the correct Enquiry route;
- work with safe areas and current iOS browser chrome;
- avoid a long technical tutorial.

### Android / install-capable browsers

Audit actual browser behaviour.

Where a native browser install prompt is available, use it appropriately rather than inventing a fake install button.

If a custom install CTA is shown:

- it must only promise what the browser supports;
- it must degrade gracefully where installation is unavailable;
- dismissing it must not nag the user repeatedly.

Do not hard-code browser assumptions without feature detection where behaviour is runtime-dependent.

---

## 6. Mobile product shell

The installed app must prioritise the operator workflow, not the marketing site.

Review the current mobile app shell and core routes, especially:

- Today / enquiry queue;
- enquiry detail;
- Needs you / Waiting / At risk states;
- prepared response/review flow;
- Why? / evidence;
- correction flows;
- booking/lost completion where available;
- back/navigation behaviour.

### Core mobile principle

The owner should be able to answer quickly:

> What needs me right now?

The installed experience should minimise taps between:

`open Enquiry → see what needs attention → understand decision → approve/correct/respond`.

Do not add a mobile dashboard merely to make the app feel native.

---

## 7. Standalone-mode polish

Verify installed/standalone mode separately from normal browser mode.

Check:

- safe-area top/bottom padding;
- status-bar appearance;
- bottom navigation positioning;
- no browser-only layout assumptions;
- dialogs/sheets fit within dynamic viewport height;
- keyboard opening does not hide the active field/action;
- back behaviour does not strand the user;
- external links open sensibly;
- marketing navigation does not intrude into the operator app shell;
- no install banner appears when already running installed where that can be detected reliably.

Preserve the existing app-safe-area variables and mobile shell logic unless a concrete defect requires change.

---

## 8. Offline / poor-network behaviour

Do not promise “offline Enquiry” unless the real data/integration architecture can support it safely.

The product handles business decisions and may depend on current messages, availability or integrations. Stale information must never masquerade as current truth.

Preferred Phase 10 behaviour:

- app shell fails gracefully when connectivity is lost;
- already-rendered information may remain visible where safe;
- actions requiring network/integration clearly show they cannot be completed;
- no outbound send/booking action appears successful if it was not confirmed;
- retry/reconnect path is understandable;
- stale/unknown state beats optimistic fabrication.

A full offline-sync engine is **out of scope**.

Only add service-worker caching if it is demonstrably necessary and safe for the platform/app architecture. Do not cargo-cult a service worker merely to satisfy the word “PWA”.

---

## 9. Notifications

Push notifications are **not automatically part of Phase 10**.

Do not add push/web-push/native notification infrastructure just because the app is installable.

First validate whether first-cohort users actually need notification delivery beyond existing communication/workflow patterns.

If notification need is later proven, it should receive its own permission, delivery, privacy and reliability design.

---

## 10. Authentication / session behaviour

If authentication is active by the time Phase 10 runs, test installed-app session behaviour explicitly.

Verify:

- login survives expected app relaunches where intended;
- OAuth/external auth does not trap the user in an unusable standalone window;
- returning from auth lands in the correct app state;
- logout works;
- expired sessions fail clearly.

Do not enable dormant auth features solely for Phase 10.

---

## 11. Install CTA placement

Do not turn the public homepage into “Download our app” before the product is actually useful.

Install promotion should be contextual.

Possible approved surfaces after capability is verified:

- inside the logged-in/operator app;
- a small account/settings/help surface;
- post-beta onboarding;
- Early Access onboarding instructions.

A homepage install CTA should be added only if product management decides it improves conversion rather than distracting from waitlist/product understanding.

---

## 12. Native app boundary

Phase 10 is **web/PWA first**.

Do not build:

- Swift/SwiftUI app;
- Kotlin/Android app;
- React Native app;
- Flutter app;
- Capacitor wrapper;
- App Store / Play Store release pipeline;

unless a later product decision explicitly authorises it.

Native packaging becomes justified only if real product needs emerge such as:

- reliable push requirements;
- native share/intents;
- background tasks;
- deeper device integrations;
- app-store distribution as a meaningful acquisition/trust requirement;
- PWA limitations that materially harm usage.

Do not choose native because it feels more “real”.

---

## 13. Testing matrix

Test the real install/product experience, not just manifest JSON.

At minimum verify where devices are available:

### iOS
- Safari normal browser;
- Add to Home Screen flow;
- installed standalone launch;
- small/standard iPhone viewport;
- keyboard + text entry;
- safe areas;
- orientation sanity (portrait is primary; landscape must not catastrophically break).

### Android / Chromium
- normal browser;
- install eligibility/prompt where supported;
- installed standalone launch;
- back navigation;
- keyboard + text entry;
- safe-area/viewport behaviour.

### Desktop
Ensure PWA/install changes do not regress normal desktop web behaviour.

If physical device testing is unavailable, clearly state what was emulated versus actually device-tested. Do not claim device QA that did not occur.

---

## 14. Performance

Installed should feel fast.

Audit:

- initial app-shell payload;
- avoid loading public-site media into operator routes unnecessarily;
- route transitions;
- repeated data loading;
- large icon/splash assets;
- install tutorial assets;
- mobile video/autoplay behaviour if public pages are opened from the installed context.

Do not begin a broad performance rewrite. Fix material, measurable mobile regressions only.

---

## 15. Accessibility

Maintain:

- touch targets;
- keyboard support where hardware keyboard is used;
- visible focus;
- semantic controls;
- reduced motion;
- sufficient contrast;
- zoom/text sizing resilience;
- screen-reader labels for mobile navigation/actions.

Installed mode is not an excuse to remove web accessibility.

---

## 16. Do not do

- do not rebuild the app as native;
- do not replace the existing platform PWA middleware/plugin without a demonstrated requirement;
- do not create fake install prompts;
- do not add push notifications by default;
- do not add offline mutation queues;
- do not create a new mobile dashboard;
- do not change the core product model;
- do not reopen Phase 9 visual direction except for install/mobile defects;
- do not start new channel integrations.

---

## 17. Suggested execution slices

Because platform install mechanics and mobile UX are different risk classes, product management may split Phase 10.

### 10A — installability + branding

- audit existing PWA infrastructure;
- correct manifest/app identity;
- verify install tutorial/prompt behaviour;
- verify actual installed launch;
- device/browser evidence;
- stop for review.

### 10B — installed mobile shell polish

Only after 10A review:

- standalone shell/navigation;
- safe areas/keyboard/back behaviour;
- core operator-flow speed;
- poor-network behaviour;
- final mobile productisation QA.

Do not execute both automatically unless `CURRENT_PHASE.md` explicitly authorises it.

---

## 18. Acceptance criteria

- [ ] Existing PWA/platform infrastructure was inspected before implementation.
- [ ] Installed identity visibly says Enquiry rather than placeholder/builder branding.
- [ ] Home Screen/app icon is correct and crisp.
- [ ] Production manifest/head metadata is correct.
- [ ] iOS install flow is clear and works on the intended route.
- [ ] Android/install-capable browser behaviour is verified where available.
- [ ] Installed standalone mode feels intentional.
- [ ] Core `what needs me?` workflow remains fast on mobile.
- [ ] Safe areas, keyboard and primary navigation behave correctly.
- [ ] No network-dependent action falsely appears successful while offline/disconnected.
- [ ] No unnecessary native/push/offline-sync scope was added.
- [ ] Desktop browser experience is not regressed.
- [ ] Typecheck/build/relevant tests pass under the regression policy.
- [ ] Real-device versus emulated QA is reported accurately.

---

## 19. Required handoff

Report:

1. existing PWA capability found before changes;
2. manifest/install identity changes;
3. install flow changes;
4. mobile/standalone shell changes;
5. real devices/browsers tested versus emulated;
6. network/offline behaviour verified;
7. tests/typecheck/build results;
8. any remaining PWA limitation that might justify native work later.

Then stop. Product management decides whether a future native-app phase is warranted.
