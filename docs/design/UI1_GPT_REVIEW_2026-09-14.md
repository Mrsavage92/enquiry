# Original GPT Chat Review

Date: 2026-09-14. Requested by Adam; coordinated and received by Codex.

Source: https://chatgpt.com/c/6aa20b90-c690-83ec-af8b-b549fc7c2865

## Evidence Reviewed

The original design conversation received seven actual screenshots from `docs/evidence/ui1-review/recovery-2026-09-14/`: painting-built-desktop, painting-phone, painting-editor-390x400, today-desktop, today-phone, business-desktop and more-phone.

Runtime source: `2541180`. Banked recovery evidence: `f36453b`.
The reviewer was explicitly told these are synthetic local sample data, not live customers or proof of a production crew evaluator. It cannot access localhost. The request was for visual fidelity against the four original approved-direction boards, not a test-based sign-off. Known behavioural and release gaps were supplied separately.

## Received Verdict

The reviewer found the implementation materially closer to the boards. Today desktop/mobile, Business, full-page More and the short-height reply editor were judged close or appropriate. It recommended leaving their structure alone for this next visual slice.

The open enquiry remains the visual outlier:

1. The large What changed block precedes and outweighs the customer message.
2. The desktop right rail has oversized bordered evidence boxes and reads too much like a system/audit panel.
3. The desktop recommendation/reply surface is still too tall and visually expansive. The phone treatment is substantially better.

## Next Visual Slice: Open Enquiry Fidelity

- Compress the change summary into a strip, approximately 52-64px on desktop and 64-80px collapsed on phone, with full before/after information behind View changes. Retain meaningful changes in the collapsed summary. Acceptance: the latest customer message appears immediately after compact header/context and remains the visual subject.
- Flatten the desktop evidence rail into short reason/evidence rows, whitespace and one light divider. Remove individual outlined boxes. Keep full evidence reachable. Acceptance: the rail visibly recedes behind the conversation and action surface.
- Tighten the desktop reply surface by approximately 15-20%, using smaller gaps/padding, a shorter preview and a compact Read & edit reply row. Acceptance: message, proposed next step, material explanation and primary CTA read as one continuous workflow, not stacked oversized panels.
- Optional only: consider the board's mobile Add enquiry icon if the action is genuinely supported. Do not invent a capability for a visual match.

## Codex Reconciliation

This is peer design feedback, not new authority or owner acceptance. The original product and safety requirements still govern implementation.

- The review's illustrative shortened crew-rule wording is not authoritative business logic. Do not weaken the actual sample rule from a requirement to a possibility, omit its ceiling/notice conditions, or imply availability was checked. Preserve exact evidence and material blockers.
- Do not restore a sticky footer that obscures context. Maintain the verified normal-flow behaviour or prove any replacement cannot overlap content.
- Approximate heights and compression percentages are direction, not hard clipping limits for long text, zoom or accessibility.
- The prior post-recording presentation, attestation-focus, Settings wording, physical-device and hosted auth/beta findings remain open. Approval of screenshots does not resolve those unshown workflows.
- No additional app-wide redesign, marketing work, repository changes by the GPT reviewer, merge or deployment was requested or authorised.

This review-only turn changes documentation, not runtime source. The next implementation remains owned by Codex.
