# Enquiry Entry Experience: Research and Decisions

Date: 2026-09-14. Scope: sign-in, invited signup, early-access request, confirmation and recovery. Adam requested research into real best-in-class entry pages after rejecting both the envelope and sample-product panel.

## Sources Inspected

The rendered official pages were inspected in the browser, including their form hierarchy and visible states. Observations are design references, not claims about Enquiry capabilities.

| Reference                                                                                                                                                                                                 | Observed pattern                                                                                                                                              | Enquiry application                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Linear login](https://linear.app/login)                                                                                                                                                                  | Narrow, focused entry flow; short heading; secondary account actions beneath the main action.                                                                 | One prominent email-link action. No parallel product story.                                                                      |
| [Tally signup](https://tally.so/signup)                                                                                                                                                                   | Visible email label, concise account-creation heading, clear sign-in link.                                                                                    | Distinct invited signup and sign-in language; visible labels on both.                                                            |
| [Vercel login](https://vercel.com/login) and [signup](https://vercel.com/signup)                                                                                                                          | Restrained form hierarchy, separate account paths and legal navigation.                                                                                       | Shared shell and predictable legal/account links.                                                                                |
| [Stripe login](https://dashboard.stripe.com/login)                                                                                                                                                        | Clearly framed white form, comfortable field proportions and ordered secondary actions.                                                                       | White form surface with subtle shadow and a solid lilac shell. Do not copy Stripe's multicolour background.                      |
| [Superhuman Docs beta announcement](https://connect.superhuman.com/t/docs-launch-beta-waitlist/60433) and [linked form](https://docs.superhuman.com/form/Join-the-waitlist-for-the-Docs-beta_d2WQE7D51qI) | Waiting-list access is distinct from immediate product access; qualification serves the beta invitation process. The form's sign-in barrier was not bypassed. | Email first, optional business questions second, explicit invitation expectation. A waitlist submission is not account creation. |

## Design Decisions

- Real native forms only. Remove the rejected sample-product component and its styling; no generated artwork or fabricated product state in the entry shell.
- One shared responsive shell: Enquiry wordmark, home link, pale lilac background, white 488px maximum-width form, modern sans typography, violet primary action, legal footer.
- Preserve three different intents: sign-in requests an existing-account link; signup requests an invited account setup link; early access records a waitlist request.
- Keep the existing 30% founding offer with its original first-12-month and paying-customer conditions. Do not add prices, quotas, entitlements or new incentives.
- Defer optional qualification until after email is recorded. Use native selects, checkboxes and radios instead of toggle-like text buttons.
- Match confirmation, resend, error, expired-link and workspace-recovery presentation to the initial form.
- Use visible focus, 44px minimum interaction targets, 16px mobile fields and reduced-motion handling. Do not use a decorative image to occupy unused space.

## Boundaries

OAuth providers are shown only when the existing provider configuration enables them. No password, passkey or email-code flow was added merely because a reference supports it. Auth decisions, tenant isolation, callback destination validation and the production database schema are unchanged.

Local email-request fixtures verify interface states only. They do not demonstrate actual inbox delivery, owner-account access or hosted Supabase configuration. Those are separate release checks.
