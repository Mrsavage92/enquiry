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

| Variable                 | Production                                                                     | Development                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `VITE_PUBLIC_APP_ORIGIN` | **Required.** Bare HTTPS origin, no path/query/fragment. Rejected if loopback. | Optional. Falls back to `window.location.origin`; loopback and plain HTTP allowed. |

Production is `import.meta.env.PROD`. With no value set, sign-in throws
`VITE_PUBLIC_APP_ORIGIN is not set, so this deployment has no public origin to
send confirmation links back to.` rather than mailing an unreachable link.

### Production origin

```
VITE_PUBLIC_APP_ORIGIN = https://enquiry-ashy.vercel.app     (Production)
```

The application has since been deployed through PR #25 (merge `1a855ba`).
On 2026-09-14, the production login accepted a fresh sign-in email request
after the hosted Supabase correction below. This is not evidence of inbox
delivery or a completed authenticated session; those require the fresh email.

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

## Hosted Supabase configuration

**Applied and reloaded for verification on 2026-09-14**, under the owner's
explicit production-login repair instruction. Before the repair, the live
Site URL was `http://localhost:3000` and the redirect allow-list was empty.
That explains the reported localhost fallback despite a deployed application.

Project `qzzvxfbitixpmfuirvhq` (growlocal) → Authentication → URL Configuration:

| Setting      | Value                                           |
| ------------ | ----------------------------------------------- |
| Site URL     | `https://enquiry-ashy.vercel.app`               |
| Redirect URL | `https://enquiry-ashy.vercel.app/auth/complete` |

Rules for that list:

- **No wildcard** that covers hosts this project does not own. A pattern such as
  `https://*.vercel.app/**` would let any Vercel deployment receive a
  confirmation link for an Enquiry account.
- Preview deployments are **not** covered. Each preview gets a fresh generated
  hostname, so allow-listing them means a wildcard, and the wildcard is the
  thing worth refusing. Previews should point `VITE_PUBLIC_APP_ORIGIN` at the
  production origin, or accept that sign-in does not work in a preview.
- No local development entries were added during this production repair.
  Development authentication needs separately approved, exact callback entries.

The Site URL and exact callback entry were verified in the signed-in dashboard
after reload. Supabase also accepts redirects matching the Site URL's hostname,
scheme and port, so the application's validated `?redirect=` query is supported.
See [Supabase redirect validation](https://github.com/supabase/auth/blob/master/internal/utilities/request.go)
and [saved configuration evidence](evidence/auth-email-repair-2026-09-14/supabase-url-configuration.png).
Verify hosted settings again whenever the production origin changes.

## Magic-link email

The hosted magic-link template was saved and verified after reload on
2026-09-14. Subject: **Your Enquiry sign-in link**. The body is versioned in
[`emails/magic-link.html`](../emails/magic-link.html); deployment instructions
and verification limits are in [`emails/README.md`](../emails/README.md).

Both actions retain Supabase's `{{ .ConfirmationURL }}`. The template does not
change token verification, expiry, session handling or account access controls.
Changing this file or deploying Vercel alone does not update hosted Supabase.

## Email delivery

Still the Supabase built-in SMTP, which is documented as testing-only and rate
limited to a couple of messages per hour. Custom SMTP with a dedicated
authentication sender, SPF, DKIM and DMARC, and provider link tracking disabled,
is required before public beta. That is Slice 3's external dependency and is
**not** done.

The branded template does not replace the default sender or guarantee removal
of a provider-appended footer. No SMTP credentials, DNS records or rate limits
were changed. See [Supabase's SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).

The owner's reported 30-60 second delay remains unverified after the repair.
The screenshot showed Outlook Safe Links, but that alone does not establish
the cause. Do not disable mail security or declare latency fixed without a
fresh completed sign-in.

## Verification

`src/lib/auth/origin.test.ts` (13 tests) covers the rules above, including:

- production never falls back to the browser origin;
- production rejects `localhost`, `.localhost`, the whole `127.0.0.0/8` block,
  `[::1]` and `0.0.0.0`;
- production rejects a non-HTTPS origin;
- no production return URL can contain a loopback host;
- an unsafe return path cannot change the host of the return URL;
- a misconfigured production deployment throws instead of mailing a dead link.
