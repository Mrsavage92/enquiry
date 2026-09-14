# Product-Led Sign-in Correction

Adam explicitly rejected the generated physical envelope as generic and dated. A second GPT-generated reference uses the actual Enquiry application as its input. The implementation replaces the envelope with a native, read-only sample enquiry and removes the public envelope asset. The prior envelope direction is rejected history, not an approved design.

The preview reads the existing authored `UI1_PAINTING` fixture. It has an explicit sample label, no real customer data, no live workspace mount, no pretend interactive controls and no ability to send or record anything. The reply excerpt retains unconfirmed contractor availability, site measure, price and the statement that nothing is booked. Authentication logic is unchanged.

## Checks

- Full suite: 746 passed; zero failed/cancelled/skipped/todo; 128212.008 ms.
- Typecheck, lint, production build and diff check passed.
- Desktop 1440x960, tablet 1024x768 and phone 320x740 visually reviewed. No horizontal overflow; the tablet can scroll vertically to accommodate its readable sample content.
- The sample preview is hidden on phones. Form controls retain the preceding sign-in pass's required-email, focus, error, pending and resend behaviour.
- Browser review used local visual configuration only. No email was sent, authenticated session created, or hosted configuration changed.
- New reference: `docs/design/ui1-references/signin/gpt-signin-product-reference.png`.

This verification is not a claim that live inbox delivery or owner sign-in has been completed.
