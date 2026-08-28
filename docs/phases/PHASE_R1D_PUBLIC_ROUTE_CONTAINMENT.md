# R1D — Public Customer Route Containment

**Status:** PREPARED — NOT AUTHORISED UNTIL R1C1 IS REVIEWED

**Execution authority:** `docs/CURRENT_PHASE.md`.

This brief turns the R1D section of `PHASE_R1_RELEASE_BLOCKER_STABILISATION.md` into one bounded implementation slice.

---

# Verified current state

The public routes:

- `/q/$enquiryId`
- `/book/$bookingId`

currently:

- accept internal fixture IDs such as `f01` / `b1`;
- read from `usePrototype`;
- mutate prototype quote/booking state;
- label themselves "no account required".

This is useful as a fixture/demo interaction.

It is **not** an acceptable production public-link authorisation model.

R1D must contain it rather than invent a fake client-side token system.

---

# Objective

Make the public quote/booking fixture flows impossible to confuse with production customer access.

The safe current product rule is:

> **Public no-account customer quote/booking links do not exist in the live product yet. Fixture customer routes may exist only as explicitly demo/sample behaviour.**

---

# Required design

## 1. Hard isolate fixture customer routes from live tenant data

The two routes must never load or mutate signed-in tenant state.

Preferred direction:

- resolve only known fixture/sample records from explicitly fixture-owned data;
- do not use the live operator store/server workspace as fallback;
- do not inspect tenant UUIDs;
- do not expose a route that later starts resolving real enquiries merely because the parameter happens to match.

If retaining a small dedicated demo store is necessary for interactive demo behaviour, it must be clearly separate from live operator state.

## 2. Production-capable public deployments fail closed

Outside the explicit demo/sample condition, these routes must render an unavailable/not-supported state or not resolve at all.

Do not infer "safe demo" merely because:

- auth is signed out;
- the ID looks like a UUID;
- the route is client-side;
- the caller knows an enquiry ID.

An explicit product/demo condition is required.

## 3. No fake capability-token fix

Do not:

- rename `$enquiryId` to `$token` while shipping the value in client fixtures;
- replace `f01` with a random-looking constant compiled into the bundle;
- use obscurity as authorisation;
- claim secure public customer links exist.

## 4. Copy must be truthful

If the fixture customer route is shown in demo/local mode, label it as sample/demo/prototype context where needed.

Do not imply:

- a real payment was collected;
- a real booking provider was called;
- a real external customer received the page.

The current simulated-payment wording may remain where it is clearly a demo.

## 5. Preserve the public product proof

`/demo` must continue to be the canonical public no-account Enquiry proof.

R1D must not make prospects sign in simply to understand the product.

---

# Tests required

Add deterministic tests around the route-access decision/helper rather than relying only on manual navigation.

At minimum prove:

### Allowed fixture/demo context
- known fixture quote path can render its sample;
- known fixture booking path can render its sample if the demo deliberately includes it;
- unknown fixture ID does not fall through to another record.

### Production/live context
- `/q/f01` does not expose the fixture as if it were a live customer quote;
- `/book/b1` does not expose the fixture as if it were a live customer booking;
- a real-looking UUID cannot make the route query tenant data;
- no public mutation touches live tenant state.

---

# Acceptance

- [ ] Public short/internal IDs are not an authorisation mechanism.
- [ ] Fixture customer routes are explicitly demo/sample only.
- [ ] Live tenant data is not read by these routes.
- [ ] Live tenant state is not mutated by these routes.
- [ ] Production-capable public behaviour fails closed.
- [ ] `/demo` remains usable without auth.
- [ ] No client-bundled pseudo-token workaround.
- [ ] Public prototype/payment copy remains truthful.
- [ ] Typecheck passes.
- [ ] Full default test suite runs and baseline failures are classified.
- [ ] Production build passes.
- [ ] No R2/operator cutover work begins in this slice.

Then stop.

---

# Later, only if evidence requires it

A real public no-account customer-link feature is a separate future decision.

It would require a server-backed capability model including:

- high-entropy token generated server-side;
- server-side mapping to object/action;
- protected token storage (for example hash-at-rest where appropriate);
- expiration/revocation;
- minimal public projection;
- validation on every read/mutation;
- no internal ID acting as authorisation.

That system is explicitly **not R1D**.
