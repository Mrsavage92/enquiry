# Enquiry - Test and Regression Policy

This is a management/testing policy for phase gates. It does not replace the repository's test scripts.

## Why this exists

Several build handoffs have already reported test failures as "pre-existing" or platform-specific. That can be true, but phase management should never accept that label solely from the implementer's summary.

A phase may still pass with a known baseline failure only when product management can distinguish that failure from a regression introduced by the phase.

## Gate rule

For every implementation phase:

1. Run or inspect the checks required by the active phase.
2. If all required checks pass, no special handling is needed.
3. If a required check fails and the implementer calls it pre-existing, compare against a known pre-phase commit or reproduce the same failing check on the closest available pre-phase baseline.
4. Record the exact failing test/check and whether the failure signature is unchanged.
5. Never use "pre-existing" as a blanket waiver for new failures.

## What counts as the same baseline failure

Treat a failure as unchanged only when the important failure signature is materially the same, for example:

- same test file/check;
- same assertion or platform error class;
- same migration/tooling incompatibility;
- no new affected product path introduced by the phase.

A different stack trace, different failing fixture, new assertion, or wider failure surface requires review even if the command was already red before the phase.

## Phase handoff requirement

When a phase has a red repository-level check, the handoff must state:

- exact command run;
- exact failing test/check names;
- whether focused tests for the changed behaviour passed;
- baseline commit used for comparison when claiming the failure is pre-existing;
- whether the failure signature is unchanged;
- whether any changed file participates in the failing path.

## Release gate

Before first beta, Phase 8 must establish a fresh test baseline from the release candidate.

The release candidate does not need every platform/tooling test to be green if a genuine environment/platform limitation remains, but it must have:

- passing typecheck;
- passing production build, unless the environment itself is demonstrably the blocker;
- passing focused product/domain tests for the release-critical features;
- no unclassified new failures;
- every remaining red check documented with its failure signature and evidence that it is not a product regression.

## Do not do

- do not weaken or delete tests just to make a gate green;
- do not skip focused tests because the broad test command is already red;
- do not turn a phase into a platform-repair project unless the platform failure blocks the product path being released;
- do not accept "works on my machine" as release evidence.

## Management principle

A red test can be an environment problem. An unexplained red test is a management problem.
