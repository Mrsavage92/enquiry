# CC1 historical baseline evidence

Source reviewed: `6eba9a4cee9759cad54d891e8e7515fe438b1c8b`.
Review document committed at: `fb58a02b1a7675621529e0c3a548b9151b349b79`.
Evidence checked again while preparing this package on 2026-09-07.

The conversation archive `Enquiry_Review_Evidence_2026-09-07.zip` contains isolated source copies, original TAP logs and the initial probe. Its SHA256 is `a20b6428e14075343b24e87db4769c8cb6e6bafc9b161555ecf8c04af551c068`. The archive itself is not copied into this package. Its source hashes, observed results and reproducible diagnostic logic are retained here so implementation does not depend on access to the chat attachment or a local Windows path.

The three source copies were verified again against the exact Git blob hashes in [baseline-results.json](./baseline-results.json). With Node v22.16.0, both commands were rerun against those unchanged isolated copies during package preparation:

| Command in isolated verified-source directory | Exit | Tests | Passed | Failed |
|---|---:|---:|---:|---:|
| `node --experimental-strip-types --test src/domain/price-compiler.test.ts` | 0 | 14 | 14 | 0 |
| `node --experimental-strip-types --test price-safety-regressions.test.ts` | 1 | 6 | 0 | 6 |

These are observations, not invented expected output. The failures expose three families: quantity meaning, ambiguous service/rule ordering and unconfirmed-service pricing. Monetary examples are synthetic.

## Run the relocated probe against your checkout

From repository root:

```sh
node --experimental-strip-types --import ./scripts/test-resolve-hook.mjs --test docs/implementation/CC1_COMMERCIAL_CORRECTNESS/probes/price-safety.probe.ts
```

The relocated probe preserves the six assertions, changes imports for its package location and adds explanatory comments/formatting. Its first baseline run against the actual full checkout remains the implementer's responsibility; this evidence does not claim that the relocated command or the complete repository suite was executed during package preparation.

To reproduce original behaviour independently, use a separate worktree at the reviewed source commit and bring only the probe into that worktree. Do not reset a shared implementation branch. After fixing the implementation, integrate the relevant regressions into default-discovered tests under `src` or `scripts`; `scripts/test-discovery.mjs` searches those roots, not this docs folder.

## Limits

No full build/typecheck/lint/default test run, live provider call, browser workflow, database concurrency test or two-tenant endpoint test was run for this package. Existing historical UI/server findings are source traces until exercised. The historical benchmark's real-provider skips are not successful real-provider evidence.

Keep this baseline immutable. Store new implementation results separately, tagged with their actual tested revision. Follow the current regression policy rather than assuming the historical test totals remain current.
