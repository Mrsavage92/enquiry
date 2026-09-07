# Evidence, scope and reproduction

## Snapshot and method
- Review date: 2026-09-07, Australia/Brisbane.
- Application source: `79de089b2fe3f79efec14795eb340cf047bdb67a`.
- Read using the connected GitHub repository, with immutable refs for this pass. Earlier cited source excerpts were used only where their file blob is unchanged by the intervening documentation-only commits.
- Scope: the ten requested product areas, representative live paths, related store/actions and data boundaries. This is not an exhaustive audit of every file.
- No application code, current-phase instructions or deployment settings are changed by this package.

## What ran and what did not
`git ls-remote` failed with `Could not resolve host: github.com` in the container. The live public-page open also failed. These are limitations of this review environment, not evidence that the product itself is offline.

No full repository build, typecheck, lint, default test suite, provider-backed interpretation, browser journey, real-device test or tenant penetration test ran. In particular, no existing demo screenshots are passed off as fresh screenshots of the deployment.

Two small source files were reconstructed from the complete connector output and checked using Git's blob hash calculation. Both matched byte-for-byte:

| Source | Git blob SHA |
|---|---|
| `src/domain/client-intent.ts` | `933d0261c195dc5081d7c4e798a165c10303c738` |
| `src/lib/public-links.ts` | `6b68e543b072e237b012c707e00f4d9ea4c2aabd` |

Node v22.16.0 ran 12 custom diagnostic assertions against those exact modules: **7 passed, 5 failed, exit code 1**. Four passes cover the fixture-link guard's boolean input combinations; three cover ordinary accept/question/empty replies. Five expected-safety assertions fail because the demo intent parser returns `accept` for:

- `Yes, could you confirm whether travel is included?`
- `Please do not book it.`
- `That is not confirmed.`
- `Okay, but only if the total stays under $500.`
- `Please do not go ahead.`

These are synthetic review inputs, not customer messages. The inspected timer that simulates a reply is demo-gated. Do not relabel these as five production booking incidents or five failing repository tests. The fixture-link guard test is not proof that all public routes or tenant endpoints are secure.

The companion chat evidence archive contains the exact isolated files, hash manifest and raw TAP output. The repo's [diagnostic seed](./probes/review.probe.ts) imports the actual app files when run from this folder:

```sh
node --experimental-strip-types --test docs/reviews/2026-09-07_PRODUCT_EXPERIENCE/probes/review.probe.ts
```

The seed is deliberately under `docs`, outside default `src`/`scripts` test discovery. It is not a silent change to the default test baseline. The above in-repo import-path version was not run against a full checkout here; the identical assertions ran against byte-matched isolated modules. Adapt the relevant assertions into proper regression tests only within an authorised implementation.

## Source inventory
Each review contains its own narrower source map. Key freshly read surfaces include:

- Current phase and repository head; route/component trees and the open-PR collection.
- Onboarding, manual intake, queue, workspace, PhoneDesk, WaitingDesk and generic fact correction.
- BrainScreen, PricingRules, prototype Brain compiler and teaching/voice/store actions.
- Trust overview/access/automation/audit and the workspace-loading boundary.
- Auth client, current-user events, request middleware, upstream verification and request-origin isolation.
- Public quote containment, privacy notice, homepage, SiteShell, LivePhone and root/provider composition.
- Insights calculations/rendering, beta telemetry specification, launch event writes and sent-reply audit detail.
- Interpreter selection, schema and the existing reviewed adapter/application path.

The shared state-store review covered the relevant action implementations and persistence sections, not just action names. Findings about a callback being local are based on its implementation, not on the `usePrototype` name alone. Server-hydrated caches are not inherently defective.

## Evidence labels
- **Source trace:** callback and data path inspected; behaviour follows from code, but was not exercised end-to-end here.
- **Source mismatch:** two inspected representations contradict, such as privacy text versus persistence code.
- **Executed isolated probe:** exact source module ran with stated inputs and outputs; limited to that module.
- **Verification risk:** a plausible race, viewport or deployment issue needs an appropriate runtime test.
- **Design hypothesis:** a recommendation for validation, not a measured customer preference or conversion result.

## Primary external references checked
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html . Used for least-privilege, per-request authorisation and adversarial permission tests, not a claim of certification.
- W3C WCAG 2.2 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html . AA minimum is 24 by 24 CSS pixels with specified exceptions; a 44px product preference should not be mislabelled as that criterion.

No legal compliance conclusion, provider retention claim or residency assertion is made. Those require verification of the actual service configuration and appropriate specialist review where needed.
