# Enquiry Customer Roadmap

## Outcome And Authority

Adam requested a customer/investor-facing visual roadmap, not an AI implementation plan:
original GPT review first, image generation, critique/refinement, faithful implementation,
verification, then production publication. Date: 15 September 2026, Australia/Brisbane.
Codex owns delivery in `C:/Users/Adam/Documents/Codex/enquiry-ui1`, branch
`codex/ui1-customer-roadmap`, base `b44bb24`. No other agent has a source-editing lane.

## Independent Review

Original chat: **Enquiry Review - Visuals**, conversation
`6aa20b90-c690-83ec-af8b-b549fc7c2865`.

The direct task-message tool returned success but no message appeared in the chat. Codex
therefore delivered one consolidated brief through the original signed-in ChatGPT page and
verified its appearance and response. GPT reviewed repository source; it explicitly could not
render the Vercel pages. Codex separately inspected the live page and local implementation.

GPT's finding: the homepage already describes customer outcomes, but the six-stage roadmap
reads as an internal validation plan. Replace it with less to remember, fewer interruptions,
and a clearer journey from first interest to booked work. No numbered maturity ladder or
fictional dates. This is a recommendation, not whole-product acceptance.

## Direction

Four horizontal full-width bands, with three concise outcomes per band. Native details reveal
the longer explanation, material caveat and feedback controls. Preserve all horizons on mobile;
do not hide the future in a carousel. Attention-friendly structure is a product quality, not
a medical or accessibility-marketing claim.

| Horizon | Outcomes | Meaning |
| --- | --- | --- |
| Now | Know what needs you; Reply with context; Keep the outcome clear | Current product, invitation-only access |
| Next | One enquiry, wherever it starts; Enquiry in your pocket; Catch me up | Priority direction, not a claim of active development |
| Later | Follow-up that remembers; From yes to booked; Routine actions you allow | Planned direction |
| Exploring | Busy mode; Teach it by correcting it; Booked, then handed off | Not committed |

The commercial differentiation is coherent enquiry context across channels, attention-aware
catch-up, business-specific judgement and permission-scoped actions. Native apps are a useful
delivery surface, not a claim that mobile alone is unique. Continuity and catch-up precede
more extensive follow-up or action authority. Enquiry still stops at booked or lost.

## Image Review

GPT generated the initial board in the original chat. Codex rejected it: fabricated testimonial,
free-trial copy, generic CRM/payment/team features, false 'Next = In development', a fake
dashboard and a marketing hero that buried the roadmap. GPT explicitly agreed with that
critique and rejected its own first board as design authority.

Codex used the built-in GPT image editor (not CLI/fal) to create `roadmap-refined.png` from
that board. It follows the corrected strategy. Faithful implementation adaptations: real public
navigation; neutral near-black type; solid band colours instead of generated gradients; no
collapsible whole horizons; native keyboard-accessible disclosures; no invented dates or proof.
The final reference is not a screenshot of the implemented app.

The phone concept was separately generated with built-in GPT image generation, reviewed,
then resized and compressed to the deployed 600x400 WebP at
`public/product/roadmap/native-apps-concept.webp` (about 7 KB). It is explicitly labelled a
planned concept, not a screenshot of an available native app. No App Store badges are used.

## Final Prompt Specification

Edit the original roadmap mockup into a precise Enquiry roadmap UI, desktop and mobile.
White surface, soft lilac, Inter, near-black #1C1B1F, violet #654AC2, selective green/amber/rose.
Use the real navigation: How it works, Demo, Roadmap, Updates, Sign in, Join early access.
Compact H1: Enquiry roadmap. Supporting copy: Less to remember. More room for your business.
Our direction, not delivery dates. Early access by invitation. Four flat horizontal horizon
bands, horizon at left and three compact outcome nodes across, with the exact twelve titles
listed above. Short summaries and View details. Next means priority direction, not in
development. Small phone concept only for planned native iPhone and Android apps. Mobile
stacks the same bands and their expandable outcomes. No marketing hero, Kanban columns,
nested cards, testimonials, fake current-product screenshots, metrics, prices, dates, store
availability badges, gradients, or mascots. Bottom: Help shape what comes next / Join early access.

Phone asset prompt: two complete upright white modern phones, subtly offset, on a very pale
lilac field. Enquiry wordmark and abstract enquiry rows in lilac/mint/grey, no names, numbers,
metrics, send statuses, store logos or readable body copy. Concept illustration, not product
proof. The planned/not-available caption is real HTML outside the image.

## Preserved Contracts

Final independent screenshot review: GPT found the roadmap credible and aligned with the
corrected strategy. Three refinements were requested and implemented: larger desktop phone
concept (mobile remains compact), stronger supporting text, and the Next purpose changed to
"Less catching up. More staying current." This is bounded roadmap review, not beta acceptance.

- Existing feature IDs and legacy aliases retain their meaning; six new IDs are allowlisted.
- Existing server functions persist interest, feedback and attribution; no schema migration.
- Interest can be recorded anonymously per existing session contract. Joining early access
  remains an explicit separate action, never implied by a vote.
- Error paths do not announce success. Votes survive reload and can be removed.
- Product boundaries remain visible in outcome details; native availability has an always-visible label.
- No production integration, automatic sending, auth change or future feature implementation.
