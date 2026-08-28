# Enquiry — Live vs Demo Separation Map

**Status:** MANAGEMENT REVIEW / PREPARED  
**Purpose:** Prevent fixture/demo assumptions from surviving the persisted-operator cutover.

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# Core rule

> **Fixtures prove product laws. They are never silent live tenant truth.**

The following demo assets remain valuable:

- F01–F20 enquiries;
- fixture businesses such as Glow & Co / Ridge / Northlight / Harbour;
- Sofia arriving enquiry;
- synthetic bookings;
- synthetic audit/automation evidence;
- simulated integration states;
- fixture customer quote/booking pages;
- fixture re-evaluation branches.

They belong in:

- `/demo`;
- eval/test fixtures;
- explicitly labelled local/prototype routes.

They must not become the authenticated tenant runtime.

---

# 1. Store/runtime

## `src/store/prototype-store.ts`

Current responsibilities mix:

### Demo fixture authority
- seed from `BUSINESSES`, `ENQUIRIES`, `BOOKINGS`;
- reset;
- restore fixture;
- enter sample;
- fake arrival;
- fake client reply;
- fixture-specific decision mutations;
- synthetic audit;
- synthetic automation evidence.

### Potential reusable UI state
- business filter;
- queue filter;
- selected Brain tab;
- dialog state;
- draft edit text;
- install dismissal;
- transient notice state.

### Live persisted actions
Many actions currently mutate the prototype arrays directly but must move server-side.

**R2 disposition:**

- R2B: split server-authoritative live hydration from demo seed; persist only UI/transient state locally.
- R2C/R2D/R2F: replace meaningful live mutations with server operations.
- Keep fixture mutation behaviour only for `/demo`/tests.

Do not attempt to make one persisted Zustand snapshot serve both runtimes invisibly.

---

# 2. Onboarding

## `src/routes/onboarding.tsx`

Verified demo/live contamination:

- `usePrototype` controls onboarding step/source/completion;
- voice written to business id `glow`;
- selected channels call local `connectIntegration`;
- hard-coded Australia/NZ city/timezone map;
- sample Glow prices/rules;
- sample "jobs" and exact dollar outputs;
- final success is client-local before server completion.

**R2A:** active correction already covers this.

After R2A:
- live onboarding only persists actual profile;
- sample rule/pricing theatre must be isolated or explicitly non-authoritative;
- full real Brain setup is R2C.

---

# 3. App shell / workspace selectors

## `src/components/shell/app-shell.tsx`
Live app shell currently consumes prototype-store tenant state.

**R2B:** hydrate from authenticated server runtime.

## `src/components/shell/account-menu.tsx`
Known fixture assumptions:
- live business filtering around `glow`;
- sample/prototype reset/setup controls.

**R2B:** real memberships only; sample links route to `/demo`.

## `src/components/shell/more-sheet.tsx`
Known:
- `glow` substitution/filter;
- sample jobs/setup actions.

**R2B:** real memberships; no live sample-state replacement.

---

# 4. Queue and enquiry workspace

## `src/components/enquiry/workspace.tsx`

Known:
- prototype store source;
- timed `arriveEnquiry()`;
- last-arrival demo behaviour.

**R2B:** no fake arrival in live mode.

## `src/components/enquiry/queue.tsx`
Uses prototype enquiry/business arrays.

**R2B:** render authenticated workspace data, UUID-safe.

## `src/components/enquiry/conversation.tsx`
Current reply/receive behaviour is prototype-backed.

**R2D/R2F:** live messages/actions persist server-side.

## Other enquiry components
Examples:
- briefing;
- case file;
- intelligence;
- situation card;
- quote sheet;
- waiting desk;
- teach dialog.

They may continue consuming a compatible store/provider shape after R2B, but meaningful changes must no longer mutate fixture arrays in live mode.

---

# 5. Business Brain

## `src/components/business/brain-screen.tsx`

Current live-looking interactions use prototype business knowledge and learning suggestions.

Prototype actions include:
- `confirmKnowledge`;
- `resolveConflict`;
- `tellEnquiry`;
- `confirmBrainChange`;
- `confirmLearning`;
- `dismissLearning`;
- `setVoice`.

**R2C:** server persistence + typed rule governance.

Fixture Brain examples remain demo/eval assets.

---

# 6. Trust

## `src/components/trust/trust-screen.tsx`

Known live/demo problems:

- static fixture `BUSINESSES`;
- `glow` fallback;
- local action-policy mutation;
- local integration connect/disconnect;
- synthetic audit;
- synthetic automation/evidence counts.

**R2B:**
- real business selector;
- real server read state/audit or deliberate unavailable state.

**R2C:**
- persist trust/action policy;
- remove fake integration actions;
- real-only evidence.

**R2F:**
- real review outcomes begin generating action evidence.

---

# 7. Settings

## `src/routes/_app/settings.tsx`

Verified:

- prototype businesses/filter/pause/resume;
- local working prefs;
- local `connectIntegration`;
- fake success toast "Mailbox connected";
- fake calendar connect;
- fake social connect;
- prototype reset;
- setup again for Glow & Co.

**R2B:**
- live server state;
- remove/isolate prototype section;
- unsupported integrations shown honestly.

**R2C:**
- persist pause and decision-affecting working preferences.

Integration OAuth itself is deferred.

---

# 8. Bookings

## `src/components/bookings/bookings-calendar.tsx`
## `src/components/bookings/job-sheet.tsx`

Prototype booking state/actions currently power operator behaviour.

Actions include:
- deposit record;
- reschedule;
- cancel.

**First-beta product decision:**

Only persist operations that are truthful manual records.

Do not imply payment processor/calendar provider execution.

**R2D/R2F:**
- manual/external booking state;
- idempotent server mutation;
- truthful labels.

---

# 9. Insights

## `src/routes/_app/insights.tsx`

Currently derives insight from prototype arrays.

**R2B:** server-authoritative live data.

Do not seed a new tenant so the dashboard looks impressive.

Empty/low-data insights are acceptable.

Current exact-price KPI remains conditional.

---

# 10. Public fixture routes

## `src/routes/q/$enquiryId.tsx`
## `src/routes/book/$bookingId.tsx`

R1D contains these behind explicit fixture public-link mode.

**R2 preservation rule:**
- never hydrate from live tenant runtime;
- never resolve a live UUID;
- never become a public auth model by accident.

A real capability-link feature is separate future scope.

---

# 11. Fixture-specific domain logic

## `src/domain/reeval.ts`
Known branches by fixture enquiry id.

## `src/domain/brain-apply.ts`
Known fixture/business-specific knowledge titles and prose parsing.

## `src/fixtures/arriving.ts`
Hard-coded Sofia arrival + resolved decision.

**Preserve as:**
- demo behaviour;
- regression/eval cases.

**Do not use as:**
- arbitrary real-enquiry engine.

R2C establishes typed rules. R2E establishes arbitrary interpretation/compiler.

---

# 12. Synthetic evidence categories

These must never appear as live tenant evidence:

- comparable request counts;
- approved-unchanged counts;
- fake "learning" history;
- fake audit events;
- fake connected integration accounts;
- demo booking/payment state;
- fixture customer names;
- exact fixture prices;
- F01–F20 queue volume.

Live tenant starts with zero evidence.

---

# 13. Fixture identifiers that must not drive live branching

Audit live-path code for:

- `glow`;
- `ridge`;
- `northlight`;
- `harbour`;
- `f01` … `f20`;
- fixture booking ids such as `b1`;
- hard-coded fixture Knowledge Item titles where used as identity rather than display;
- static `BUSINESSES` enumeration.

It is fine for eval/domain test code to reference these.

It is not fine for authenticated runtime behaviour to require them.

---

# 14. Transition strategy

Recommended:

### Demo context
Explicit fixture store/provider.

### Live context
Authenticated workspace provider/store façade.

Components can initially share presentational/domain selectors where shapes are compatible.

Do not require a full component rewrite.

But no ambiguous state source.

---

# 15. Gate checklist

Before first beta:

- [ ] Live reload cannot show fixture businesses.
- [ ] Live new tenant cannot see F01–F20.
- [ ] Live new tenant cannot see synthetic bookings/audit/automation evidence.
- [ ] Live Settings cannot fake-connect a provider.
- [ ] Live operator has no timed fake enquiry.
- [ ] Live reset cannot replace real tenant data.
- [ ] `/demo` still works.
- [ ] R1D public fixture routes remain isolated.
- [ ] Fixture-specific evaluator code cannot be reached as the production arbitrary-message path.
- [ ] Real UUIDs work without fixture-ID branching.

This checklist should be re-run at the final beta gate.
