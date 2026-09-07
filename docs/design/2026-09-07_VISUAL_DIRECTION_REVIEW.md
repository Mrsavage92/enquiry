# Enquiry - Visual direction review

Date: 2026-09-07 (Australia/Brisbane)
Reviewed source: `c7a0bc6a07af36e0ea13dfa32fdec25ad65f38d6`
Status: **DESIGN PROPOSAL ONLY. No visual implementation, phase change or release sign-off is authorised by this document. CC1 remains the active implementation slice.**

## Recommendation

Keep the forest-green identity, a restrained editorial voice and the light-first product. Reduce the sepia/paper treatment in the operator workspace, introduce cleaner white working surfaces, and make the next decision more visually dominant than the surrounding documentation.

The proposed direction is **warm precision**: a calm, capable working tool with personality, not a digital stationery set and not a generic glowing AI dashboard.

This is a design judgement to validate, not a claim that one hue converts better, green universally creates trust, or customers have already preferred it. Colour alone will not establish the product's differentiation.

Use [the controlled palette study](./2026-09-07_PALETTE_STUDY.html) to compare A (current core colours), B (recommended refined warm) and C (cool-neutral challenger) on the same illustrative layout. The study is not a screenshot of the current app. Its copy/send separation represents the intended truthful interaction, not evidence that CC1 has shipped.

## Evidence and limits

Read through the connected repository: `src/styles.css`, `src/routes/index.tsx`, `src/components/shell/app-shell.tsx`, `src/components/enquiry/conversation.tsx`, `src/components/ui/badge.tsx`, `src/domain/status-tone.ts`, the prior BridgeMind-inspired direction and the current product/correctness review context.

The live public page could not be opened in this review environment. The connector could list committed screenshots but its binary reads failed, and the direct public image route was unavailable. **No claim is made that the current deployed UI or those committed screenshot pixels were visually inspected.** Do not turn the findings below into production browser sign-off.

What was independently performed:

- WCAG relative-luminance calculations from the exact source colour tokens, including the opacity used on compact message timestamps.
- A locally rendered, standalone HTML study using three palettes on identical illustrative content and structure. Screenshots of that study were inspected.
- Study-only browser checks: all three palettes at 1440px; refined warm at 375, 390, 768 and 1024px; no page-level horizontal overflow in those checks; no page-script errors; evidence disclosure and clipboard-unavailable messaging passed.

The study uses a local IBM Plex font stack with system fallbacks, not downloaded fonts. It is not typography-fidelity evidence for the deployed product. Fictional names and enquiries are marked as sample data. It makes no network calls and is not wired to app state.

## 1. The palette is not fundamentally broken

The current source establishes a coherent warm palette:

| Role | Current source |
|---|---|
| Canvas / paper | `#F3EEE6` |
| Secondary paper | `#E7DFD3` |
| Raised surface | `#FAF7F1` |
| Primary ink | `#1A1814` |
| Secondary ink | `#4F4A42` |
| Muted / stone | `#716B61` |
| Brand / action | `#2F4A3C` |
| Dark sidebar | `#141210` |

The body uses IBM Plex Sans; the display and correspondence system also uses IBM Plex Serif, and some metadata uses IBM Plex Mono. This is already a more individual direction than replacing everything with a default sans font and blue primary button.

The main foreground pairs are strong: primary ink on paper calculates at 15.35:1, secondary ink at 7.61:1, and the primary-button foreground on forest at 8.69:1. The source does not support a blanket claim that the whole product is unreadable or that the forest green is the problem.

**Keep:** a light default, forest action colour, dark navigation as a bounded anchor, the serif wordmark/display option, restrained geometry and meaningful state-change motion.

## 2. Challenge the amount of paper, not merely the hue

The warm paper, darker beige, cream surfaces, ruled notebook treatment, grain and ledger language form a strong metaphor in the source. My judgement is that taking that metaphor too literally risks communicating 'organise your administration' more strongly than 'the next decision has already been prepared'.

This is especially worth questioning for a horizontal product. The design should suit a consultant or home-service operator as comfortably as a wedding supplier. That is a brand-fit hypothesis, not evidence that a particular industry dislikes beige.

Recommendation:

- Marketing may retain a warm editorial identity, large serif headings and a carefully bounded dark section.
- The operational workspace should use cleaner surfaces, clearer selection and quieter framing. Do not reproduce paper texture or document decoration around every piece of work.
- Preserve real information while making one task dominant: the decision, the missing fact, or the action awaiting the owner.
- Retain the existing light/dark relationship without turning the full product dark. Do not add gradients, glowing blobs, robot motifs or novelty effects to communicate intelligence.

The earlier `BRIDGEMIND_INSPIRED_UI_DIRECTION.md` calls the paper/notebook metaphor load-bearing identity. That documents a prior design choice, not customer validation that it is optimal. The user's new request explicitly reopens the assessment of colour/theme. Critiquing that choice does not authorise silently changing it.

The same prior document rejects product screenshots because of authenticity concerns. The stronger rule is to reject misleading screenshots. A captured, clearly labelled isolated demo is a legitimate way to show product behaviour; a fabricated customer account presented as live is not.

## 3. Hierarchy is a larger opportunity than repainting

`styles.css` defines `.eyebrow` and `.eyebrow-decision` at `0.6875rem`, with uppercase tracking and a green dot. At a 16px root that is 11px. `Badge` also uses `text-2xs`. Adding more labels and dots does not by itself create an obvious reading order.

Recommended hierarchy, to trial on the actual app rather than blindly apply globally:

1. The next decision or required action: the strongest element within the active case.
2. The customer request and facts that materially affect that decision.
3. The explanation and prepared response.
4. Audit, historical and administrative detail, available on demand.

Keep essential uncertainty visible before the action. Progressive disclosure must not hide a price conflict, unsupported service, stale decision or missing availability check just to make the card look clean.

Typography proposal: retain the existing family initially, use roughly 14-16px for routine work content, 12-13px for useful secondary labels and 20-24px for the main next-decision heading. These are proposed design defaults, not WCAG minimum-font-size requirements. Use sentence case for operational instructions; reserve uppercase eyebrows for genuine section labels. Do not add a decorative status-like dot to every label.

The illustrative study holds layout and typography constant across palettes. Its layout is not independently approved and must not be treated as a request to replace the existing three-pane desktop workflow.

## 4. Colour should distinguish action from outcome

The current `statusTone` maps 'Ready to quote', 'Booked' and 'Sent' to `ok`. Those labels are not equivalent events: one is readiness, the others are recorded outcomes.

The existing UI has text labels, so this is **not** a finding that these statuses rely on colour alone. It is a proposal to make their semantic difference easier to scan:

| Meaning | Suggested treatment |
|---|---|
| Primary action / current selection | Forest brand styling, plus an explicit label |
| Prepared, not yet performed | Neutral or restrained brand-outline styling; say 'Draft' or 'Ready for review' |
| Owner judgement / uncertainty | Amber plus a specific instruction or warning label |
| Confirmed completed outcome | Success treatment only when the authoritative state says it happened |
| Waiting | Quiet neutral/information treatment with who is responsible |
| Error / blocked unsafe action | Red plus explanation and recovery action |

Do not try to solve the copy-is-not-send defect with a different badge colour. CC1 owns the state correctness. This visual proposal must consume that truth, never manufacture it. Do not restyle a default Low confidence value into High confidence or imply that an unconfirmed quote is settled.

Green can be both the brand hue and part of success styling, provided labels, iconography and component treatment distinguish the meanings. A new blue accent solely to avoid that relationship is not automatically an improvement.

## 5. Specific contrast findings

Method: WCAG 2.2 sRGB relative luminance, `(Llighter + 0.05) / (Ldarker + 0.05)`. Ratios below are rounded for display only. Values were calculated from source, not sampled from anti-aliased screenshot pixels.

| Pair / source use | Calculated ratio | Interpretation |
|---|---:|---|
| Ink `#1A1814` on paper `#F3EEE6` | 15.35:1 | Strong body-text pair |
| Muted `#716B61` on paper | 4.57:1 | Passes 4.5:1 narrowly at full opacity |
| Muted on raised `#FAF7F1` | 4.94:1 | Passes 4.5:1 at full opacity |
| Muted on secondary paper `#E7DFD3` | 4.00:1 | Unsafe for normal text when this pair is used; do not infer a universal failure from token availability alone |
| `text-stone/80` timestamp on paper | 3.16:1 | Source-traced in compact/short message headings in `conversation.tsx`; below normal-text minimum |
| Forest `#2F4A3C` on sidebar `#141210` | 1.93:1 | Too weak for a sole necessary custom focus indicator; verify actual rendered cascade |
| Normal line `#E6DDD2` on raised | 1.26:1 | Fine as decorative separation; not enough as a sole necessary control boundary |
| Strong line `#CFC4B4` on raised | 1.61:1 | Same caveat; 'strong' does not guarantee sufficient control contrast |
| Button foreground `#F6F2EB` on forest | 8.69:1 | Strong primary-button pair |

The compact message timestamp is specifically a `text-stone/80` span nested in a message heading on the paper conversation surface. Alpha compositing yields approximately RGB `(139, 133.2, 123.6)` over paper and a ratio of 3.160791. Full-opacity stone passing does not prove this opacity variant passes.

The global `:focus-visible` rule uses forest; the inspected dark-sidebar links have no inverse focus override. The selected-nav inset also uses forest, although the selected item additionally changes its fill and foreground, so that stripe alone is not proof the whole selected-state cue fails.

Fix by defining focus colours by surrounding surface, avoiding reduced opacity on small operational text, and separating decorative-divider tokens from necessary-control-outline tokens. Do not make every separator dark to chase 3:1: WCAG non-text contrast is not a rule that all decorative borders must meet 3:1.

Also correct the prior design document's standards reference in a future authorised documentation pass: WCAG 2.2 **2.4.11 is Focus Not Obscured (Minimum), Level AA**. **2.4.13 is Focus Appearance, Level AAA**. Non-text contrast (1.4.11) is a separate criterion. Do not declare 'WCAG passed' from one foreground pair.

## 6. Recommended candidate palette

These are proposal values, not production CSS:

| Semantic role | Candidate B |
|---|---|
| Workspace canvas | `#F5F6F3` |
| Working surface | `#FFFFFF` |
| Subtle inset / neutral tag | `#EFF2EF` |
| Primary text | `#18221F` |
| Secondary text | `#4E5C56` |
| Muted text | `#5E6A63` |
| Forest action | `#245947` |
| Action hover | `#1B4939` |
| Action foreground | `#FFFFFF` |
| Selected light surface | `#EAF2ED` |
| Dark navigation | `#18231E` |
| Inverse secondary text | `#B7C2BB` |
| Focus on dark surfaces | `#9BDFC0` |
| Decorative divider | `#D8DEDA` |
| Necessary control outline | `#7A8780` |
| Warning / background | `#835500` / `#FFF3DB` |
| Success / background | `#236447` / `#EAF4ED` |
| Danger / background | `#AF302A` / `#FFF0ED` |

Calculated candidate examples: muted text is 5.21:1 on canvas, 5.65:1 on white and 5.01:1 on inset; action text is 8.09:1; necessary-control outline is 3.75:1 on white; inverse focus is 10.56:1 on dark navigation. These are pair-level checks, not whole-interface certification.

The canvas/surface contrast remains intentionally subtle, around 1.08:1, similar to the existing palette. The proposal's hierarchy is not magically produced by that small difference. It depends on explicit selection styling, spacing, typography, white work panels and context-appropriate boundaries. Do not claim the new whites alone create a dramatically stronger luminance hierarchy.

## 7. Compare three directions fairly

- **A: current colours.** The strongest continuity and warmest editorial character. My concern is an overly beige/document-like operational environment, not intrinsic ugliness.
- **B: refined warm, recommended.** Retains forest and the editorial brand while making the work surface cleaner and necessary interface details stronger. This is an evolution rather than a rebrand.
- **C: cool neutral.** `#F5F7FA` canvas, white panels, `#17202E` text, `#285ADB` action and `#17233B` navigation. A credible challenger, not a deliberately poor alternative. My judgement is that it reads more like conventional business software and loses some individuality.

Do not present these opinions as preference-test results. Do not add a full-dark or neon option as the default recommendation: neither addresses the core decision-hierarchy question, and both depart from the user's clean, non-AI-looking direction.

## 8. Public homepage: bring the differentiated proof closer

The inspected homepage source puts the headline, a substantial explanatory paragraph and a waitlist form before the cross-channel decision demonstration in the next section. It already has a dark phone-proof section later; do not invent a missing dark-section problem or add a duplicate.

Propose a first-screen test that makes one real product insight visible early: the request, the decision-critical ambiguity and the prepared next step. Use the existing isolated demo or a clearly labelled capture, not a false live tenant. Keep 'Stop managing enquiries.' as the headline unless the owner chooses otherwise.

The study's landing fragment illustrates this principle. It is not a finished homepage proposal, conversion claim or instruction to copy its exact copy/layout. Reorder or reduce only after comparing the actual responsive page, especially whether the proof remains legible on a phone. Adding another tiny full-dashboard screenshot is not useful proof.

## 9. Validation before implementation

Once the product owner approves a visual experiment, trial the chosen tokens on a separate preview branch against real current components. Do not overwrite the active correctness branch or activate a new visual phase automatically.

Use the same content for both variants, and assess the operator surface as well as the marketing page. Include: empty workspace, one unresolved enquiry, prepared quote, active rule conflict, unsupported service, availability unknown, copy-only state, confirmed external send, declined state, Business Brain and Trust. Preserve all uncertainty and real state semantics.

Check representative widths (375/390, 768, 1024 and 1440), zoom/reflow, keyboard focus on dark and light areas, reduced motion, long names, multi-line prices, and grayscale readability. Measure computed colours including opacity, hover, disabled and focus states rather than trusting token names. Do not treat a screenshot captured mid-fade as a static contrast failure.

For a small formative comparison with service-business owners, ask: 'What needs you?', 'What has already happened?', 'Who is waiting for whom?', and 'What will this button do?'. Observe accuracy and friction; do not choose solely from 'which is prettier?'. No user testing has been conducted for this proposal.

Approval should specify palette, semantic roles, typography/hierarchy changes and allowed screens. Implement a bounded sample, inspect it in a real browser, then expand. No logo redesign, new integration, global theme selector or dark-mode project is required to test this direction.

## Sources

Source references are for the reviewed commit, not a claim about later changes:

- `src/styles.css`, blob `a7b9149387793b427bb341cc756030a91219497c`: tokens, typography, fields, focus, notebook/grain and display styles.
- `src/components/shell/app-shell.tsx`: dark navigation, active state and mobile shell.
- `src/components/enquiry/conversation.tsx`: compact timestamp opacity and message presentation.
- `src/components/ui/badge.tsx`: badge sizing and tone pairs.
- `src/domain/status-tone.ts`: readiness/completed status grouping.
- `src/routes/index.tsx`: hero ordering, existing demo and dark phone-proof section.
- `docs/design/BRIDGEMIND_INSPIRED_UI_DIRECTION.md`: prior assumptions and rejected patterns.
- `AGENTS.project.md`: horizontal decision-layer positioning and truthfulness.
- `docs/CURRENT_PHASE.md`: CC1 execution authority, unchanged by this review.

Primary standards consulted on 2026-09-07:

- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html

## Decision summary

**Preferred direction: B, refined warm. Confidence: a reasoned design recommendation supported by source inspection and controlled colour specimens, not yet validated on the live app or with customers.**

Do not abandon the current identity merely to look newer. Do not defend every beige/ledger choice merely because a previous agent called it established. Keep the character; make the work clearer.
