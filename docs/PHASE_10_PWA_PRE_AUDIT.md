# Enquiry — Phase 10 PWA / Installability Pre-Audit

**Status:** PREPARED REVIEW — NOT ACTIVE IMPLEMENTATION  
**Reviewed:** 28 August 2026

This audit sharpens:

`docs/phases/PHASE_10_INSTALLABLE_PWA_MOBILE.md`

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# 1. Verdict

Enquiry already has meaningful platform install infrastructure.

It is **not yet safe to claim a production-ready Enquiry PWA**.

The main risk is not "missing PWA code".

It is that the existing platform layer still carries builder/Grok assumptions and has not been verified as an Enquiry-branded production install on the real target host/device.

---

# 2. Existing foundation confirmed

Repo currently has:

- dynamic manifest endpoint;
- standalone display;
- Apple touch icon tag;
- theme/status-bar tags;
- iOS install tutorial;
- `beforeinstallprompt` feature handling for Chromium/install-capable browsers;
- `appinstalled` handling;
- standalone detection;
- install cue/settings surfaces;
- Vite + Nitro HTML head injection;
- OG/share identity tooling.

Do not replace this casually.

---

# 3. Critical identity defect on non-`.grok.me` hosts

`scripts/grok-pwa-shared.mjs` currently defines:

`DEFAULT_APP_NAME = "Grok App"`

and `appNameFromHost()` only derives a custom name from a `.grok.me` slug.

For a normal production host such as:

- `enquiry.com.au`;
- a Vercel/custom host without the expected Grok slug;

the manifest path can therefore fall back to:

> **Grok App**

because `renderWebManifest()` derives the manifest name from host, not from `src/lib/og/site.json`.

Phase 10A must make **Enquiry** a deliberate product identity independent of host naming.

---

# 4. Install tutorial still exposes Grok branding

`scripts/install-page.html` contains:

> Powered by Grok

and Grok logo assets.

It also uses dark platform styling/black theme.

This may be acceptable platform attribution if contractually/platform-required, but it does not currently match the premium paper/ink Enquiry product identity.

Phase 10A must determine:

- which platform attribution is mandatory;
- which content/visual identity is customisable;
- whether "Powered by Grok" should remain, be reduced, or is required.

Do not remove required platform attribution blindly.

---

# 5. Manifest identity/theme

Current manifest:

- `name` = host-derived;
- `short_name` = same;
- `id` = `/`;
- `start_url` = `/`;
- `scope` = `/`;
- `display` = `standalone`;
- `background_color` = `#000000`;
- `theme_color` = `#000000`;
- one 180×180 icon at `/__grok/icon-180.png`.

Phase 10A should explicitly decide:

### Name
`Enquiry`

### Short name
Likely `Enquiry` unless device testing proves truncation.

### Start URL
Review whether installed users should open:
- `/`; or
- an authenticated operator entry such as `/enquiries`.

The marketing homepage is probably not the best installed launch target for a daily operator app.

Any authenticated start URL must still handle signed-out/expired sessions correctly.

### Theme/background
Use approved Enquiry paper/ink system, not platform black by default.

### Icon set
Audit whether a single 180 icon is enough across:
- Apple touch;
- Chromium install;
- maskable launcher contexts.

Add only the sizes/purposes actually needed by target browsers.

---

# 6. Icon audit

Current tree only exposes:

`public/__grok/icon-180.png`

No separate visible 192/512/maskable icon assets were found in the tree audit.

Phase 10A should create/use Enquiry-branded application icons at appropriate sizes/purposes if required by real browser installability.

Do not share or ship source font assets merely to generate icons.

---

# 7. Service worker

Repo tree audit found no obvious:

- service worker;
- Workbox setup;
- `sw.js`;
- registration module.

This does **not** automatically mean installability fails on all current browsers.

Phase 10A must test actual install eligibility rather than cargo-culting a service worker.

Product decision remains:

> do not add offline mutation caching/service-worker complexity merely to tick a PWA box.

If a target browser actually requires a worker for the desired install behaviour, add the smallest safe shell strategy and ensure stale business state cannot masquerade as current truth.

---

# 8. Android / install-capable browser behaviour

`useAppInstall()` already:

- listens for `beforeinstallprompt`;
- prevents default;
- stores the event;
- prompts on explicit user action;
- listens for `appinstalled`.

This direction is good.

Phase 10A should verify:
- prompt actually appears on target Chrome/Android;
- manifest passes install eligibility;
- installed identity/icon are correct;
- dismiss does not repeatedly nag;
- no fake prompt on unsupported browsers.

---

# 9. iOS behaviour

Two different iOS instruction paths exist:

### Platform tutorial
`?install=1&platform=ios`

### In-app settings/cue
Text says:
> Share, then Add to Home Screen.

Phase 10A should decide one coherent path.

Avoid:
- redundant tutorials;
- instructions that assume old Safari toolbar layout;
- promising full-screen behaviour before actual device verification.

---

# 10. Current install copy is stronger than current verification

Current signed-in UI says things such as:

> Enquiry is on this phone.

and:

> Opens as Enquiry, not a browser tab.

and:

> Add Enquiry to the Home Screen. It opens as the app, not a tab.

The conceptual behaviour is correct for standalone installs.

But current manifest identity can still be `Grok App` depending on host, and device verification is not yet complete.

Therefore:

- do not surface installability as a public marketing claim before 10A;
- signed-in beta copy should be audited when 10A runs;
- don't call the capability complete based on `display: standalone` alone.

---

# 11. Install dismissal state

`InstallCue` currently stores dismissal through `usePrototype`.

R2B should classify this as device/UI-local state.

Phase 10 should not accidentally persist "not now" as a tenant/business preference.

A user may reasonably want different install prompts on different devices.

---

# 12. Installed operator start experience

Installed Enquiry should prioritise:

> What needs me right now?

Not:
- homepage;
- roadmap;
- updates;
- marketing navigation.

Phase 10A/10B should test launch while:

- signed in;
- signed out;
- session expired;
- onboarding incomplete;
- multi-business account.

No dead-end standalone auth window.

---

# 13. Baseline PWA test debt

R1 final gate classified a group of pre-existing platform/PWA harness failures.

The current test file includes legacy assumptions/examples around:
- `Wild Race`;
- `Grok App`;
- host-derived identity.

Phase 10A is the natural phase to update these tests to the **approved Enquiry identity contract**, while preserving genuine platform injector/security coverage.

Do not simply delete red tests.

---

# 14. Phase 10A exact priorities

1. Product-owned Enquiry manifest identity independent of host.
2. Enquiry icon set.
3. approved theme/background.
4. intentional installed start URL.
5. retain necessary platform OG/head behaviour.
6. iOS tutorial truth/branding.
7. Android/Chromium real install eligibility.
8. signed-in/signed-out standalone session flow.
9. classify whether a service worker is actually necessary.
10. turn PWA baseline tests into real Enquiry identity tests.

---

# 15. Phase 10B exact priorities

After 10A:

- standalone operator shell;
- safe-area top/bottom;
- bottom nav;
- enquiry review/correction;
- keyboard;
- back behaviour;
- external links;
- network failure;
- no false success;
- no install cue inside installed app;
- one-handed "Needs me" workflow.

Do not rebuild as native.

---

# 16. Acceptance additions to existing Phase 10 brief

Before saying "installable":

- [ ] custom production host manifest says Enquiry.
- [ ] installed launcher/home screen says Enquiry.
- [ ] installed icon is Enquiry-branded.
- [ ] start URL opens intentional product route.
- [ ] signed-out installed launch recovers through auth.
- [ ] iOS physical-device add-to-home-screen tested if available.
- [ ] Android physical-device/Chrome install tested if available.
- [ ] legacy Grok/Wild Race test assumptions are reconciled, not hidden.
- [ ] no service worker added without a demonstrated need.
- [ ] public site still does not claim App Store/Play Store availability.
