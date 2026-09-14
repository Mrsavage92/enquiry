# UI1 Public-Site Release Candidate

Date: 14 September 2026. Owner: Codex. Branch: `codex/ui1-early-access-release`.

## Outcome

Bring the public site, sample demo and early-access journey into the approved light UI1 identity,
without changing the domain engine or representing the operator beta as ready for real customers.

This branch includes the accepted continuous entry aurora from PR #27 and the auth-email source
record from PR #26. Claude's dark marketing branch remains unmerged and is not incorporated.

## Implemented

- Homepage rebuilt around screenshots of the actual current app: Today, an open enquiry and Business.
- Three selectable views, with separate phone captures. Images are sample workspace data, not customer evidence.
- No generated product mockups, invented integrations, testimonials, production metrics or fabricated logo.
- New white public shell, restrained lilac bands, useful violet/rose/green icon accents and clear sign-in access.
- Mobile disclosure navigation with Escape handling, focus restoration, explicit active routes and 44px targets.
- Shorter How it works; existing interactive sample decision logic retained on How and Demo.
- Roadmap keeps its stages and feedback. Its navigation is opaque, jumps account for the actual header,
  reduced-motion jumps are immediate, and feedback failure gets a visible error instead of an unhandled rejection.
- Updates use a readable dated layout. Privacy and Terms distinguish sample data from server-stored live workspaces.
- Waitlist tracking failures no longer create unhandled promise rejections during a real form submission.
- Old boxed-E browser/touch icons and old beige share card replaced. Operational type is the locally served Inter;
  the unused remote IBM Sans/Serif stylesheet is removed.
- Aurora remains exclusive to entry pages. No dependency added.

## Design Sources

Owner-approved UI1 handover and the entry-page direction remain authoritative.

21st.dev patterns reviewed: segmented product views, centered FAQ disclosures, mobile navigation,
workflow steps and minimal footer. These informed the interaction choices, not a wholesale template import.
Implementation uses existing React/Lucide and native HTML disclosure semantics; no third-party component code copied.

- https://21st.dev/community/components/newest
- https://21st.dev/community/components
- https://21st.dev/@designali-in/components/accordion-01-1

fal.ai artwork was not required: the actual app is the appropriate primary visual and avoids the previously
rejected fake-product imagery. No image-generation account, credits or API key was used.

Privacy wording was checked against the actual data flow and OAIC transparency guidance, not certified as legal advice:
https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/more-guidance/guide-to-developing-an-app-privacy-policy

## Verification

- Final `npm test -- --test-concurrency=1` at UI commit `157a525`: 759 tests passed, zero failures/skips,
  approximately 328 seconds. The earlier baseline run passed 753 tests before the six new checks were added.
- `node --test scripts/public-site.test.mjs`: five new source/asset guardrail tests passed.
- Public-site text/action AA contrast test added; all four UI1/entry/public contrast tests passed.
- Final typecheck, lint and production build passed.
- Browser: homepage at 390x844, 1440x960 and 1920x1080; How at 390x844 and 820x1180.
- Mobile Roadmap, Updates and interactive Demo: no horizontal page overflow observed.
- Privacy and Terms at tablet width: resolve correctly with one main H1 and no horizontal overflow.
- Product views switch to the matching real image. Mobile uses separate 390x600 captures, desktop 1440x960.
- FAQ opens its answer. Mobile menu Escape closes it and restores focus; following a menu link closes it.
- Demo changed-message control updates scope, deadline and next action. Why disclosure remains available.
- Local early access: malformed email stays on form; submit shows disabled Joining state; success focuses optional
  questions; business details/channels/volume saved; completion focuses You're on the list. Test address:
  `ui1-release-check@example.com`, submitted only through the localhost form.
- Reduced motion and forced-colour safeguards are source-tested. OS-level emulation was not available in this
  browser connection; do not claim independent runtime validation of those preferences.
- The 8084 local preview has no configured Supabase auth, so login/signup redirect to its sample workspace.
  Do not treat that local redirect as a production sign-in test.
- GitHub/Vercel reported a successful preview deployment for `157a525`. The homepage and early-access page
  were opened in the owner's signed-in Chrome session. The entry background pause/resume control works,
  and no horizontal overflow was observed at that browser's 3185px viewport.
- The Vercel preview also redirects Sign in to a labelled sample workspace. It is a visual preview with
  auth disabled or unconfigured, not a production-auth verification environment. Correct preview configuration
  is required before using that deployment to verify login or operator access.
- Vercel preview protection requires the owner's Vercel session. The in-app browser was not signed in;
  the local website remains available at `http://localhost:8084/` without that preview-provider login.
- PR #28 is the single release candidate. PRs #26 and #27 were closed as superseded, not merged.
  Production `main` was confirmed unchanged at `1a855babcd518cf95f339359d56485e9e812bd7f`.

Preview: https://enquiry-git-codex-ui1-early-access-release-mrsavage92s-projects.vercel.app

Release review: https://github.com/Mrsavage92/enquiry/pull/28

## External Launch Gates Still Open

This is a release candidate, not permission to send deliberate market traffic or onboard external businesses.

1. Public support/privacy email, responsible operator details and sending domain need owner confirmation.
   The current reply-to-email contact wording is insufficient while auth mail uses a no-reply provider sender.
   Privacy/provider/retention/overseas-processing disclosures need owner review before collecting public traffic.
2. Supabase custom production SMTP and verified domain are not configured. Built-in email is testing-only and
   cannot be represented as reliable signup for arbitrary early-access users. No fake delivery guarantee added.
3. Fresh end-to-end production login by the owner still needs confirmation. The earlier production Site URL,
   exact `/auth/complete` allowlist and branded magic-link template were repaired and reload-verified separately;
   see `docs/AUTH_DEPLOYMENT_CONTRACT.md` and `docs/evidence/auth-email-repair-2026-09-14`.
4. Historical broker credential revocation remains externally unverified in `docs/PUBLIC_TRAFFIC_GATE.md`.
   Removing a credential from source is not evidence of revocation.
5. Deployed-target waitlist persistence, qualification and attribution still require verification. Local success
   is not proof of production persistence. No production prospect data has been bulk-read or altered here.
6. Operator beta retains its separate tenant isolation, onboarding, storage, action and provider-readiness gates.
   Claude reported no configured production Anthropic key; that report must be verified before claiming live AI interpretation.

Do not merge or advertise this candidate as an external operator beta solely because visual checks and unit tests pass.

## Asset Provenance

`public/product/ui1/*-desktop.jpg` and `*-mobile.jpg` are direct browser captures of the local UI1 sample workspace.
`public/og.jpg` is a direct 1200x630 capture of the redesigned local homepage. All sample names and values are illustrative.
`public/favicon.svg` is the temporary minimal violet accent; touch icons are rasterizations of that SVG, not a new permanent logo.
