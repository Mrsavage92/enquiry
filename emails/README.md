# Enquiry authentication email

## Hosted magic-link template

- Project: `qzzvxfbitixpmfuirvhq` (growlocal).
- Dashboard: Authentication > Email > Magic link or OTP.
- Subject: `Your Enquiry sign-in link`.
- Body: [`magic-link.html`](magic-link.html).
- Applied and verified after dashboard reload: 2026-09-14.

This is a self-contained HTML email, not an application component or generated
image. It uses system fonts, inline table layouts, Outlook fallbacks and optional
mobile/dark-mode styles. Clients that strip the optional CSS retain the inline
light layout. Both links must remain `{{ .ConfirmationURL }}`.

To update the hosted template, replace the entire editor contents, preview both
light and dark modes, save, then reload and verify. Monaco's textbox fill can
append instead of replacing the model: select all and replace the full contents.
A git merge or Vercel deploy does not apply this hosted setting.

Run `node --test scripts/auth-email-template.test.mjs` before publishing changes.
These checks preserve verification links and basic email constraints; they are
not an inbox-client rendering or completed sign-in test.

## Verification and remaining work

The saved template was visually checked in Supabase's preview. Evidence is in
[`docs/evidence/auth-email-repair-2026-09-14`](../docs/evidence/auth-email-repair-2026-09-14).
The production form accepted one fresh sign-in request after the hosted URL
configuration and template were saved. Inbox delivery, Outlook rendering and
the resulting authenticated production session still need confirmation.

Supabase's default sending service remains enabled. A verified sending domain
and custom SMTP provider are required for reliable public production email,
an Enquiry sender identity and control over provider-added footer content.
No SMTP credentials, DNS records, mail security settings or auth safeguards
were changed in this repair. The reported link-opening delay is not yet proven
resolved.

## Product email (sent by the app, not by Supabase)

The waitlist welcome is sent by the application, not from a hosted Supabase
template, so it is versioned as code rather than as a static file here:

- Builder: [`src/lib/email/waitlist-welcome.ts`](../src/lib/email/waitlist-welcome.ts)
- Transport: [`src/lib/email/send.server.ts`](../src/lib/email/send.server.ts)
- Tests: `node --experimental-strip-types --import ./scripts/test-resolve-hook.mjs --test src/lib/email/waitlist-welcome.test.ts`

It fires once, on a genuinely new waitlist row, from `joinWaitlist`. A repeat
submit of an address already on the list sends nothing.

### Required environment (Vercel, production)

| Variable | Example | Effect when missing |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_...` | No email is sent. A `[email] skipped` line is logged. Signup still succeeds. |
| `EMAIL_FROM` | `Enquiry <hello@yourdomain>` | Same as above. Both are required before anything sends. |

Sending is deliberately inert until both are set, so this can deploy before the
mailbox exists. Use the same verified domain for this and for the Supabase Auth
custom SMTP sender, so a person who joins the list and a person who signs in see
the same sender identity.

Replies go to the address in [`src/lib/site/contact.ts`](../src/lib/site/contact.ts).
Point that at the new mailbox once the domain is verified.
