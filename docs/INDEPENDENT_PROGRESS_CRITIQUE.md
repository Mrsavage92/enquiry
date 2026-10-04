# Independent Progress Critique

**Review date:** 2026-10-05  
**Default branch reviewed:** `main`  
**Commit reviewed:** [`d9651c5`](https://github.com/Mrsavage92/enquiry/commit/d9651c5a111a864838a0601ce6557d6ef233f74c)  
**Previous review baseline:** [`26db253`](https://github.com/Mrsavage92/enquiry/commit/26db253)  
**Change span:** 24 commits on `main`  
**Execution authority:** [`docs/CURRENT_PHASE.md`](./CURRENT_PHASE.md) remains authoritative. This critique does not authorise work or sign off a phase.

## Verdict against the enquiry-to-booking vision

There is substantial real product progress in the middle of the vision:

> messy inbound enquiry -> understood Enquiry Decision Object -> relevant business checks -> minimum decision blocker -> explainable next action -> human-authorised action -> booked or lost -> downstream handoff

The current product is materially stronger at deterministic interpretation, owner-rule evaluation, identifying the next blocker, explaining what was checked, and keeping outbound actions under human control. Two-business isolation tests, server-backed resume/drafts/preferences, persisted decline, send undo, price redecision, coverage confirmation, an asked-items ledger, and editable owner facts are meaningful product and first-beta work. This is not merely visual or documentation activity.

However, `main` is **not yet a safe first-beta candidate**. The loop still breaks near its end: booked/lost, accepted-quote, and customer-update flows remain local-store behaviour rather than demonstrated server-authoritative outcomes and handoff. Real-provider interpretation quality, production migrations, production auth, cross-device continuity, and exact-head tenant isolation are not evidenced. All 92 items in the beta gate remain unchecked. Open PR [#80](https://github.com/Mrsavage92/enquiry/pull/80) also reports known customer-trust failures on current `main`, including a reviewed-send conflict after keeping an edit, app-authored availability promises, incomplete closed-date checking, and omitted ledger items.

The most urgent issue is governance. Twenty-four commits containing deep decision-engine, persistence, commercial, and dormant Stripe work landed while `CURRENT_PHASE.md` and `PHASE_REGISTRY.md` still identify UI1 as the only authorised slice, explicitly defer R2E/R2F, and exclude a production payment-integration programme. The implementation may be directionally useful, but the repository no longer has a reliable statement of what work was authorised or what evidence closes it.

## What materially moved

### Real product progress

- **Messy inbound and Decision Object:** deterministic readers now cover more natural date, service, item, quantity, question, and pricing expressions. Decisions retain richer asked-item, date, check, and pricing context. Raw-first and deterministic validation principles remain intact.
- **Relevant checks and minimum blocker:** coverage confirmation now gates totals; owner pricing and availability changes can re-decide open enquiries; closed-day, tiered-price, dropped-item, date-role, and service-count checks are stronger.
- **Explainable next action:** the asked ledger, day-role labels, stable check counter, concrete follow-up timing, and calmer one-step UI make the reason for the next action clearer.
- **Human-authorised action:** reviewed send, server-backed undo, persisted decline, and explicit practice-enquiry boundaries are meaningful safety improvements.
- **Tenant safety:** commit [`c394e89`](https://github.com/Mrsavage92/enquiry/commit/c394e89) added two-business PGlite isolation tests across membership, business, enquiry, workspace, and mutation conditions.
- **Continuity:** migrations and application changes add server-backed reply drafts, workspace preferences, last-seen state, and resume behaviour.

### Partial progress

- **Booked or lost:** decline is server-persisted, but `markLost`, `acceptQuote`, `receiveClientReply`, and `confirmExternalBooking` still exist as prototype-store actions without equivalent demonstrated server-authoritative completion.
- **Arbitrary enquiry interpretation:** deterministic coverage improved, but no checked-in result shows the non-fixture evaluation pack running with the real provider across multiple Business Brains.
- **Beta operations:** alert fallback has a repository handover claim, but production migration application, real signed-in cross-device resume, and full exact-head beta verification remain unknown.

### No material movement evidenced

- Downstream booked/lost handoff.
- Implemented recommendation-review and outcome telemetry.
- A completed, checked-in non-fixture provider benchmark.
- Closing any item in `docs/BETA_READINESS_GATE.md`.
- Closing the public-traffic gate.

## Important decisions and contradictions

1. **Coverage before money:** the product now requires explicit coverage confirmation before a total can be sent. This is aligned with the vision and reduces confident but incomplete quotes.
2. **Owner facts can change:** editable and retired business facts trigger redecision of open enquiries. This is correct in principle; production transaction behaviour still needs exact-head evidence.
3. **ADHD-first interaction:** one clear next action, server resume, a practice enquiry, stable progress language, and pinned send actions support low-cognitive-load use.
4. **Commercial offer changed in code:** the public offer now uses A$15/month for as long as subscribed, with A$29 standard pricing and a first-month refund. The earlier growth handover still says free early access, 30% off for 12 months, and explicitly rejects “forever” pricing. Source and documentation currently disagree.
5. **Dormant Stripe path added:** a webhook, founding-member persistence, and a disabled gate were added even though current phase authority excludes a production payment-integration programme. A disabled path is lower operational risk, but it is still scope and governance drift.
6. **UI1 authority was not reconciled:** current phase documents still describe the September UI1 slice and do not account for the subsequent decision, persistence, trust, or commercial work.

## Blockers

| Blocker | Evidence type | Why it matters |
|---|---|---|
| Current authority does not match landed work | Observed | Reviewers and agents cannot tell which slice is valid, what acceptance criteria apply, or whether later work is allowed. |
| Known trust defects remain on `main` | Implementation-review claim in open PR #80 | A send conflict, app-authored promises, incomplete date checking, and ledger omissions can create customer-facing harm. |
| Outcome loop is not server-authoritative end to end | Observed in current source | The vision cannot yet reliably reach booked/lost and downstream handoff across reloads and devices. |
| Production migrations and signed-in continuity are unverified | Unknown; PR #62 explicitly left owner application and live cross-device proof outstanding | A successful deployment does not prove the database schema or real account path works. |
| Provider-backed non-fixture quality is unmeasured | Observed absence of a result artifact | Parser breadth does not prove robust interpretation of genuinely messy enquiries. |
| Beta and public gates remain open | Observed | There is no evidence-based release decision despite substantial implementation activity. |
| Commercial source of truth conflicts | Observed | Founding-customer expectations, payment readiness, and public claims can diverge. |
| Credential revocation remains open | Repository handover claim | Public traffic should not start while a known exposed credential remains unresolved. |

## Milestone risk

| Area | Risk | Trend | Evidence |
|---|---|---|---|
| Core decision product | High | Improving | More real business rules, blockers, explanations, and redecision behaviour landed. |
| Safe first beta | High | Mixed | Persistence and tenancy improved, but all beta-gate checks are open and current `main` has reported trust defects. |
| Governance and sequencing | Critical | Worsening | Twenty-four commits crossed deferred R2E/R2F and payment boundaries without an authority update. |
| Commercial launch | High | Worsening | Public offer code, growth handover, payment readiness, and traffic gate disagree. |
| Cross-industry thesis | Medium-high | Slightly improving | Rule breadth expanded, but real-provider and multi-brain evidence is still absent. |
| Booked/lost handoff | High | Flat | Decline moved server-side; the broader outcome and handoff loop did not. |

## Next three priorities

1. **Reconcile authority before more scope lands.** Treat `CURRENT_PHASE.md` as the stop line. The product owner should explicitly decide whether the trust, persistence, R2E/R2F-adjacent, and payment work is accepted into the active slice; align the registry and commercial source of truth; and decide the disposition of PR #80. This critique does not make that authority change.
2. **Produce one exact-head beta-candidate evidence ledger.** After the PR #80 decision, apply all required migrations and verify the exact candidate through full tests, typecheck, lint, build, production auth, two-tenant read/write isolation, arbitrary non-fixture input, reload/cross-device resume, and absence of app-authored promises. Record failures as failures rather than relying on PR summaries or deployment status.
3. **Complete and measure the real loop.** Make customer updates and booked/lost/handoff server-authoritative, add the minimum review/outcome telemetry, then run the real provider against the non-fixture pack across multiple Business Brains. Do not claim early-access readiness until this evidence exists.

## Evidence and confidence

### Observed facts - high confidence

- `main` is at `d9651c5`, 24 commits beyond the previous critique baseline.
- Current phase and registry still identify UI1 as active and R2E/R2F as prepared but not authorised.
- The beta-readiness gate contains 92 unchecked items and no checked items.
- Server-backed persistence, isolation tests, decision rules, UI trust work, and migrations materially expanded.
- Several outcome actions remain in the prototype store.
- The checked-in non-fixture pack has no corresponding current result artifact.
- The public-traffic gate remains open.
- The code-level founding offer conflicts with the September growth handover.

### Implementation claims - medium confidence

- Merged PRs report clean typecheck, lint, build, and increasing test counts, reaching 1,281 tests on current `main` according to PR #80.
- PR #80 reports a 37/52 independent trust score for current `main` and identifies the specific defects listed above.
- The alert fallback is described as live and test-delivered in the launch handover.

These claims are useful evidence but are not equivalent to independent exact-head CI or production verification. GitHub shows a successful Vercel status for the reviewed commit but no associated GitHub Actions workflow run.

### Inferences

- The product is closer to the intended decision layer, not merely a nicer demo.
- The next risk is less “can it express business-specific logic?” and more “can it preserve truth and authority through real accounts, real provider output, correction, outcome, and handoff?”
- Continuing trust passes without closing gates and reconciling authority will increase change volume faster than confidence.

### Unknowns

- Whether migrations 0008-0012 and required grants are applied in production.
- Whether production Anthropic configuration produces acceptable interpretations.
- Whether real signed-in users can resume correctly across phone, laptop, reload, and tenancy boundaries.
- Whether the current offer and Stripe path are intentionally approved.
- Whether PR #80 will be merged, revised, or rejected.
- Whether early users can complete booked/lost and downstream handoff without local-only state.

## Implementation-agent handoff

Work only from the active authority in `docs/CURRENT_PHASE.md`. Do not interpret this critique as permission to advance phases.

Before changing more product behaviour:

1. Resolve or explicitly defer each current-`main` defect documented by PR #80.
2. Tie every fix to an exact acceptance criterion and a test that fails on the reviewed head.
3. Avoid new parser breadth, visual polish, payment work, or integrations until authority is reconciled.
4. Preserve raw input, tenant checks, deterministic commercial validation, explicit uncertainty, and human send authority.
5. For outcome work, replace local-only completion with tenant-checked server state and prove reload/cross-device continuity.
6. Leave an evidence trail that another agent can reproduce from the exact commit: command results, migration state, environment boundary, test case, and observed result.
