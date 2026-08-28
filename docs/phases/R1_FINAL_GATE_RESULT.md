# R1 Final Gate - verification result

**Run:** 2026-08-28, by the implementation agent.
**Verdict:** repository checks PASS. **Gate remains operationally open on one external item.**

Precondition not met: external preview-credential rotation is **still pending**. Per
`PHASE_R1_FINAL_STABILISATION_GATE.md`, final R1 stays open even when every repository
check passes. Nothing in this repository can prove a credential was revoked at the
broker, and this file does not claim otherwise.

---

## 1. Toolchain and test truth

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` | PASS, exit 0 |
| `npm run build:dev` | PASS, exit 0 |
| `npm run dev` | PASS - Vite ready in ~4.5s, stopped cleanly |
| `npm run preview` | PASS - served and answered on 8081 |
| `npm run lint` | 10 problems (1 error, 9 warnings) |

**Tests: 27 files discovered, 295 tests, 283 pass, 12 fail, 0 skipped, 0 todo.**

Discovery finds the whole repository suite, including all 10 `src/domain` tests and
every `src/lib` test that the old hard-coded command never ran.

### Failure classification (per TEST_REGRESSION_POLICY.md)

All 12 are pre-existing platform-harness failures in 3 files. Root cause was
established by experiment, not assertion.

**Group A - 4 failures, missing gitignored workspace file.**
`scripts/with-app-env.test.mjs` (3), `scripts/check-auth-invariant.test.mjs` (1).
These assert the merged value of `VITE_AUTH_ENABLED` from `.grok/app-env.json`, which
is gitignored and absent from a clean checkout. Proven: creating
`.grok/app-env.json` with `{"VITE_AUTH_ENABLED":"false"}` takes those two files from
24/28 to **28/28**. Environment, not code. No product path involved.

**Group B - 8 failures, Grok PWA harness asserts the scaffold's placeholder name.**
`scripts/grok-pwa-plugin.test.mjs`. The tests assert the head injector emits
`"Wild Race"`, the Grok template's placeholder app identity. The injector correctly
emits `"Enquiry"`, read from `src/lib/og/site.json`. Proven: these 8 still fail with
the workspace file present, so they are a separate cause. The app was renamed in
Phase 1 (`1c0f2c6`), long before any R1 work. Pre-existing; does not invalidate the
beta or public path.

**Regressions introduced by R1: none.** Failing-test sets were diffed against the
`7cd1ee4` baseline with timings stripped. Failure count went 13 -> 12: one
`migration-plan` test was already red at R1A for an unrelated reason and now
describes reality rather than a deleted file.

### Lint

Baseline at `7cd1ee4` was 11 problems (1 error, 10 warnings); now 10 problems
(1 error, 9 warnings). The single remaining error is the pre-existing `no-empty` in
`src/lib/app-data/client.server.ts:214`, which the R1 plan explicitly says not to
broaden into - its fallback-to-token-hash behaviour is intentional.

One lint regression WAS introduced and fixed inside this gate: R1D's containment
early-returned before the hooks, making every later hook conditional (16 errors).
Fixed by selecting the component at the route boundary instead, which is also
stronger containment - the gated component never mounts.

---

## 2. Authentication matrix

| Case | Result |
| --- | --- |
| Marketing, `/demo`, `/early-access`, `/roadmap`, `/updates`, `/privacy`, `/terms`, `/login` public | PASS - zero guard references |
| Operator routes require sign-in | PASS - `RequireAuth` on the `/_app` layout |
| `/onboarding` protected | PASS - guarded separately, it configures workspace state |
| Session pending: no flash, no loop | PASS - the guard renders nothing while pending and never redirects |
| Already signed in at `/login` | PASS - navigates to the validated destination instead of stranding |
| Auth disabled prototype mode | PASS - `DEV_USER`, never pends |
| Auth off + real `DATABASE_URL` | PASS - fails closed. `resolveAccessMode` returns `refuse`; all four combinations tested |

### Return-path abuse - 10/10

Every vector the brief named fails to create a cross-origin destination:
protocol-relative (`//evil.example`), backslash authority (`/\evil.example`),
absolute external (`https://evil.example`), scheme (`javascript:`, `data:`), encoded
equivalents (`/%2F%2Fevil.example`, `/%5Cevil.example`), malformed escapes, empty and
non-string. A sweep asserts no accepted value moves `.origin`. The rule is applied at
both the `/login` search param and the magic-link/OAuth redirect construction; the
Supabase allowlist is a second layer, not the first.

---

## 3. Public-route containment - verified against a running server

Not read from the diff. Built, served with `vite preview`, and requested:

| Route | Bytes | Unavailable screen | Customer names leaked | Money figures leaked |
| --- | --- | --- | --- | --- |
| `/q/f01` | 5255 | yes | none | none |
| `/q/f02` | 5255 | yes | none | none |
| `/book/b1` | 5165 | yes | none | none |
| `/demo` | 13255 | n/a - still a working fixture proof | (intended) | (intended) |

Gate logic: exactly one of four input combinations opens the link, asserted. No
client-bundled string is presented as a capability token and the copy makes no
security claim.

---

## 4. Data boundary

- Product migrations apply cleanly to a fresh database: 18 tables, 44 indexes,
  16 foreign keys, 185 check constraints.
- RLS lockdown present on all 18 Enquiry tables.
- Tenancy helpers reject a non-member: verified live with a second tenant inserted -
  table held 2 enquiries, the first user's `loadWorkspace` shape returned 1, and the
  `requireEnquiryAccess` join returned 0 rows cross-tenant.
- All 6 server functions run `authMiddleware`; none accepts an unchecked user or
  business id.
- **No browser code touches product tables.** The 65-file, 1.3MB client bundle
  contains no `connectionString` or `pg.Pool`, no PGLite, no SQL against product
  tables, and no `DATABASE_URL`.
- Tokens are verified server-side via Supabase `getUser()` before any product access -
  never decoded and trusted locally.

The operator product is **not** persisted yet. These foundations passing does not make
it so; the store remains the runtime authority until R2.

---

## 5. External credential rotation

**STILL PENDING.**

The literal is gone from HEAD and absent from the built client bundle (checked). It
remains in git history, so only revocation at the broker closes R1B. This gate cannot
and does not assert otherwise.

---

## Outstanding, carried forward

1. Broker credential rotation - the only thing blocking final R1 closure.
2. Phase 9A desktop/phone/reduced-motion visual QA - requires a human or a browser
   session against the running app; not something this agent can honestly self-certify
   from static checks.
3. Public claim/truth check - same: needs product-management judgement on copy.
