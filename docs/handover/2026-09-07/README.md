# Enquiry - master handover for 7 September 2026

Repository: `Mrsavage92/enquiry`  
Branch: `main`  
Verified head before this handover: `41d9d3371a5fa9a2a29552faea2506f65080dd4d`  
Scope: the Enquiry reviews, implementation package, visual study and pre-launch planning produced in this conversation on 7 September 2026 (Australia/Brisbane).

**Start here, then follow the actual execution authority. This is an index and handover, not a new implementation phase or release approval.**

## 1. What is authorised and what is not

| Workstream | Status at handover | Instruction |
|---|---|---|
| CC1 commercial correctness | Authorised for implementation; not fixed or independently signed off by these documents | Follow the CC1 package on an implementation branch, test and return for review. |
| Ten-area product/experience review | Findings and proposed follow-on work | Read for risk/context. Do not silently add every finding to CC1. |
| Visual direction | Palette B is recommended, not approved or applied | Compare the study. No production styling change is authorised here. |
| Pre-launch/waitlist strategy | Recommendation and draft public copy | Prepare the next bounded public-funnel implementation proposal. Do not activate an offer or send traffic before the relevant checks. |
| First announcement | Latest user-edited Default is preserved, with Short and Teaser alternatives | Use the Default when public copy is approved; do not publish the placeholder or claim the list is open before verification. |

The **20% ongoing early-supporter discount is a proposal**, not an approved or active offer. The **10,000 subscriber figure is an ambition**, not a forecast or existing count. Free invited beta is proposed; it is not a promise of immediate access to every subscriber.

The latest user-edited announcement in [FIRST_ANNOUNCEMENT_DRAFTS.md](./FIRST_ANNOUNCEMENT_DRAFTS.md) takes precedence over the older assistant-written announcement in section "First announcement" of the preserved [pre-launch brief](./ENQUIRY_PRELAUNCH_DECISION_BRIEF_2026-09-07.md). The brief's release, truthfulness and approval conditions still apply.

## 2. Read order for the implementation agent

1. [Project contract](../../../AGENTS.project.md) and applicable repository agent instructions.
2. [Current implementation authority](../../CURRENT_PHASE.md).
3. [CC1 implementation package](../../implementation/CC1_COMMERCIAL_CORRECTNESS/README.md), including its acceptance matrix, evidence, probes and handoff template.
4. [Original commercial-correctness review](../../reviews/2026-09-07_COMMERCIAL_CORRECTNESS_REVIEW.md).
5. [Ten-area review index](../../reviews/2026-09-07_PRODUCT_EXPERIENCE/README.md) and the relevant detailed review when it affects the current path.
6. [Visual review](../../design/2026-09-07_VISUAL_DIRECTION_REVIEW.md), [palette study](../../design/2026-09-07_PALETTE_STUDY.html), [pre-launch brief](./ENQUIRY_PRELAUNCH_DECISION_BRIEF_2026-09-07.md) and [latest announcement drafts](./FIRST_ANNOUNCEMENT_DRAFTS.md) as proposed future work, not authority to implement them.

Existing supporting documents, not authored or changed by today's review work:

- `docs/TEST_REGRESSION_POLICY.md`
- `docs/BETA_READINESS_GATE.md`
- `docs/PUBLIC_TRAFFIC_GATE.md`
- `docs/BETA_TELEMETRY_SPEC.md`
- `AGENTS.project.md`

Read gates against current source and evidence. Historical checked boxes and phase names are not fresh verification. Do not reopen old R2A-only instructions archived under `docs/history/`.

## 3. Exact repository file inventory

All paths are relative to the repository root. This inventory is exhaustive for the 27 paths changed by the five earlier commits in this conversation plus the three files added by this handover. It is not a list of every pre-existing project document.

```text
docs/
  CURRENT_PHASE.md                                  [modified]
  PHASE_REGISTRY.md                                 [modified]
  history/
    2026-09-07_CURRENT_PHASE_PRE_CC1.md              [added, historical snapshot]
    2026-09-07_PHASE_REGISTRY_PRE_CC1.md             [added, historical snapshot]
  reviews/
    2026-09-07_COMMERCIAL_CORRECTNESS_REVIEW.md       [added]
    2026-09-07_PRODUCT_EXPERIENCE/
      README.md                                    [added]
      01_OPERATOR_JOURNEY.md                        [added]
      02_BUSINESS_BRAIN_AND_TRUST.md                 [added]
      03_ONBOARDING_FIRST_VALUE.md                  [added]
      04_MOBILE_AND_RESPONSIVE.md                   [added]
      05_EMPTY_FAILURE_UNCERTAINTY.md               [added]
      06_LANGUAGE_SYSTEM.md                        [added]
      07_HOMEPAGE_POSITIONING_PROOF.md              [added]
      08_INFORMATION_ARCHITECTURE.md                [added]
      09_BETA_MEASUREMENT.md                        [added]
      10_SECURITY_PRIVACY_TENANCY.md                [added]
      EVIDENCE.md                                  [added]
      probes/review.probe.ts                        [added, diagnostic seed]
  implementation/
    CC1_COMMERCIAL_CORRECTNESS/
      README.md                                    [added]
      CLAUDE_PROMPT.md                              [added]
      ACCEPTANCE.md                                [added]
      HANDOFF_TEMPLATE.md                          [added]
      evidence/BASELINE.md                          [added]
      evidence/baseline-results.json                [added]
      probes/price-safety.probe.ts                  [added, diagnostic seed]
  design/
    2026-09-07_VISUAL_DIRECTION_REVIEW.md             [added, proposal]
    2026-09-07_PALETTE_STUDY.html                     [added, standalone study]
  handover/
    2026-09-07/
      README.md                                    [added in this handover]
      ENQUIRY_PRELAUNCH_DECISION_BRIEF_2026-09-07.md [added in this handover]
      FIRST_ANNOUNCEMENT_DRAFTS.md                   [added in this handover]
```

Summary after this handover: **30 repository paths: 28 additions and 2 modifications. All are under `docs/`.** The standalone HTML and diagnostic TypeScript files are review assets, not changes to the running application or its default test discovery.

## 4. What was changed, by commit

| Commit | Actual change |
|---|---|
| `fb58a02b1a7675621529e0c3a548b9151b349b79` | Added the commercial-correctness review, five P1 findings, consistency/evidence risks and pricing reproduction appendix. No application fixes. |
| `c7a0bc6a07af36e0ea13dfa32fdec25ad65f38d6` | Added the seven-file CC1 implementation package. Updated CURRENT_PHASE and PHASE_REGISTRY to authorise only CC1 and reconcile contradictory old instructions. Preserved both prior documents under history. Eleven paths affected. |
| `0257ada41b766fed97df5f206b41669905d33846` | Added the visual-direction review, colour/contrast analysis and recommended refined-warm palette. No production CSS change. |
| `79de089b2fe3f79efec14795eb340cf047bdb67a` | Added the standalone three-palette HTML study with fictional data. No application route or global theme change. |
| `41d9d3371a5fa9a2a29552faea2506f65080dd4d` | Added ten detailed product/experience reviews, an index, evidence notes and a diagnostic probe. Thirteen new files. CC1 remained active. |
| This handover commit, identified by this file's Git history | Added this index, the previously conversation-only pre-launch brief and the latest user-edited announcement options. Three new documents only. |

Compare the earlier work against `6eba9a4cee9759cad54d891e8e7515fe438b1c8b`. The verified comparison through `41d9d337` contains five commits and 27 changed documentation/review paths. The handover commit adds the remaining three paths without changing those 27.

## 5. What was NOT changed or done

- No files under `src/`, application styles, routes or business logic were changed by this review/handover work.
- No database migrations, dependency manifests, production data, auth settings, credentials or deployment configuration were changed.
- No CC1 defects were implemented or signed off by this assistant's documentation commits.
- No visual proposal was applied to the live product.
- No public-traffic or beta gate was marked passed by these reviews.
- No social post, newsletter, discount, beta invitation, directory submission or paid promotion was published or activated.
- No separate Claude or Codex implementation session was launched by creating this package.
- No full application build, full regression suite, live provider benchmark, end-to-end customer flow or two-tenant penetration test was newly performed for this handover.

Documentation pushed to `main` may trigger the repository's existing deployment automation. No deploy command or configuration change was requested by this handover; do not interpret a deployment success as product-test evidence.

## 6. Evidence to retain with the handover

The conversation download bundle contains the original attachments, unchanged:

| Downloadable file | Purpose / relationship to GitHub |
|---|---|
| `Enquiry_Review_Evidence_2026-09-07.zip` | Byte-checked isolated pricing sources, original-test output, failing safety probes and source-integrity manifest. The GitHub CC1 evidence files summarise this; the ZIP is a separate attachment. |
| `Enquiry_Ten_Area_Review_2026-09-07.zip` | Offline review-package snapshot plus isolated public-link/reply-parser tests, results and hashes. The current authoritative review documents are under `docs/reviews/2026-09-07_PRODUCT_EXPERIENCE/`. |
| `palette-comparison.png` | Side-by-side illustrative colour comparison, not a capture of the deployed app. Conversation attachment; not added to GitHub by this handover. |
| `palette-study.html` | Downloadable interactive study. The committed counterpart is `docs/design/2026-09-07_PALETTE_STUDY.html`; these are separate exported snapshots and should not be assumed byte-identical. |
| `ENQUIRY_PRELAUNCH_DECISION_BRIEF_2026-09-07.md` | The original decision brief, now also preserved in this handover directory. Strategy and offer remain proposed. |

Recorded results from the earlier reviews, not a new full-suite run:

- Pricing: 14 original tests passed; six added safety assertions failed on the reviewed source, exposing three defect families. These results refer to source at `6eba9a4`.
- Product review diagnostics: 12 cases, seven passed and five failed, against two isolated hash-verified modules. The parser failures are not claimed as five live automated-booking incidents. The review baseline is `79de089b`.
- Visual study: source-level contrast analysis and checks of a locally rendered standalone study. Not a visual sign-off of the deployed application.

The download bundle is an attachment/evidence companion plus the master index. It is **not a full repository checkout**. Clone or open `Mrsavage92/enquiry` for the complete implementation package, current source and all linked baseline documents. Do not copy isolated historical source into the working app as an implementation patch.

## 7. Copy-paste Claude handover

```text
Work in Mrsavage92/enquiry.

Read docs/handover/2026-09-07/README.md first, then AGENTS.project.md,
applicable repository agent instructions and docs/CURRENT_PHASE.md.
Inspect current HEAD and uncommitted work; do not reset or overwrite another agent's changes.

CC1 is the only authorised implementation slice. Follow
 docs/implementation/CC1_COMMERCIAL_CORRECTNESS/CLAUDE_PROMPT.md
and its README, ACCEPTANCE.md, evidence and HANDOFF_TEMPLATE.md.
Reproduce the findings on the actual branch before changing code. Implement
CC1's full bounded scope on a review branch, add regression tests, run the
required checks, and provide exact implemented/verified/blocked results.
Do not auto-merge, deploy, change production data or self-sign-off.

Read the ten-area review for follow-on risks, but do not silently add them all
to CC1. Palette B and the pre-launch strategy are proposals. Do not activate
the 20% offer, launch campaign, beta access or visual redesign without their
own approval. The first post's current user-edited Default is in
 docs/handover/2026-09-07/FIRST_ANNOUNCEMENT_DRAFTS.md;
it supersedes the older draft inside the pre-launch brief.

After CC1, return a review-ready branch/PR and evidence. Identify the next
small public-waitlist readiness package separately, covering the signup/email
journey, privacy, demo isolation, truthful claims, offer recording and the
open public-traffic gate. Do not begin that package automatically.
```

## 8. Best next management decision

Complete and independently review CC1. In parallel, prepare the smallest public-waitlist readiness proposal so audience building is not postponed until the full product is finished. Preparation is not release approval. The product owner still needs to approve the exact early-supporter terms and any visual implementation. Keep the first public announcement short and use the latest user-edited copy rather than reverting to an earlier assistant draft.
