# Auth deployment contract

What each environment must set for a confirmation link to reach a customer and
come back to the right place. Written for R2A Slice 1.

## The rule

> The auth return origin is owned by the deployment, not by whichever browser
> happened to make the request.

`window.location.origin` was that browser. A signup requested from a laptop on
`http://localhost:8080` produced `emailRedirectTo=http://localhost:8080/...`,
which is a dead link in the recipient's inbox - and when Supabase rejects a
redirect that is not on its allow list it silently substitutes the project's
Site URL, so the failure never surfaces as a failure.

`src/lib/auth/origin.ts` therefore resolves the origin, and **production fails
closed**. A thrown configuration error at the send button is recoverable; an
inbox full of localhost links is not.

## Environment variables

| Variable | Production | Development |
|---|---|---|
| `VITE_PUBLIC_APP_ORIGIN` | **Required.** Bare HTTPS origin, no path/query/fragment. Rejected if loopback. | Optional. Falls back to `window.location.origin`; loopback and plain HTTP allowed. |

Production is `import.meta.env.PROD`. With no value set, sign-in throws
`VITE_PUBLIC_APP_ORIGIN is not set, so this deployment has no public origin to
send confirmation links back to.` rather than mailing an unreachable link.

### Set on Vercel (done)

```
VITE_PUBLIC_APP_ORIGIN = https://enquiry-ashy.vercel.app     (Production)
```

Set 2026-09-02. **No deployment was made** - the value is staged for whichever
deploy product management authorises next. Until that deploy, production still
runs the previous browser-derived behaviour.

If the public URL changes, this variable and the Supabase allow list below must
change together, in that order.

## Return URL shape

Every email and OAuth return lands on exactly one route:

```
<VITE_PUBLIC_APP_ORIGIN>/auth/complete?redirect=<validated in-app path>
```

`/auth/complete` is the only destination because that keeps the Supabase allow
list a short exact list rather than a wildcard, and gives one place that can
honestly report whether the link worked. The `redirect` value is re-validated by
`safeReturnPath` as it becomes a real URL, so a poisoned `?redirect=` cannot
move the host.

## Hosted Supabase changes still required

**Not applied.** The brief forbids altering hosted Supabase settings in this
lane, so these are stated for product management to apply.

Project `qzzvxfbitixpmfuirvhq` (growlocal) → Authentication → URL Configuration:

| Setting | Value |
|---|---|
| Site URL | `https://enquiry-ashy.vercel.app` |
| Redirect URL | `https://enquiry-ashy.vercel.app/auth/complete` |
| Redirect URL (dev only) | `http://localhost:8080/auth/complete` |
| Redirect URL (dev only) | `http://127.0.0.1:8080/auth/complete` |

Rules for that list:

- **No wildcard** that covers hosts this project does not own. A pattern such as
  `https://*.vercel.app/**` would let any Vercel deployment receive a
  confirmation link for an Enquiry account.
- Preview deployments are **not** covered. Each preview gets a fresh generated
  hostname, so allow-listing them means a wildcard, and the wildcard is the
  thing worth refusing. Previews should point `VITE_PUBLIC_APP_ORIGIN` at the
  production origin, or accept that sign-in does not work in a preview.
- The local entries exist only so a developer can complete their own sign-in.
  They are safe because they are exact and loopback-only.

**This is unverified.** The allow list is not readable through the management
API available here, so the current values were not inspected. Confirm them in
the dashboard before trusting sign-in on a new deploy.

## Email delivery

Still the Supabase built-in SMTP, which is documented as testing-only and rate
limited to a couple of messages per hour. Custom SMTP with a dedicated
authentication sender, SPF, DKIM and DMARC, and provider link tracking disabled,
is required before public beta. That is Slice 3's external dependency and is
**not** done.

## Verification

`src/lib/auth/origin.test.ts` (13 tests) covers the rules above, including:

- production never falls back to the browser origin;
- production rejects `localhost`, `.localhost`, the whole `127.0.0.0/8` block,
  `[::1]` and `0.0.0.0`;
- production rejects a non-HTTPS origin;
- no production return URL can contain a loopback host;
- an unsafe return path cannot change the host of the return URL;
- a misconfigured production deployment throws instead of mailing a dead link.
