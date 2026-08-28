# R2B — Server-Authoritative Operator Runtime

**Status:** PREPARED — NOT AUTHORISED UNTIL `docs/CURRENT_PHASE.md` ACTIVATES R2B

R2B is the second slice of:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting reviews:

- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`

R2B begins only after R2A is signed off.

---

# Objective

Make the signed-in operator product render the authenticated tenant workspace from the server/database rather than treating `src/store/prototype-store.ts` + session storage + fixtures as the live source of truth.

This is a **read/runtime cutover**, not yet the full persistent mutation/Decision Engine phase.

---

# Product invariant

> **Live operator mode and demo mode are separate runtimes.**

### Live operator mode
- authenticated;
- server-authoritative tenant data;
- real UUID business/enquiry/booking ids;
- no automatic fixture arrival;
- no fixture reset;
- no synthetic business/automation history;
- empty means honestly empty.

### Demo mode
- fixture-driven;
- public `/demo`;
- may use F01–F20 and synthetic scenarios;
- must never hydrate/overwrite a signed-in tenant.

Do not infer the runtime from whether an ID happens to equal `glow`.

---

# 1. One deliberate live workspace-loading boundary

Prefer one parent boundary around the guarded app rather than every screen independently calling `fetchWorkspace`.

The live boundary should:

1. wait for verified auth;
2. call authenticated `fetchWorkspace`;
3. if `needsOnboarding`, lead/redirect to `/onboarding`;
4. otherwise hydrate the live client workspace;
5. expose explicit loading/error/empty states;
6. not fall back to fixtures when the server fails.

A failed server read is not permission to show sample data as the user's business.

---

# 2. Client-store strategy

A large visual rewrite is not required.

It is acceptable to keep Zustand as a compatibility/rendering façade if doing so lets existing components survive the cutover.

But split authority clearly.

## Server-authoritative fields

These must come from the authenticated workspace and must **not** be restored from session storage over newer server state:

- `businesses`;
- `enquiries`;
- `bookings`;
- live audit history if exposed;
- any current live Business Brain/integration/action-policy records represented inside businesses.

## Local/transient fields

May remain client/device local where genuinely presentation-only:

- business/queue filter;
- selected tab;
- open dialog;
- keyboard/jump state;
- install prompt dismissal;
- ephemeral unsaved draft editing if the product deliberately treats it as transient;
- visual notice dismissal that does not affect a business decision.

Do not persist a complete live tenant snapshot to session storage merely because the prototype did.

---

# 3. Remove fixture-ID assumptions from live surfaces

Verified examples include:

### Account / workspace menu
Current live logic includes assumptions such as business id `glow` and prototype/sample actions.

Live mode must list actual businesses returned by the authenticated workspace.

### More sheet
Must not filter/force live businesses through `glow`.

### Trust
Must not:
- map workspace options from static fixture `BUSINESSES`;
- substitute `glow` when the filter is `all`;
- show synthetic audit/automation evidence as tenant truth.

### Any other route/component
Search and remove live-path logic that depends on:
- `glow`;
- F01–F20;
- B1 fixture bookings;
- static `BUSINESSES` as the live workspace catalogue.

Keep those values inside demo/eval paths.

---

# 4. Remove demo theatre from live runtime

## Fake arriving enquiry

Current operator workspace can call `arriveEnquiry()` after a timer and insert the hard-coded Sofia/Instagram fixture.

In live mode:
- no automatic arrival timer;
- no synthetic inbound record;
- no `lastArrivalId` fixture behaviour.

R2E will later add the real manual/private ingestion path.

## Reset prototype

A live tenant must not expose an action that replaces live arrays with F01–F20/sample bookings.

"Reset prototype" and equivalent controls are demo/dev only.

## Sample jobs

If a live user chooses to see sample jobs, navigate to/isolate `/demo`.

Do not overwrite live state.

---

# 5. Real UUID routing

All signed-in operator routes must work with persisted UUIDs.

Verify:

- queue links;
- enquiry detail route;
- booking calendar/job sheet links;
- Trust/Business links;
- search/jump shortcuts;
- any URL-search state.

Do not assume a short fixture id shape for parsing, display or lookup.

Unknown/inaccessible UUIDs should produce a safe not-found/empty state without cross-tenant existence leakage.

---

# 6. Live integration truth

The database may contain integrations only when they are genuinely persisted.

R2B should render the server record honestly.

If a new tenant has no integration rows:
- Settings/Trust should say not connected / manual input available;
- do not instantiate fixture providers just to fill the screen;
- do not display fake account labels/scopes.

Actual connect/disconnect semantics are not R2B and remain later/evidence-driven.

If an unsupported "Connect" control would only mutate local state, disable/remove it from live mode rather than pretending it worked.

---

# 7. Audit history

Current server mutations already append `audit_event`, but `loadWorkspace()` does not currently return audit rows.

If Trust Audit remains visible in live mode during R2B, extend the authenticated read model to return the tenant's real audit history.

Otherwise deliberately hide/empty the audit view in live mode until real audit data is wired.

Do not combine:
- fixture audit;
- instrumentation events;
- real server audit

into one list without clear provenance.

Preferred direction: real server audit in live mode, fixture audit only in demo mode.

---

# 8. Loading / empty / error UX

## Loading
Show a stable loading shell/state.

Do not flash F01–F20 while server data loads.

## Empty workspace
A newly onboarded business with no enquiries/bookings is valid.

Show a useful first-beta empty state such as:
- "No enquiries yet";
- manual/private paste is coming in R2E / available only if actually implemented;
- public demo link optional.

Do not fabricate activity.

## Error
If workspace load fails:
- show retry;
- preserve auth session;
- do not fall back to fixture data;
- do not silently create another business.

---

# 9. Cross-tab / reload authority

Verify:

1. server state changes externally or via one tab;
2. another reload/refetch uses current server state;
3. stale session-storage business/enquiry data cannot overwrite it.

If local persisted state remains, use an explicit storage version/partialisation so old prototype payloads do not reappear in live mode after deployment.

Consider clearing/migrating legacy persisted prototype keys when a user enters authenticated live mode.

Do not delete demo-mode fixture persistence required for the public demo unless necessary.

---

# 10. Public fixture routes preservation

R1D's `/q/$enquiryId` and `/book/$bookingId` containment must not be weakened by the cutover.

If `usePrototype` becomes a wrapper around live server data:
- public fixture routes must not suddenly inherit tenant data;
- keep a dedicated fixture source or explicitly isolate those routes.

`/demo` remains the canonical public fixture proof.

---

# 11. Tests

At minimum add/adjust focused tests for:

### Authenticated workspace
- server data hydrates live mode;
- real UUID business/enquiry/booking render;
- zero-enquiry tenant renders empty, not fixtures.

### needsOnboarding
- zero-membership result leads to onboarding;
- no app-shell fixture flash.

### Failure
- fetch error renders retry/error;
- no sample fallback.

### Storage
- stale prototype persisted state cannot override authenticated server data;
- filters/UI preferences may survive where intended.

### Demo separation
- `/demo` still uses fixtures;
- live operator does not run arrival timer/reset/sample injection;
- R1D public fixture routes remain isolated.

### Multi-tenant
- switching among memberships only uses businesses returned for the verified user;
- inaccessible ids fail safely.

---

# Acceptance

- [ ] One authenticated parent/runtime boundary loads the workspace.
- [ ] Signed-in businesses/enquiries/bookings come from server data.
- [ ] Real UUIDs work across operator navigation.
- [ ] Server failure never falls back to fixture tenant data.
- [ ] Empty tenant is honestly empty.
- [ ] Live operator does not auto-play the Sofia/fixture arrival.
- [ ] Prototype reset/sample replacement controls are absent/isolated in live mode.
- [ ] No live selector assumes `glow` or static fixture `BUSINESSES`.
- [ ] Unsupported integrations are not rendered as fake connected accounts.
- [ ] Live audit is real server audit or deliberately unavailable, never synthetic masquerading as tenant history.
- [ ] Stale session storage cannot overwrite server-authoritative data.
- [ ] `/demo` and R1D fixture customer routes remain isolated.
- [ ] Typecheck/full tests/build pass or unchanged classified baseline is reported.
- [ ] No R2C mutation broadening, R2E AI ingestion or visual redesign.

---

# Handoff

Report:

1. live runtime boundary chosen;
2. Zustand/store strategy;
3. persisted-state/sessionStorage migration strategy;
4. fixture assumptions removed/isolation mechanism;
5. UUID navigation verification;
6. loading/empty/error states;
7. audit decision;
8. integration truthfulness changes;
9. demo/R1D preservation;
10. focused tests + full test/typecheck/build result;
11. anything that must move to R2C.

Then stop.
