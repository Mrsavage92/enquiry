# R1 Final — Release Stabilisation + 9A Runtime Gate

**Status:** PREPARED — NOT AUTHORISED UNTIL R1D IS REVIEWED

**Execution authority:** `docs/CURRENT_PHASE.md`.

This is a verification/review gate, not a feature phase.

Its purpose is to prove that the current release/security corrections coexist safely and that the already-accepted Phase 9A visual direction still works in the real runtime.

---

# Preconditions

Before this gate begins:

- R1A signed off;
- R1B code remediation accepted;
- external preview credential rotation/revocation confirmed;
- R1C + R1C1 signed off;
- R1D signed off.

If credential rotation is still unconfirmed, R1 remains **operationally open for public traffic** even if all repository checks pass. That external blocker does not need to idle unrelated R2 engineering once the repository/runtime gate itself is clean.

---

# 1. Toolchain and test truth

Run and record:

- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- `npm run build:dev`;
- `npm run preview` smoke;
- `npm run dev` start/stop smoke;
- `npm run lint`.

For tests:

- report exact discovered test-file count;
- report pass/fail counts;
- classify every remaining failure using `docs/TEST_REGRESSION_POLICY.md`;
- do not hide/skip a failing platform test merely to make the suite green.

Known platform/PWA harness failures may remain only if they are reproduced/classified as pre-existing and do not invalidate the beta/public path.

Do not turn this gate into an unrelated lint cleanup.

---

# 2. Authentication matrix

Verify at minimum:

### Auth configured + signed out
- marketing pages public;
- `/demo` public;
- `/early-access` public;
- operator routes redirect/lead to sign-in;
- onboarding not accessible as an operator surface.

### Auth configured + session pending
- no signed-out flash;
- no redirect loop.

### Auth configured + signed in
- operator routes load;
- already-signed-in `/login` does not strand the user;
- safe internal redirect path returns correctly.

### Return-path abuse
- protocol-relative;
- backslash authority;
- absolute external URL;
- scheme URL;
- encoded equivalent

all fail to create a cross-origin post-auth destination.

### Auth disabled
- disposable local prototype mode remains deliberate;
- if a real `DATABASE_URL` is present, server data access fails closed rather than using shared `dev-user`.

---

# 3. Public-route containment

Verify:

- `/demo` remains a useful no-login fixture proof;
- `/q/$enquiryId` and `/book/$bookingId` cannot expose/mutate live tenant data;
- production-capable public behaviour fails closed for internal fixture/customer IDs;
- demo/local fixture mode is explicitly isolated;
- no fake client-side capability token exists.

---

# 4. Data boundary smoke

The R2 cutover is not active yet, but the already-landed database foundation must not introduce a release/security regression.

Verify:

- product migrations apply cleanly to a fresh development database;
- RLS lockdown remains present on Enquiry tables;
- server tenancy helpers reject a second user for a business/enquiry/booking they do not own;
- no public browser code queries Enquiry product tables directly;
- auth tokens are verified server-side before product-server access.

Do **not** call the operator product persisted merely because these foundations pass.

---

# 5. Phase 9A runtime/visual verification

Re-run Phase 9A QA against the current runtime:

### Desktop
- homepage hierarchy;
- waitlist conversion surface;
- Ridge signature proof;
- nav/footer;
- no auth/security correction changes public product truth.

### Phone
- hero and CTA hierarchy;
- Ridge proof readable;
- waitlist usable;
- no overflow/clipped controls.

### Reduced motion
- content remains understandable;
- no motion is required to reveal decision information.

### Visual identity
Confirm:

- paper/ink identity intact;
- restrained mark accent;
- serif/editorial hierarchy;
- no generic purple/blue AI gradients;
- no glow/orb/sparkle/robot clichés.

If these pass, Phase 9A receives final sign-off.

---

# 6. Public product-truth check

Verify the public site still does **not** imply:

- live Gmail/Microsoft integration if absent;
- live Instagram/Facebook/SMS integration if absent;
- secure public customer quote links if absent;
- production payment collection if simulated;
- a general CRM/FSM;
- installability before Phase 10A.

Review the phrase "Building with service businesses" against the actual external-cohort evidence at the time. If there is no real external cohort yet, narrow the wording rather than implying evidence that does not exist.

---

# 7. Gate outcome

There are two distinct outcomes.

## A. Repository/runtime gate passes; credential rotation still pending

Product management may record:

> **R1 REPOSITORY STABILISATION PASSED — EXTERNAL ROTATION PENDING**

and, if visual QA passes:

> **PHASE 9A RUNTIME/VISUAL SIGN-OFF PASSED**

R2A may proceed because the obsolete broker credential is not part of the new product runtime.

However:

> **Do not deliberately send public market traffic or call R1 operationally closed until the external credential is revoked/rotated.**

## B. Repository/runtime gate passes; credential rotation confirmed

Product management may record:

> **R1 RELEASE STABILISATION PASSED**

and:

> **PHASE 9A FINALLY SIGNED OFF**

Audience/waitlist traffic may begin.

In either case, the next productisation work is R2A, not speculative integration work.

---

# Handoff

Report:

1. exact commands and outcomes;
2. exact test discovery/pass/fail counts;
3. remaining classified baseline failures;
4. auth-state QA;
5. return-path security QA;
6. public customer-route containment QA;
7. tenancy/RLS smoke;
8. desktop/phone/reduced-motion 9A QA;
9. external credential rotation status;
10. whether R1 + 9A can be signed off.

Then stop.
