# Claude starter instruction

Implement CC1 in `Mrsavage92/enquiry`.

Read `AGENTS.project.md`, `docs/CURRENT_PHASE.md`, then `docs/implementation/CC1_COMMERCIAL_CORRECTNESS/README.md`, its acceptance matrix and the linked commercial-correctness review. CC1 is the current authorised slice; archived R2A-only instructions are historical. This authorises implementation, not self-sign-off or release.

Inspect the current branch and preserve unrelated work. Establish the actual baseline, reproduce the review defects and implement the five commercial corrections plus directly necessary transaction/revision safeguards. Work through the package's internal steps without requesting another phase approval between them. Keep live/demo isolation, tenant checks, raw-message persistence, null fallback, deterministic authority and human review intact.

The required outcomes are safe quantity parsing, explicit service/rule ambiguity, authoritative service confirmation, copying separate from external-send attestation, matching reviewed text/structured price, safe stale-approval handling and consistent atomic updates. Cover both main and follow-up paths. No broad integrations, redesign, model upgrade, PWA work or automatic historical-data repair.

Add real regressions to the default test suite, run the required checks safely, and exercise the signed-in non-fixture browser/database paths. Never use a production database for an improvised build/migration test. Do not weaken tests or describe skipped/mocked checks as passed live verification. Lack of an environment/key is an explicit blocker, not a reason to invent a result or abandon otherwise safe in-scope work.

Use an implementation branch and return a review-ready PR or exact commit/diff handoff. Complete `docs/implementation/CC1_COMMERCIAL_CORRECTNESS/IMPLEMENTATION_REPORT.md` using the package template. Include the actual base/head, changed files, each acceptance ID, exact commands/results, evidence, migration implications and remaining risks. Do not auto-merge/deploy, mark CC1 signed off, or advance to another phase. Stop for independent review after the handoff.
