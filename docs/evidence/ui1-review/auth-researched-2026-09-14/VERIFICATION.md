# Researched Entry Experience Verification

Date: 2026-09-14. Branch: `codex/ui1-auth-researched`. Base: `4ad5ba9d804975b8c1323277e0136db5feb068df`.

## Automated Checks

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- Final `npm test`: 747 passed, 0 failed, 145672.8433 ms. Includes an added regression test for supporting-text contrast on the actual auth shell and form colours.
- `VITE_AUTH_ENABLED=true npm run check:auth -- --dev-url http://127.0.0.1:8084`: pass, dev and build agree that sign-in is on. An initial check against the default 8080 port was indeterminate because this verification server uses 8084.
- `git diff --check`: pass.

## Browser Checks

The in-app browser exercised the real React routes at loopback port 8084. Email requests went to a disposable loopback HTTP fixture at port 8085, with no email delivery, account creation or session issuance. Early-access requests used the real server functions and a local in-memory PGLite database; `DATABASE_URL` was unset. No production signup, waitlist submission or test email was sent.

- Sign-in inspected at 320px phone, 768px tablet and 1440px desktop; signup and early access at 390px phone.
- Measured no horizontal overflow at 320, 768 and 1440px. Measured 48px primary button and 16px input type on the tablet form.
- Email-only entry, invited signup and early-access links have different labels and destinations.
- Signup fixture request reaches confirmation, focuses the heading and disables resend during cooldown.
- Sign-in can be submitted using Enter. A long email address wraps inside the 320px confirmation surface; heading focus is retained.
- Change-email action restores the field and returns focus to it.
- A fixture rate-limit response shows an alert and restores the request button; it does not claim a successful login.
- An expired callback shows recovery links; a callback without a session remains signed out and its recovery action returns to login.
- Local waitlist request reaches optional qualification. Select, checkbox and radio controls retain their selected values in the rendered UI. Saving details reaches confirmation; returning to the route retains the completed state.
- The native early-access disclosure reveals the existing offer conditions and invitation expectations.
- CSS reduced-motion rules disable the auth spinner and button/disclosure transitions. OS-level motion-preference emulation was not performed.

## Limits

This is entry-UI verification, not an owner-authentication or beta-readiness sign-off. Actual delivery to the owner's Hotmail inbox, successful use of that link, and hosted Supabase configuration remain separately unverified. No tenant logic, authentication decisions, provider configuration, database schema or paid-access entitlement rules were changed.

Production verification is recorded on the delivery pull request after deployment. Screenshots here are local UI evidence, not live customer data.
