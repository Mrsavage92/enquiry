# Entry aurora preview

Owner supplied the AuroraBackground component and requested it for sign-in,
account creation and early access. This is a scoped exception to the earlier
no-gradient direction, not a change to the operator app's visual system.

## Implementation

- Shared AuthLayout adds a decorative, pointer-transparent background.
- Supplied repeating-gradient ribbons adapted to existing CSS and UI1 colours.
- White forms remain opaque; navigation and footer edges fade to the shell.
- A single 4.5-second transform/opacity entrance settles without an infinite loop.
- Reduced motion disables animation; forced colours removes the decoration.
- No Framer Motion dependency, Tailwind reconfiguration or auth behaviour changes.

## Checks

- Focused aurora and UI1 contrast tests: 6 passed.
- Typecheck, lint and production build: passed.
- Browser: early-access initial and previously joined states, desktop 1440px,
  mobile 390px and expanded details at 320px; keyboard focus remains visible,
  one main landmark, no horizontal overflow, decorative pointer events disabled.
- Sign-in and signup use the same layout through AuthRequestForm. Their local
  runtime redirects into demo mode because this checkout has no Supabase env
  configuration; those two screens were not independently browser-verified.
- Reduced-motion handling is source-tested, not OS-emulated in this browser.
- This background has not been deployed to production.

Local preview: http://localhost:8084/early-access. This is visual verification,
not a claim that local email submission or production sign-in was retested.
