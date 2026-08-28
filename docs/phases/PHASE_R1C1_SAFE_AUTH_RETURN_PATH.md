# R1C1 — Same-origin auth return-path correction

**Status:** PREPARED FOR ACTIVE EXECUTION

**Execution authority:** `docs/CURRENT_PHASE.md`.

This is a narrow correction discovered during product-management review of the already-landed R1C auth work in commit:

`e62c64be034069505623b85d58938578f14984c0`

R1C's overall direction is accepted: Supabase Auth replaced the old Better Auth/broker path, `/_app` and `/onboarding` are guarded, pending/signed-out/signed-in states are distinct, and server functions verify a bearer token rather than trusting a client user id.

However, the return-path validation is not yet safe enough to sign R1C off.

---

## Verified issue

`src/routes/login.tsx` currently accepts a redirect when:

```ts
typeof search.redirect === "string" && search.redirect.startsWith("/")
```

The comment calls this a same-origin path, but values such as:

```text
//example.invalid/path
/\example.invalid/path
```

can be interpreted as an authority/host-changing URL by URL parsers.

`src/lib/auth/client.ts` later constructs OAuth/magic-link return URLs with:

```ts
new URL(opts.redirectTo ?? "/enquiries", window.location.origin)
```

Therefore "starts with slash" is not the security invariant we actually need.

This must be fixed before R1C is signed off.

---

# Objective

Create one explicit, tested return-path invariant:

> A post-auth return target may preserve an in-app path/query/hash, but it must never resolve to a different origin, scheme or host.

Do not broaden auth scope.

---

# Required behaviour

Create/use one small pure helper for post-auth paths.

The helper should:

- accept normal app-relative absolute paths such as:
  - `/enquiries`
  - `/enquiries/abc?tab=why`
  - `/business#pricing`
- reject:
  - protocol-relative URLs such as `//evil.example`;
  - absolute `http://` or `https://` URLs;
  - `javascript:`, `data:` or other schemes;
  - backslash/authority tricks that URL parsing could normalize to another host;
  - malformed values;
  - empty/non-string values where relevant.
- fall back to `/enquiries` or the caller's deliberate default.

Use the same invariant in both places that matter:

1. login search/return-path handling;
2. auth redirect URL construction.

Do not rely on the Supabase redirect allowlist as the primary protection.

---

# Tests required

Add deterministic tests for at least:

### Allowed
- `/enquiries`
- `/enquiries/f01?tab=why`
- `/business#pricing`

### Rejected
- `//evil.example`
- `/\\evil.example`
- `https://evil.example`
- `javascript:alert(1)`
- an encoded value that decodes to a protocol-relative/backslash host-changing form
- empty/invalid input

Prove that every accepted path resolves against a normal application origin without changing `.origin`.

---

# Acceptance

- [ ] One tested helper defines the return-path rule.
- [ ] `/login?redirect=...` cannot create a cross-origin auth return target.
- [ ] Magic-link and OAuth redirect construction use the same safe rule.
- [ ] Normal in-app path/query/hash return behaviour still works.
- [ ] Already-signed-in visitor still leaves `/login` correctly.
- [ ] Pending auth still does not flash/redirect early.
- [ ] Typecheck passes.
- [ ] Full default test suite runs; baseline failures are classified per `docs/TEST_REGRESSION_POLICY.md`.
- [ ] Production build passes.
- [ ] No unrelated auth redesign.

Then stop.

Do **not** begin R1D or persisted-operator cutover work until product management reviews this correction.
