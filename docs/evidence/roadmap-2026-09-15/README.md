# Customer Roadmap Verification

Candidate based on production `b44bb24` (PR #28). Scope: customer roadmap only.

## Visual Evidence

- `desktop-full.jpg`: complete desktop implementation, all four horizons.
- `phone-390.jpg`: initial 390x844 viewport with Now immediately visible.
- `phone-next-390.jpg`: Next horizon, labelled native-app concept, no download badges.
- `desktop-1440.jpg`: intermediate desktop capture before final active-horizon/image-background polish.
- Reference: `../../design/roadmap-2026-09-15/roadmap-refined.png`.

Checked 320, 390, 768 and 1440px widths: no horizontal overflow. Native details remain
readable at narrow widths; the sticky horizon nav does not cover the selected section heading.
Reduced motion and forced colours have scoped CSS fallbacks. OS-level reduced-motion and
physical-device checks are not independently verified.

## Functional Evidence

Local browser flow: expand native-app details; save interest; send labelled local verification
feedback; observe success; reload; verify interest persisted; remove interest. All passed.
No production feedback or waitlist entries were created by this verification.

Keyboard verification: focus a native summary, Space closes it, Enter reopens it; the focused
summary has a visible solid outline. Final local browser error log was checked.

## Checks And Review

- Full serial suite: 759 tests passed, 4 suites, 0 failures (338.6 seconds).
- Targeted roadmap data/UI tests: 9 passed, including future-status truth, old feedback aliases,
  permitted feedback IDs, conceptual asset budget, disclosure semantics and error-state source checks.
- Typecheck, lint, production build and whitespace checks passed. The final copy/CSS refinement
  was rechecked with typecheck, lint, build and the targeted suite after the full suite.
- Original GPT chat reviewed the refined board and actual desktop/mobile screenshots. Verdict:
  credible customer/investor-facing roadmap; no further structural redesign. Its three requested
  refinements (larger desktop phone concept, stronger supporting type, sharper Next copy) were applied.

Auth delivery, operator beta readiness and native store publication are separate outstanding
work, not claims made by this roadmap release. Production deployment evidence is recorded on
the associated pull request after merge and live inspection.
