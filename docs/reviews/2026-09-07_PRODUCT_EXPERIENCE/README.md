# Enquiry - Ten-area product and experience review

Review date: 2026-09-07 (Australia/Brisbane)  
Reviewed application source: `79de089b2fe3f79efec14795eb340cf047bdb67a`

**Review complete across the ten requested areas at source level. Not a full runtime, security or beta-readiness sign-off.**

## Executive decision
The strongest next investment is consistency between the screen, the stored business state and the actions actually performed. The product's front half has meaningful server-backed implementation, but the post-quote journey, generic fact correction and natural-language Brain actions still expose prototype-only paths.

Keep the architecture and the manual-first beta. Do not start a rewrite, another design system or a broad integration programme. Finish the active CC1 correction and then authorise bounded follow-on work from this review. Palette B remains a proposal, not an approved visual phase.

## Execution authority
`docs/CURRENT_PHASE.md` is unchanged: CC1 is the active slice. This folder is an independent review, not a command to execute ten new phases. Reproduce findings against the actual implementation branch; preserve unrelated work. Dependencies and proposed ordering below do not imply sign-off, merge or deployment permission.

## The ten reviews

| Area | Review | Main result |
|---|---|---|
| 1 | [Operator journey](./01_OPERATOR_JOURNEY.md) | Post-quote outcomes and generic fact correction need the same server truth as intake. |
| 2 | [Business Brain and Trust](./02_BUSINESS_BRAIN_AND_TRUST.md) | Natural-language teaching and typed rule entry use different authority paths. |
| 3 | [Onboarding / first value](./03_ONBOARDING_FIRST_VALUE.md) | Keep the two-stage setup; make the next manual value-producing action explicit. |
| 4 | [Mobile](./04_MOBILE_AND_RESPONSIVE.md) | A ready follow-up lacks a phone send trigger; test intermediate widths and task parity. |
| 5 | [Failure / uncertainty](./05_EMPTY_FAILURE_UNCERTAINTY.md) | Partial success and optimistic failures can misrepresent what was saved. |
| 6 | [Language](./06_LANGUAGE_SYSTEM.md) | Labels must distinguish prepared, sent, accepted, booked, paid and handed off. |
| 7 | [Homepage / proof](./07_HOMEPAGE_POSITIONING_PROOF.md) | Interactive proof shares live cache; isolate it and clarify current versus demonstrated capability. |
| 8 | [Information architecture](./08_INFORMATION_ARCHITECTURE.md) | Remove unsupported dead ends; validate task/context parity rather than adding destinations. |
| 9 | [Beta measurement](./09_BETA_MEASUREMENT.md) | Implement the existing review-evidence contract and correct misleading bar/time calculations. |
| 10 | [Security / privacy](./10_SECURITY_PRIVACY_TENANCY.md) | Correct the privacy mismatch; verify identity-bound cache, tenant denial and model provenance. |

## Prioritised findings

P1 means important before the relevant real-customer beta path is accepted. It does not mean a security exploit has been demonstrated. 'Verify' identifies a risk that needs a runtime test rather than an established incident.

| ID | Priority / evidence | Required outcome |
|---|---|---|
| J1 | P1 / source trace | Durable owner-reported outcomes; no fabricated customer or booking messages. |
| J2 | P1 / source trace | Every live fact-edit control persists and re-evaluates through one safe path. |
| B1 | P1 / source trace | One supported, persisted Brain proposal/confirmation pipeline; no heuristic policy invention. |
| B2 | P1 save truth; P2 capability UX / source trace | Failed trust saves cannot look applied; preferences cannot impersonate available automation. |
| E1 | P1 / source trace, fault test needed | Distinguish committed write from failed refresh; retry safely without duplicate intake. |
| H1 | P1 / source trace, browser test needed | Marketing examples never consume or mutate a live operator store. |
| S1 | P1 / source mismatch | Privacy copy matches actual server storage and configured provider processing. |
| M1 | P1 for mobile beta / source branches | Ready follow-up has a usable mobile action with CC1 semantics. |
| S2 | Verify before beta / source risk | Purge/refetch workspace by actual identity; prove revocation and stale-response handling. |
| O1 | P2 / source plus UX hypothesis | Empty setup leads to one useful review, not waiting for an unconnected inbox. |
| O2 | P2 / source trace | Phone and email are stored under the correct contact type. |
| M2 | P2 / responsive verification risk | Raw request and primary action remain reachable across all breakpoint bands. |
| E2 | P2 / source and recovery review | Distinguish empty, filtered, inaccessible, unsupported and failed reading states. |
| L1 | P2; truthful events P1 / vocabulary proposal | One state-based vocabulary across UI, audit and metrics. |
| I1-I2 | P2 / source and IA hypothesis | Task/context parity and no offered-but-blocked customer sharing link. |
| T1 | Beta evidence gate / prepared spec vs implementation | Durable versioned reviews, correction reasons and non-fixture repeat-use evidence. |
| T2 | P2 / source | Real zero bars, actual reporting period, event-based waiting age. |
| S3 | P2 / source plus bounded probes | Check model provenance; keep unsafe legacy acceptance heuristics out of real automation. |

## Proposed sequence after CC1
1. Contain public-demo/live-state sharing and correct privacy/capability disclosures before deliberate external use. Independently verify identity/tenancy risks rather than declaring them fixed from a checklist.
2. Complete the persisted operator journey and Brain correction paths, including failure receipts, owner-reported outcomes and no synthetic live dialogue.
3. Prove first-use and mobile task completion, and implement the minimum beta review evidence alongside those authoritative events.
4. Refine vocabulary, navigation and public proof against the confirmed capability. Trial the visual proposal only on an authorised preview branch.

A newly demonstrated immediate security incident would require separate containment; none was demonstrated in this review. Do not silently broaden CC1 from these recommendations.

## Evidence
[Evidence and limitations](./EVIDENCE.md) records the source inventory and executed probes. A full checkout failed because GitHub hostname resolution was unavailable in the container. The connected GitHub reads worked. The live public page could not be opened. No full app build, full suite, device/browser flow or two-tenant penetration test was run.

Two hash-verified isolated modules were tested: 12 diagnostic cases, 7 pass and 5 fail. These test narrow public-link and demo-parser behaviour, not release readiness. The parser failures are explicitly not claimed as live automated booking defects.

## Handoff rule
For any authorised follow-on slice, provide: baseline and head commits; affected live and demo controls; regression tests; exact commands and failures; browser evidence where needed; confirmed versus blocked outcomes; remaining risks. The implementer does not self-certify beta release. Keep secrets and real customer data out of this public review trail.
