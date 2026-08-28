# Enquiry — R2 Foundation Review

**Reviewed:** 28 August 2026  
**Purpose:** Record the concrete gaps between the already-landed database/server foundation and a truthful first-beta operator product.

This is a product-management review, not implementation authority.

Execution remains controlled by `docs/CURRENT_PHASE.md`.

---

# 1. Overall verdict

The server-side foundation is useful and worth preserving:

- relational product schema;
- integer-minor-unit money storage;
- RLS lockdown;
- Supabase-auth user identity;
- membership-based tenancy helpers;
- server workspace loader;
- server-side audit writer;
- initial tenancy-checked mutations.

But the operator product is **still a fixture/session-storage prototype**.

The cutover is not a matter of simply calling `fetchWorkspace()`. Several current UI behaviours assume fixture IDs, fake integrations, local undo and seeded sample data.

R2 must remove those assumptions deliberately.

---

# 2. New-user provisioning is not yet safe/product-correct

Current:

`src/lib/server/workspace.ts` calls `provisionIfEmpty(context.userId)` automatically.

`src/lib/repo/provision.server.ts` then seeds the first fixture business and its fixture enquiries/bookings into real tables.

Problems:

1. a new real user would silently become a sample business;
2. sample customer enquiries would look like their own live work;
3. sample integration states/rules would become persisted tenant truth;
4. `provisionIfEmpty` checks for membership before entering the create transaction, so two concurrent first-load requests can both observe zero memberships and provision two businesses for the same user.

The comment claiming retry/double-submit idempotency is stronger than the actual concurrency guarantee.

### R2A requirement

- no automatic sample tenant creation;
- real onboarding creates the first business;
- creation/retry is genuinely concurrency-safe;
- sample data stays in `/demo`.

---


## 2A. Partial provisioning correction already landed — not R2A sign-off

Commit:

`ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080`

improves the foundation materially:

- fixture enquiries/bookings are no longer seeded;
- the persisted placeholder business is generic rather than Glow & Co;
- action policies start at `Ask every time`;
- no fixture knowledge/integrations are copied.

Keep that direction.

However it is **not R2A-complete**.

### Remaining race

`provisionIfEmpty()` still:

1. queries membership outside the creation transaction;
2. if none exists, calls `provisionWorkspace()`.

Two concurrent first-load requests can both observe no membership and each create a different business, because `business_member` uniqueness is on `(business_id, user_id)`, not one-business-per-user.

The new comment saying a double-submit/retry cannot create two workspaces is therefore still stronger than the implementation.

R2A must provide a genuine creation-once mechanism while preserving future multi-business membership.

Acceptable approaches include a transaction-scoped lock/recheck or another explicit idempotency primitive. Do not add a permanent one-business-per-user constraint merely to solve bootstrap concurrency.

### Fixture catalogue coupling

The new provisioner imports `BUSINESSES` solely to derive the action-policy catalogue.

Those values may be product definitions rather than tenant content, but live server provisioning should not depend on demo fixture objects as its canonical schema source.

R2A should move/reuse a canonical domain policy catalogue and let fixtures depend on that, not the reverse.


# 3. Real business IDs currently break parts of the UI

Several operator components contain fixture-ID assumptions.

### `src/components/shell/account-menu.tsx`

Non-demo businesses are filtered with:

`businesses.filter((b) => b.id === "glow")`

A persisted UUID tenant would therefore disappear from the selector.

The menu also exposes:

- Fixture lab;
- Reset prototype;
- Set up Business Brain via the prototype onboarding state.

These are demo/development controls, not normal live-account controls.

### `src/components/shell/more-sheet.tsx`

Same `b.id === "glow"` live filtering assumption.

It also offers:

- Open sample jobs;
- Set up again

inside the operator sheet.

Sample jobs must route to isolated demo/sample behaviour, not replace live tenant state.

### `src/components/trust/trust-screen.tsx`

Multiple areas use:

`filter === "all" ? "glow" : filter`

and the desktop workspace selector maps over the static fixture `BUSINESSES`.

That will choose/display the wrong business once real UUID tenants exist.

### R2B requirement

Remove fixture-ID assumptions from live operator rendering.

Demo-only selectors/controls must not leak into normal operator mode.

---

# 4. The operator store remains authoritative

The following significant surfaces still read/write `usePrototype` directly:

- app shell;
- queue/workspace;
- enquiry intelligence;
- conversation/replies;
- Business Brain;
- bookings;
- Trust Centre;
- Insights;
- Settings;
- onboarding;
- notices/jump/more/account controls.

This means the current persisted server workspace is not the runtime product state.

### R2B requirement

The live workspace must be hydrated from authenticated server data and remain server-authoritative after reload.

A client store/provider can remain as a rendering/cache façade if doing so avoids unnecessary UI churn.

But session storage must not restore old business/enquiry/booking state over current server state.

---

# 5. Live operator mode still performs demo theatre

### Fake arriving enquiry

`src/components/enquiry/workspace.tsx` waits about 4.8 seconds and calls `arriveEnquiry()` when the user is onboarded.

That inserts the hard-coded Sofia Instagram fixture and resolves it with pre-authored fixture logic.

This is useful demo behaviour.

It is unacceptable in a real tenant.

### Prototype reset/sample controls

Settings/account controls can reset F01–F20 into the current session.

In live mode this would undermine the persisted-authority model and create dangerous ambiguity between real and synthetic work.

### R2B requirement

All fixture-arrival/reset/sample behaviour is demo-only.

---

# 6. Integration UI currently fabricates connection state

### `src/routes/_app/settings.tsx`

Buttons currently call client-store `connectIntegration(...)` and immediately say things such as:

- "Mailbox connected. Enquiry will keep reading."
- "Reconnect calendar"
- "Connect [provider]"

No production integration handshake necessarily occurred.

### `src/components/trust/trust-screen.tsx`

Access UI similarly calls local `connectIntegration` / `disconnectIntegration` and then displays technical scopes/usage from fixtures.

### Product rule

For first beta, unsupported production integrations must remain:

- Not connected;
- Coming later;
- Manual/private input available.

Do not persist a fake "connected" state.

If an integration is simulated inside `/demo`, label it as demo.

This is addressed across R2A/R2C/R2F.

---

# 7. Autopilot evidence is fixture evidence, not tenant evidence

`TrustAutomation` currently says, for Glow:

> Enquiry has handled 74 comparable missing-info requests. 72 approved unchanged...

Those are fixture/demo proof numbers.

A real tenant must not see synthetic evidence presented as their automation history.

### R2C/R2F requirement

- fixture automation evidence stays in demo;
- live automation evidence is derived only from that tenant's real recorded outcomes;
- first beta remains review-first by default;
- no action class earns autonomy from synthetic counts.

---

# 8. Audit is written server-side but not yet loaded into workspace

The database has append-only `audit_event` and server mutations already call `recordAudit`.

However `loadWorkspace()` currently returns only:

- businesses;
- enquiries;
- bookings.

The Trust Audit UI still displays local `audit` / fixture instrumentation events.

### R2B/R2C requirement

If live audit is exposed in the operator product, load the tenant audit records from the server.

Do not combine synthetic fixture instrumentation with real audit history.

---

# 9. Preferences need to be split by authority

Current `WorkspacePrefs` contains:

- working days/hours;
- timezone;
- notification toggles.

The product schema does not currently have a dedicated preference record.

Not all preferences have equal importance.

### Decision-affecting preferences

Working hours/timezone can affect follow-up timing and therefore must be server-authoritative if the live Decision Engine uses them.

### Device/UI preferences

Pure notification/display/install dismissals may remain device-local until a product need justifies sync.

### R2C requirement

Persist the preferences that influence business decisions.

Do not move every UI toggle to Postgres merely for architectural purity.

---

# 10. Local Undo becomes unsafe after server mutations

The prototype store snapshots local arrays and supports `undoLast()`.

Once an action is persisted server-side, a client-only undo would create a split-brain state:

- UI appears reverted;
- database remains changed.

### R2C/R2D requirement

For each persisted action that currently exposes Undo, choose deliberately:

- implement a real server-side inverse operation with audit/history semantics; or
- remove/disable Undo for that action and use an explicit corrective operation.

Never keep a cosmetic client-only undo on top of a persisted business mutation.

---

# 11. The existing server mutations are partial foundation, not a complete action layer

`src/lib/server/workspace.ts` currently includes useful tenancy-checked operations for:

- note;
- snooze;
- per-action policy mode;
- pause/resume.

These should be preserved/reused where correct.

Missing first-beta server semantics still include major areas such as:

- Business Brain confirmation/conflict resolution/learning;
- fact correction + supersession;
- deterministic re-evaluation persistence;
- manual inbound/customer update;
- mark lost/decline;
- review/accept/edit/reject outcome telemetry;
- arbitrary enquiry creation/interpretation.

R2C/R2D should extend the existing server boundary rather than creating a parallel API style.

---

# 12. Current re-evaluation is still fixture-specific

`src/domain/reeval.ts` contains branches for specific fixture IDs such as F03/F09/F15/F17.

`src/fixtures/arriving.ts` hard-codes an arriving Instagram request and its resolved Decision Object.

`src/domain/brain-apply.ts` contains business/fixture-oriented deterministic examples.

These are valuable regression/demo assets.

They are not a general interpretation engine for arbitrary first-beta enquiries.

### R2E requirement

A real pasted enquiry needs:

1. structured interpretation;
2. provenance;
3. Business Brain service/rule mapping;
4. dynamic evaluator applicability;
5. deterministic validation;
6. minimum blocker;
7. safe recommendation/draft;
8. persisted Decision Object.

Do not delete useful fixtures. Keep them as evals/demo proofs.

---

# 13. Currency type is still Australia-only in the domain layer

Database comments/schema are deliberately currency-aware, but current TypeScript domain types still define:

`Money.currency: "AUD"`

and:

`Business.currency: "AUD"`

This does not block an Australia-first beta.

It **does** mean the current domain is not yet genuinely global-currency typed despite the database direction.

### Decision

Do not broaden active R2 solely for internationalisation unless required by the cohort.

Record this as a future global-readiness correction before a non-AUD market launch.

Do not advertise multi-currency production support yet.

---

# 14. First-beta cutover map

## R2A
Fix:

- fixture auto-provisioning;
- real onboarding;
- create-once concurrency;
- fake integration selections during setup.

## R2B
Fix:

- authenticated workspace load;
- fixture-ID UI assumptions;
- demo/live runtime isolation;
- fake arrival/reset/sample controls;
- live audit read if exposed.

## R2C
Fix:

- business/Brain/trust mutations;
- decision-affecting preferences;
- real vs synthetic automation evidence;
- persisted-audit semantics;
- unsafe local Undo on affected actions.

## R2D
Fix:

- enquiry/fact state mutation;
- supersession;
- deterministic re-evaluation;
- follow-up/lost/decline/manual update;
- unsafe local Undo on enquiry mutations.

## R2E
Add:

- arbitrary manual/private enquiry ingestion;
- interpretation + deterministic decision compilation.

## R2F
Add:

- truthful manual review/action loop;
- correction/outcome/repeat-use telemetry;
- no fake send/payment/booking integration wording.

---

# 15. What to preserve

Do not throw away strong prototype work merely because it is fixture-driven.

Preserve as demo/eval assets:

- F01–F20;
- Ridge signature continuity proof;
- minimum-blocker examples;
- Unknown/integration-down cases;
- Business Brain conflicts;
- non-universal pricing;
- same-engine/different-business proof;
- action-authority demonstrations.

The goal is:

> **separate demonstration truth from live tenant truth, then make the same product laws work on arbitrary real enquiries.**
