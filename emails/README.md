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
