# Independent Progress Critique

**Review date:** 2026-10-12  
**Default branch reviewed:** `main`  
**Commit reviewed:** [`52f15f3`](https://github.com/Mrsavage92/enquiry/commit/52f15f3b6fb1c1ee7889d803a9a5291c5dce1807)  
**Previous critique commit:** [`5daa087`](https://github.com/Mrsavage92/enquiry/commit/5daa0873535448bcf2977a831f933da9896bbd8e)  
**Change span:** one merged product commit, [PR #82](https://github.com/Mrsavage92/enquiry/pull/82)  
**Execution authority:** [`docs/CURRENT_PHASE.md`](./CURRENT_PHASE.md) remains authoritative. This critique does not authorise work or sign off a phase.

## Verdict against the enquiry-to-booking vision

**No material movement occurred through the core product loop this week.** The reviewed change does not advance messy inbound interpretation, the Decision Object, relevant business checks, minimum-blocker selection, next-action explanation, human review, booked/lost, or downstream handoff.

It does make meaningful **safe-beta infrastructure progress**. The authenticated server path now carries the verified email into workspace provisioning and the founding gate; unconfirmed email is not trusted; the migration ledger receives RLS and revoked public-role grants; and the vulnerable `seroval` version was upgraded. These are real fixes, not visual or documentation activity.

That progress is not release evidence yet. GitHub reports the reviewed head's only status as **Vercel deployment failed**, with no associated GitHub Actions workflow run. PR #82 also leaves its production sign-in check unchecked. The code therefore improves the candidate while the deployed behaviour remains unproven.

The product is still **not a safe first-beta candidate**. The server-authoritative loop still stops before customer-update, booked/lost and handoff completion; the real-provider benchmark still skips 15 of 16 cases; all 92 beta-gate items remain unchecked; and phase authority still says UI1 while payment/founding-gate and R2E/R2F-adjacent work exists on `main`.

## What materially moved

### Real safe-beta progress

- **Verified identity propagation:** auth middleware now passes both user id and confirmed email from the token verification already performed. Workspace provisioning no longer calls `getSessionUser()` without a token and no longer writes a blank email because of that call.
- **Founding-gate correctness:** a confirmed signed-in email can now be checked against founding membership. An unconfirmed address deliberately resolves to null and cannot pass the gate.
- **Migration-ledger containment:** migration `0015_lock_migrations_table.sql` enables RLS on `public._migrations` and revokes access from `anon` and `authenticated` where those roles exist.
- **Dependency risk:** `seroval` moved from 1.6.2 to 1.6.8; related lockfile dependencies also moved.

### Implementation claims, not independently reproduced

- PR #82 reports typecheck, lint, build, 1,283/1,283 tests and `npm audit --omit=dev` with zero vulnerabilities.
- PR #82 says the production migration ledger was locked manually on 2026-10-07.
- The PR's post-deploy sign-in verification remains unchecked.

### No material product movement

- No change to arbitrary enquiry interpretation or real-provider quality.
- No change to minimum-blocker, relevant-check or next-action logic.
- No change to the persisted customer-update loop.
- No change to server-authoritative booked/lost and downstream handoff.
- No change to recommendation-review or outcome telemetry.
- No beta-readiness item was closed.
- No current Notion strategy, decision, validation, roadmap or growth source was updated; the key pages remain unverified and were last edited between 2026-08-24 and 2026-09-11.

## Vision trace

| Vision stage | Current assessment | Weekly movement |
|---|---|---|
| Messy inbound enquiry | Deterministic and manual ingestion exist; real-provider quality remains unproven | None |
| Understood Decision Object | Substantial prior implementation exists | None |
| Relevant business checks | Prior rule/check work remains | None |
| Minimum decision blocker | Prior implementation remains; no new evidence | None |
| Explainable next action | Prior ledger and one-step UI remain | None |
| Human-authorised action | Reviewed send and persisted decline remain; open trust fixes are not merged | None |
| Booked or lost | Decline is persisted; other completion actions remain prototype-store behaviour | None |
| Downstream handoff | Not demonstrated | None |
| Identity and access foundation | Verified-email propagation and migration-ledger controls improved | Real progress |
| Deployed exact-head proof | Current head failed Vercel deployment | Regressed / blocked |

## Important decisions and contradictions

1. **Confirmed email is now a security boundary.** Founding access trusts only the email returned from a verified Supabase user, and server functions receive it through authenticated middleware context.
2. **The migration ledger is private operational state.** It is no longer intended to be readable or writable through public Supabase roles.
3. **The founding gate is moving closer to operational use without matching authority.** `CURRENT_PHASE.md` still authorises UI1 and explicitly excludes a production payment-integration programme.
4. **Commercial truth remains contradictory.** Source code says A$15/month for as long as subscribed, A$29 standard and a first-month refund; the growth handover still says free early access, 30% off for 12 months and never lifetime pricing.
5. **Open implementation is not landed progress.** PR #80 contains the known trust fixes from the prior review. PR #81 proposes a major “laser-focus” enquiry-screen rewrite on top of PR #80. Both remain open and are based on commits behind current `main`; neither closes a beta or phase gate.

## Blockers

| Blocker | Evidence type | Why it matters |
|---|---|---|
| Current-head Vercel deployment failed | Observed GitHub status | The identity/security fix is not proven in the deployed app, and the current deployable candidate is red. |
| Production sign-in smoke remains unchecked | Observed PR #82 checklist | The exact failure PR #82 targets could still exist in the real account path. |
| Execution authority does not match landed or open work | Observed unchanged phase documents | UI1 remains the only active slice while payment-gate, deep trust and R2E/R2F-adjacent work continues. |
| Known customer-trust fixes remain unmerged | Observed open PR #80 | Current `main` retains the previously reported send, promise, date and ledger defects. |
| PR #81 is stacked on stale/unmerged work | Observed PR bases | A large interaction rewrite cannot be treated as validated against current `main` and increases integration risk. |
| Outcome loop is not server-authoritative end to end | Observed current source | `markLost` and `acceptQuote` remain prototype-store actions; booked/lost/handoff is not durable across devices. |
| Real-provider evidence is absent | Observed benchmark report | The 2026-09-07 report passed null/fake modes, but real Anthropic mode ran only the provider-failure case and skipped 15 cases. |
| Readiness gates remain open | Observed | Beta gate: 0/92 checked. Public traffic gate: 6 checked and 17 unchecked, including external credential revocation. |
| Commercial sources disagree | Observed | Users, agents and public copy can receive incompatible pricing and early-access promises. |

## Milestone risk

| Area | Risk | Trend | Evidence |
|---|---|---|---|
| Core product vision | High | Flat | No weekly movement in the enquiry-to-booking stages. |
| Safe first beta | High | Flat | Security candidate improved, but outcome, provider and gate evidence remain open. |
| Deployment / live operations | Critical | Worsening | Current `main` has a failed Vercel status and no exact-head workflow evidence. |
| Identity and data security | High | Improving in code; live state unknown | Verified-email and migration-ledger fixes landed; production app verification is absent. |
| Governance and sequencing | Critical | Flat | UI1 authority remains stale while later-slice and payment-related work continues. |
| Commercial launch | High | Flat | Offer sources still conflict and the payment/founding path is not release-verified. |
| Cross-industry validation | Medium-high | Flat | No new real-provider, multi-brain or real-user evidence. |

## Next three priorities

1. **Restore and prove the exact-head deployment.** Diagnose the Vercel failure without broadening product scope. After an owner-authorised deployment, record the deployed commit and smoke-test confirmed-email propagation, fresh-user onboarding, allowed/refused founding-gate behaviour, and the live migration-ledger permissions.
2. **Reconcile authority and the open PR stack.** Product management must decide whether payment/founding-gate work and PRs #80/#81 belong to the active slice. Only authorised work should be rebased onto current `main`; do not merge stale stacked branches or infer authority from their existence.
3. **Close the real enquiry lifecycle with evidence.** Prioritise server-authoritative customer updates, booked/lost/handoff and minimum telemetry, then run the real provider across the non-fixture, multi-Business-Brain benchmark and execute the exact beta gate. Do not substitute UI simplification or test-count growth for this proof.

## Evidence and confidence

### Observed facts - high confidence

- `main` is at `52f15f3`, one product commit after the previous critique.
- The diff is limited to verified-email propagation, migration-ledger RLS/grants, dependency updates and related tests.
- Vercel reports deployment failure for the reviewed head; no pull-request workflow run is associated with it.
- `CURRENT_PHASE.md`, `PHASE_REGISTRY.md`, `AGENTS.project.md`, UI1 briefs, beta gate, telemetry spec and regression policy are unchanged.
- UI1 remains active; R2E/R2F remain prepared rather than authorised.
- The beta gate is 0/92; the public-traffic gate is 6/23.
- PRs #80 and #81 are open and are not part of current `main`.
- Local prototype actions remain for booked/lost-related outcomes.
- The latest checked-in real-provider benchmark evidence is incomplete.
- Connected Notion sources preserve the same enquiry-shape, Decision Object, deterministic-validation, human-authority and booked/lost thesis, but are stale and unverified.

### Implementation claims - medium confidence

- PR #82's local typecheck, lint, build, full-test and audit results.
- Manual production locking of `public._migrations`.
- PR #81's interaction and test measurements; it is unmerged and reports its own incomplete iPhone, 200% text and full-suite evidence.

### Inferences

- The sole weekly change reduces a real beta risk but does not make the product more complete against its core vision.
- A failed deployment means the live system may still be on the prior code, so neither the fix nor a regression can be assumed deployed.
- Continuing to advance founding access and large UI rewrites before authority and exact-head evidence are reconciled will increase integration and launch risk faster than confidence.

### Unknowns

- Root cause of the Vercel deployment failure and the last successfully deployed commit.
- Whether production is currently using the prior app build, whether the founding gate is on, and whether a confirmed user can onboard.
- Whether migration 0015 has been applied through the normal ledger, beyond the PR's manual-production claim.
- Whether `app_user.email` is correct for every existing production user.
- Whether PR #80 or #81 will be authorised, rebased, revised or closed.
- Real Anthropic interpretation quality across the non-fixture pack.
- Real-user cross-device continuity and server-persisted booked/lost/handoff behaviour.

## Implementation-agent handoff

Work from `docs/CURRENT_PHASE.md`; this critique grants no new phase authority.

1. Treat the failed deployment and the exact auth/migration paths touched by PR #82 as the immediate investigation boundary.
2. Capture the Vercel root cause and exact-head verification rather than adding adjacent fixes.
3. Do not merge PR #80 or #81 until authority is explicit and the branch is rebased onto current `main`.
4. For each live smoke test, record commit, environment, account state, expected result, observed result and rollback boundary.
5. Preserve confirmed-email trust, tenant checks, raw input, deterministic commercial authority and human-send semantics.
6. Do not add parser breadth, visual scope, payments or integrations as a substitute for closing the deployed, persisted enquiry lifecycle.
