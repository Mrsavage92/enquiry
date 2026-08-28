# Enquiry - Public Traffic Readiness Gate

**Status:** OPEN — blocks deliberate market traffic, not R2 engineering.

This gate is narrower than `docs/BETA_READINESS_GATE.md`.

Passing it means:

> the public Enquiry website/demo/waitlist is safe and truthful enough to deliberately send prospects into.

It does **not** mean the signed-in operator product is ready for external beta use.

---

# 1. External credential containment

Required before deliberate traffic:

- [ ] The historically committed Grok preview/broker OAuth credential has been revoked or rotated at the issuing broker/environment.
- [x] The old credential is absent from HEAD/current client build.
- [x] The old broker auth path is no longer used by Enquiry.

Repository deletion is not evidence of external revocation.

---

# 2. Phase 9A visual runtime QA

The visual direction is already source-reviewed and accepted.

Still required with a real browser/human session:

- [ ] desktop homepage;
- [ ] phone homepage;
- [ ] Ridge proof readable/strong;
- [ ] waitlist obvious and usable;
- [ ] reduced-motion behaviour;
- [ ] no overflow/clipped controls;
- [ ] paper/ink identity still intact after R1 auth/security work.

This does not block R2 backend engineering.

---

# 3. Public claim truth

Before traffic, remove any implication that an external service-business cohort already exists unless that is actually true.

Current homepage wording includes:

> **Building with service businesses.**

and:

> **We’re building with service businesses — makeup, photography, painting, consulting — ...**

Until independent external businesses are genuinely participating, use a truthful form such as:

> **Built for service businesses.**

and:

> **We’re building for service businesses — makeup, photography, painting, consulting — ...**

The exact composition can be polished later; the truth boundary is the gate.

Once real external beta participation exists, stronger "building with" language may be earned.

---

# 4. Public/operator separation

Already verified in R1, but preserve:

- [x] `/demo` is public.
- [x] `/early-access` is public.
- [x] operator routes require auth.
- [x] short-ID `/q` and `/book` fixture customer routes fail closed in auth-capable deployments.
- [ ] marketing CTAs do not unexpectedly promise a public operator/customer flow that no longer exists after R2 changes.

If "Open app" lands on sign-in, that is acceptable when it is clearly an existing-user path. Prospects still need a safe "See demo" route.

---

# 5. Waitlist

Before deliberate traffic:

- [ ] email signup manually smoke-tested in the deployed target environment;
- [ ] optional qualification smoke-tested;
- [ ] attribution still records source/content;
- [ ] privacy/terms links resolve;
- [ ] no public waitlist read/list endpoint.

---

# 6. Public capability claims

Verify public copy does not claim live production support for:

- Gmail/Microsoft;
- Instagram/Facebook;
- SMS;
- calendar/booking;
- payment;
- public customer quote links;
- installable PWA before Phase 10A.

Fixtures/demos can show the concept only when clearly not presented as a live integration claim.

---

# Gate result

When all required items are evidenced, product management may record:

> **PUBLIC TRAFFIC GATE PASSED**

Then the founder-led audience/waitlist programme can begin while R2 continues.

External businesses must still wait for `docs/BETA_READINESS_GATE.md` before using the operator product on real enquiries.
