# Handover - Claude's marketing rebuild (Linear mirror) for Codex review

Date: 2026-09-14 (Australia/Brisbane). Author: Claude (delivery owner role, stopped by the product owner on 2026-09-14). Audience: Codex, reviewing this work against UI1.

## One-paragraph status

Claude's Linear-mirror rebuild of the public marketing site is complete, verified and pushed, but NOT merged and NOT in production. It lives on `visual/mirror-integrate` (head `d205d9f`), which already contains `main` at `80732f7` (UI1 merged in at `0880fe6`, then one re-sync commit). Production is `main` at `80732f7`. The product owner stopped Claude's run before the open findings below were fixed and before any merge. Codex now decides, with the owner, whether this work ships as-is, ships re-skinned onto the UI1 identity, or is dropped. Claude will not touch these branches again unless asked.

## What is on main from Claude (already live)

- Release PR #16 (2026-09-09): CC1 commercial correctness (#11), display truth (#10), the earlier paper-identity visual pass "visual v1" (#12), public traffic gate + founding-user offer (#14) with three review blockers fixed on the integration branch (test alignment, X-Frame-Options replaced by CSP frame-ancestors with four Grok origins, truthful /signup copy + robots Disallow), docs (#15), and a demo-mode decline fix so a decline never records or renders as a sent message (declineEnquiryState replaced declineWithLetter; the audit summary no longer says "letter sent").
- Hotfix PR #17: `npm run build` no longer runs `db:migrate`. The deploy role `enquiry_app` owns no table, so build-time DDL can never succeed; migration 0007 was applied out of band as the owner role on 2026-09-09 (grant DML to enquiry_app, enable RLS, insert the `_migrations` row). Procedure documented in `scripts/migrate.mjs` and `docs/phases/LIVE_LOOP_IMPLEMENTATION_RECORD.md`.
- PR #18: /roadmap hierarchy fixes inside the paper identity (h1 44px to 89.6px, era-nav indicator no longer strikes its caption, legend aligned, date updated, hero backed with opaque paper so ruled lines do not cross glyphs).
- Test baseline measured by Claude: 725 pass serially (`npm test -- --test-concurrency=1`) at main `9a00749`. UI1 may have changed the count; re-measure on a clean checkout.

## What is NOT on main (the work to review)

Branches on origin, all pushed, no PR, none merged:

| Branch | Head | Content | Report |
|---|---|---|---|
| visual/mirror-linear | c165896 | tokens.lock.json (417 custom properties extracted from linear.app), marketing token layer, nav, footer, buttons, section vocabulary, home page with the product film as hero media | research/agent-runs/2026-09-09/83 |
| visual/mirror-roadmap | 5ac0a0f | /roadmap on the linear.app/changelog pattern (rail, entries, tab row, feedback control kept) | 84 |
| visual/mirror-how | 507f384 | /how as feature sections + two-column step cards | 85 |
| visual/mirror-updates | 6ada8ff | /updates as changelog entries, /early-access as header + form + offer | 86 |
| visual/mirror-entry | 8c84a05 | /demo on the system vocabulary; /login and /signup left as-is (Linear's own login drops marketing chrome too) | 87 |
| visual/mirror-integrate | d205d9f | all five merged (71bf4fd), eight shared fixes, header-to-first-block spacing fix (4f8fa37), then main/UI1 merged in (0880fe6) and mk-app-surface re-synced to UI1 tokens (d205d9f) | 2026-09-10/89, 91 |

`visual/preview-v1` (8a73d63) is the old paper pass, already on main via #16; safe to delete.

Reports and evidence live outside the repo at `C:\Users\Adam\Documents\Enquiry\research\agent-runs\2026-09-09\` (83-87) and `2026-09-10\` (89-91). On the branch itself: `.style-mirror/system.md` (token and component contract, the marketing scope selector, derivations), `.style-mirror/section-log.md` (per-route section-by-section proof), `.style-mirror/tools/` (the measurement harness), `tokens.lock.json` at the worktree root.

## Method (so the review can check the claims, not the prose)

Reference: https://linear.app (system) and https://linear.app/changelog (roadmap and updates pattern). Chosen by Claude from the approved reference tier after the owner rejected the paper/serif identity twice and declined to pick. Every colour, family, weight, size, tracking, radius, spacing and layout value comes from the extraction or a recorded derivation (nine derivations listed in report 83, including the Inter family substitution and the two-films hero). Each route was proven section by section: reference crop beside built crop at 1440 and 390, computed-style diff, 0 mismatches remaining per route (109 checks per viewport on home, 114/108 on roadmap). Contrast measured from rendered pixels, not token maths: 0 real failures across the six routes at both widths at 71bf4fd, lowest pair 4.57:1. Copy unchanged. Functional behaviour unchanged (waitlist form, roadmap feedback, tracking, demo widget, early-access flow). Marketing rules are scoped under a marketing-only selector so app tokens are untouched (selector named in system.md).

A shielded cold rating (rater saw no reports, no scores, no reference) scored 71bf4fd at 72/100: `research/agent-runs/2026-09-10/90-cold-rate-mirror-integrate.md`, 135 evidence files. Grader 14/14.

## Open findings on the branch (NOT fixed - the fix run was stopped)

From the cold rating; only the dead-band fix (4f8fa37) landed afterwards.

- P0-1 The marketing email input is invisible: fill vs page 1.05:1, border vs fill 1.24:1 (needs >= 3:1 boundary). Primary conversion control on /, /early-access, /roadmap and the home footer.
- P0-2 Body copy runs to 135 characters per line; the `.mk-lede` width cap is beaten by an unlayered class (the same class-vs-utility bug already fixed twice on the branch; see section-log and report 86).
- P0-3 /how and /updates page headers carry no CTA in the first viewport; /roadmap and / do.
- P1 Nav is 0.8-0.76 alpha + blur(20px); light app surfaces (the demo panel) smear through it.
- P1 Mobile tap targets under 44px at 390 (header CTA 52x32, menu rows 155x28, others listed in report 90).
- P1 /roadmap and /updates are long prose runs with no media between entries (8,167px and 2,374px).

The stopped agent's worktree (scratchpad enquiry-wt-mirror-integrate) holds uncommitted, unpushed edits to `src/styles.css` from the start of P0-1/P0-2; ignore them, the branch tip is the truth.

## Relationship to UI1 (the comparison Codex is asked to make)

1. Scope: UI1 (PR #19, 47a8d29) is the operator app; `docs/CURRENT_PHASE.md` makes the UI1 docs authority "for the operator app". The mirror branch is the public marketing site plus /demo. The only shared file is `src/styles.css`. The merge at 0880fe6 kept both sides; Codex should diff `src/styles.css` between main and d205d9f and confirm no UI1 rule was lost and no `mk-` rule leaks into `src/routes/_app`.
2. Identity: UI1 is light (Inter, page rgb(246,245,243), violet accent, lilac shell). The mirror is dark (Linear's tokens). Production marketing pages currently render the OLD paper layout wearing UI1's inherited font and accent. Two identities cannot both be the brand.
3. Options for the owner and Codex: (A) ship the dark mirror as built after fixing the open findings (about 1 hour of agent time; dark marketing hands off into a lilac app); (B) drop the mirror and rebuild marketing on UI1's identity (3-4 hours; loses the proven layout work); (C) keep the mirror's structure (film in the hero, changelog roadmap, section rhythm, CTAs in every fold) and replace the marketing colour tokens in the marketing layer with UI1's token values from `src/styles.css` on main, keeping Linear's type scale, spacing and radius (about 90 minutes on top of the branch as it stands). Claude's recommendation was C. Nothing was started on C.
4. PR #20 (codex/ui1-visual-refinement, CONFLICTING with main, owner acceptance open) also edits `src/styles.css`. Whichever of #20 and the mirror lands second must rebase over the first.
5. The old paper marketing rules (`.site-hero`, ruled-paper background, `.roadmap-spine/-dot/-rail/-stage`) are deleted on the mirror branch; UI1 kept them. If the mirror is dropped, those rules still carry the roadmap fixes from #18.
6. The demo widget: the mirror restyled its frame (MediaFrame, mk-app-surface, re-synced to UI1 tokens at d205d9f); UI1 restyled the app inside it. Check the seam on / and /demo at 1440 and 390.

## Facts Codex needs that are not in the repo

- Production: main 80732f7 at https://enquiry-ashy.vercel.app, verified by content on 2026-09-14. The Vercel CLI on Adam's machine is signed into the wrong account (asavage-5851; the project is under mrsavage92s-projects), so build logs are unreachable there; use GitHub commit status and curl.
- Sign-in is broken for every user and has been since at least 2026-09-09: the app sends `redirect_to=https://enquiry-ashy.vercel.app/auth/complete` correctly (captured on the wire), but the Supabase project's Site URL is still the factory `http://localhost:3000` and the production redirect is not on the allow list, so Supabase substitutes localhost (the auth log for the owner's 2026-09-09 15:36 AEST attempt shows `referer: http://localhost:3000`). No sign-in has succeeded since. Fix is dashboard-only, owner's account: Authentication -> URL Configuration -> Site URL `https://enquiry-ashy.vercel.app`; Redirect URLs add `https://enquiry-ashy.vercel.app/auth/complete`, `http://localhost:8080/auth/complete`, `http://127.0.0.1:8080/auth/complete`. `docs/AUTH_DEPLOYMENT_CONTRACT.md` already lists exactly this as "Not applied".
- Auth email still uses Supabase's built-in SMTP (a handful of messages per hour, project-wide). Custom SMTP is required before anyone but the owner signs in.
- ANTHROPIC_API_KEY is not set on Vercel; interpretation runs the deterministic null fallback in production.
- The owner's test workspace exists: auth user 29cea7c1-1f4f-4f8b-8d67-6dc516864d38 (adamsavage6@hotmail.co.uk) owns business 860aaafc-ff75-4841-8b5e-24c5a4a86505 "Adam Savage - test workspace" (role owner, six action policies seeded exactly as onboarding does, Australia/Brisbane, AUD, no sample data). It is the only business in the database. There is no plan, billing or admin concept in the codebase; owner is the ceiling. Provisioning SQL and evidence: `research/agent-runs/2026-09-10/88-provision-test-workspace.md`.
- public.waitlist has 0 rows (test rows deleted 2026-09-09). Orbit Digital shares the Supabase project; its contacts table must stay at 5 rows.
- Governance note: CC1 (#11) was merged on the owner's explicit "push all live" instruction on 2026-09-09 before Codex's sign-off; the independent review record is research/agent-runs/2026-09-07/35, 36, 38, 39 and 2026-09-09/77, 78. `docs/CURRENT_PHASE.md` has since been reconciled by the owner.

## Suggested review order for Codex

1. `git diff main..d205d9f -- src/styles.css` (the only shared file; confirm the union).
2. Run the branch locally (`npm ci`, `npm run dev`), open /, /roadmap, /how, /updates, /early-access, /demo at 1440 and 390, then /login and /enquiries to judge the dark-to-light seam.
3. Read `.style-mirror/system.md` and `section-log.md` for what was proven and how; re-run `.style-mirror/tools/contrast.mjs` if the numbers matter.
4. Read `research/agent-runs/2026-09-10/90-cold-rate-mirror-integrate.md` for the open findings with evidence.
5. Recommend A, B or C to the owner. If C, the cheapest path is: swap the marketing colour tokens in the marketing layer for UI1's values, keep Linear's structural tokens, re-run the harness and the contrast sweep, then close the six open findings, then merge.

## Claude's outstanding items, now Codex's to take or drop

Launch plan with phases and owner blockers: `research/45-launch-plan-2026-09-09.md` and the Notion page "Launch plan - shareable (2026-09-09)" under Growth & Launch HQ. Phase 2 (launch film: real product captures as the spine, Grok atmosphere shots, Remotion assembly, per-platform cuts) was never started.
