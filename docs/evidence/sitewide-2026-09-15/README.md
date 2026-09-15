# Sitewide visual verification - 15 September 2026

Branch: `codex/ui1-sitewide-visual-review`, base `9ebff84`.
Owner: Codex. Scope and decisions: `../../design/sitewide-2026-09-15/README.md`.

## Direct verification

- Actual local browser review at 1440x960 desktop, 390x844 phone and 768x1024 tablet. At 320x740, How, Settings, Support, Insights, Early Access and the open enquiry also have no document overflow.
- All main public/app routes reviewed. `after/` contains route screenshots, including long enquiry, legal documents, utility pages, unavailable customer links and not-found recovery.
- Desktop shell captures wait for the hydrated primary navigation, not the initial mobile/skeleton render. Earlier `before/` captures are exploratory only and some caught initial rendering; they are not a pixel-accurate baseline or acceptance evidence.
- Settings: native disclosure expands/collapses with keyboard Space; visible focused summary; actual existing fields preserved.
- Support: nonsense search returns zero results and recovery copy; clearing restores six answers; sending/recording distinction remains explicit.
- Mobile enquiry: long message visible, Why this reply opens the evidence sheet; actual crew rule and unconfirmed availability/measure/price preserved. No send or booking was recorded.
- Business: Services, Pricing, Availability, Policies, How you work and Voice & tone checked. Conflicting source prices remain visible; no financial rule changed.
- Trust: current choices expose selection; high-risk Automatic control remains disabled; empty activity history does not invent events.
- Onboarding: stage progression verified with clearly marked unsaved preview data. Stage two focuses H1 and scrolls it into view. Create workspace was not submitted.
- Aurora pause: actual computed animation changes to paused. Reduced-motion/forced-colour safeguards inspected in source and covered by regression tests; OS-level motion preference emulation is not claimed.
- Quote/booking links remain unavailable in the normal build. The opt-in prototype document flow was source-reviewed but not enabled or advertised as a live customer capability.

## Automated verification

Full suite: 768 passing, zero failed/skipped (371.9 seconds), followed by release-head repeat after the final onboarding focus/test assertions. Typecheck, lint and production build pass. Nine sitewide UI source-contract tests were added; the existing aurora layout assertion was updated for the optional wider onboarding surface. These source tests complement, not replace, browser interaction and screenshot review.

## External limits

- Production personal-email delivery and successful owner sign-in are not newly verified in this visual slice.
- Custom SMTP/sending-domain, support/privacy contact, public traffic and operator beta gates remain open unless independently completed elsewhere.
- No production data, provider configuration, credentials or integration behavior changed.
- Local prototype login redirects to its sample workspace, so signed-out login/signup/callback presentation must be checked on the deployed auth-enabled website. Local sample behavior is not evidence of production authentication.
- Real tenant data states and the disabled sample customer payment flow are not represented as fully end-to-end tested.

## Original GPT final review

Source: original conversation `6aa20b90-c690-83ec-af8b-b549fc7c2865`, after uploading the complete tablet How story, revised desktop Insights/Settings and mobile open enquiry.

Verdict: retain the compositions; no material visual blocker in those attachments. The reviewer found the changed window/scope and unconfirmed facts clear, Insights correctly attention-led, Settings appropriately bounded, and the mobile enquiry still conversation-first. Optional minor amber/contrast polish was not considered a publication blocker. This is explicitly a screenshot-limited visual review, not a whole-site behavioral or beta sign-off.

## Release

Production website publishing is authorised by the owner's standing instruction. Commit, PR, deployment status and production route verification are recorded on the delivery PR after checks complete. No beta-ready claim is made by this release.
