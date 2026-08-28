# R2A — Real Workspace Bootstrap + Persisted Onboarding

**Status:** PREPARED — NOT AUTHORISED UNTIL `docs/CURRENT_PHASE.md` ACTIVATES R2A

R2A is the first slice of:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting reviews:

- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/R2_DECISION_ENGINE_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`

---

# Objective

A newly authenticated person becomes the owner of **their real business workspace** through deliberate onboarding.

No sample business, customer, enquiry, rule, integration or automation evidence may silently become live tenant truth.

---

# Accepted ungated foundation

Keep the useful direction from:

- `ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080`
- `118b2a8e2f1d9dcc2d37a322e6134868372cb06b`

Specifically preserve:

- no fixture enquiries/bookings/knowledge/integrations in a live new tenant;
- all action policies starting at `Ask every time`;
- the per-user transaction advisory lock/re-check for creation-once concurrency.

These commits are foundation, not R2A sign-off.

---

# Product decision — onboarding owns initial business creation

Do not auto-create a placeholder business merely because the user fetches the workspace.

Preferred first-beta flow:

> authenticated user  
> → fetch workspace  
> → zero memberships is a valid state  
> → route/lead to onboarding  
> → onboarding completion creates the initial business + owner membership atomically  
> → operator workspace loads

This is cleaner than persisting orphan `Your business` tenants before the person completes setup.

If implementation has a materially better reason to retain a placeholder row, stop and flag it before changing this product decision.

---

# 1. Workspace fetch with zero membership

`fetchWorkspace` must not silently provision tenant content.

For a verified user with no `business_member` rows:

- return an explicit empty/new-account result;
- no fixture/sample data;
- no database business row created just by viewing/loading;
- UI can deliberately route to `/onboarding`.

Do not treat zero businesses as a server error.

---

# 2. Persisted onboarding completion

On final onboarding submit, one tenancy-checked server operation creates the initial workspace.

Minimum persisted business profile:

- business name;
- owner/display first name needed for voice/sign-off;
- business/service type or plain-language industry context;
- base location/city/free-text location where useful;
- timezone;
- solo vs team;
- currency for the current beta market if the domain requires it;
- initial safe trust state.

Avoid collecting data merely because the schema has a column.

### Timezone

Do not limit the architecture to a hard-coded Australian city map.

A browser-detected IANA timezone may be offered as a default.

The user can confirm/change it.

### Location

Free-text base location is sufficient for R2A.

Do not build geocoding here.

---

# 3. Safe default trust/action state

A new tenant has **zero automation evidence**.

Required:

- every action policy starts `Ask every time` unless the action is deliberately `Never`;
- no synthetic comparable-count evidence;
- no fixture automation history;
- no action becomes automatic because a fixture business had it enabled.

Default global trust posture must be conservative and compatible with review-first beta.

Do not use synthetic demo evidence to graduate autonomy.

---

# 4. Product-owned action-policy catalogue

Current partial provisioning derives the action-policy catalogue by importing fixture `BUSINESSES`.

Fix this direction.

Action classes/labels/risk are product definitions, so place them in a domain/product-owned canonical catalogue.

Then:

- live provisioning uses the product catalogue;
- fixtures may reuse/override that catalogue for demos;
- production server code does not depend on fixture businesses to know which actions exist.

Do not create a database-admin workflow-builder.

---

# 5. No fake integrations

Onboarding currently contains choices such as:

- email;
- SMS;
- Instagram;
- Facebook;
- website/source options.

R2A must not translate a selection/preference into:

`integration.status = "connected"`

unless an actual provider handshake has happened.

For first beta:

- manual/private paste is allowed;
- future channel interest can be recorded as a preference/research field if useful;
- unsupported integrations remain not connected/coming later;
- do not create fake scopes/account labels.

---

# 6. Business Brain onboarding boundary

R2A establishes the real tenant/profile.

Do **not** pretend the full Business Brain has been learned merely because onboarding completed.

If the current onboarding screens show sample rules/prices:

- remove them from the live path; or
- isolate them as an explicitly labelled explanation/example that cannot be confirmed into the tenant.

Actual machine-usable Business Brain rule persistence is gated in R2C.

R2A may collect simple plain-language starter context if it is persisted honestly as proposed/unverified context, not active price/capacity truth.

---

# 7. Demo/sample path

`/demo` remains the fixture world.

If a signed-in user wants to see sample work:

- open/navigate to the isolated demo;
- do not replace their tenant arrays;
- do not write sample records into their tenant;
- returning to the app returns to their real workspace.

Normal Account/Settings menus must not offer a "Reset prototype" action that can affect live data.

The detailed UI cutover is R2B, but R2A must not introduce new live/sample mixing.

---

# 8. Concurrency/idempotency

Initial workspace creation must be safe under:

- double click;
- browser retry;
- two tabs;
- two concurrent first-submit requests.

Preserve the transaction lock/re-check pattern from `118b2a8...` or an equally strong design.

Important:

- future users may legitimately belong to multiple businesses;
- do not enforce a global one-business-per-user schema constraint simply to make initial onboarding idempotent.

The initial-creation operation should return the existing initial business if another concurrent request won the race.

---

# 9. Failure behaviour

If onboarding creation fails:

- do not mark client onboarding complete;
- do not redirect to an operator workspace that does not exist;
- show a retryable error;
- transaction must not leave a business without membership or half-created policy catalogue.

No optimistic client-only success.

---

# 10. Tests

Add focused tests for product logic and, where DB integration tests are available, the real transaction path.

At minimum:

### New account
- zero membership returns empty/new-account state;
- fetching does not create a business.

### Create
- one submit creates business + owner membership + safe policy catalogue;
- no enquiry/booking/knowledge/integration fixture rows created;
- profile fields round-trip.

### Concurrency
- concurrent first creation produces one initial business;
- loser returns same business.

### Existing member
- onboarding-create cannot silently create a second initial workspace for a user who already has one.

### Trust
- every default action is non-automatic;
- zero synthetic evidence.

### Demo isolation
- fixture data remains available to demo tests;
- live onboarding does not import it.

---

# Acceptance

- [ ] Zero-membership user is a valid deliberate onboarding state.
- [ ] Workspace fetch does not auto-create a placeholder tenant.
- [ ] Onboarding completion persists a real business and owner membership.
- [ ] Actual user-entered profile survives reload.
- [ ] No F01-F20/sample bookings/fixture knowledge leak into tenant.
- [ ] No integration is falsely marked connected.
- [ ] Action-policy catalogue comes from product/domain definitions, not fixture businesses.
- [ ] All actions start conservatively.
- [ ] Concurrent first creation is genuinely idempotent.
- [ ] Another tenant cannot access the created workspace.
- [ ] `/demo` remains isolated.
- [ ] Typecheck/full test suite/build pass or unchanged classified baseline is reported per policy.
- [ ] No R2B read-store cutover, R2C Brain-rule work or R2E AI ingestion is pulled into this slice.

---

# Handoff

Report:

1. bootstrap architecture chosen;
2. what happens for zero memberships;
3. persisted fields;
4. action-policy catalogue location;
5. concurrency mechanism;
6. demo/live isolation;
7. integration truthfulness;
8. files/migrations changed;
9. focused DB/tests;
10. full tests/typecheck/build;
11. any contradiction.

Then stop.
