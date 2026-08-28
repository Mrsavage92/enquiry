# Enquiry — First-Beta Telemetry + Evidence Spec

**Status:** PREPARED  
**Purpose:** Ensure the first five create useful behavioural evidence without mandatory interviews.

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# 1. Principle

Enquiry beta telemetry exists to answer:

- did the product understand the enquiry?
- was the recommended action right?
- what did the owner correct?
- did use repeat?
- did the enquiry progress?
- would the owner keep paying for this?

It is not a generic product-analytics project.

Do not send raw customer messages into a marketing analytics system to answer these questions.

---

# 2. Source-of-truth preference

Prefer evidence derivable from Enquiry's own product database/audit state.

Add a dedicated telemetry/event table only where the product records cannot reliably reconstruct the event.

Good sources:
- decision snapshots;
- fact supersession;
- audit events;
- message/outbound records;
- lifecycle;
- quote versions;
- booking;
- explicit review decision.

Avoid duplicating the same truth across many stores.

---

# 3. Minimum explicit review event

For each owner-reviewed recommendation, persist:

```ts
type RecommendationReview = {
  id: string
  businessId: string
  enquiryId: string
  decisionSnapshotVersion: string
  action: RecommendationAction
  outcome: "accepted" | "edited" | "rejected" | "deferred"
  editClass?: "voice_only" | "substantive"
  reasonCode?: BetaCorrectionCode
  at: string
  actorUserId: string
}
```

This may be its own table or an auditable structured event.

Do not infer "accepted" simply because the user opened/copied the draft.

---

# 4. Correction codes

Canonical first-beta codes:

- `fact_error`
- `inference_too_strong`
- `ambiguity_missed`
- `missing_fact_wrong`
- `minimum_blocker_wrong`
- `evaluator_wrongly_selected`
- `evaluator_omitted`
- `business_rule_wrong_or_stale`
- `recommendation_wrong`
- `action_authority_wrong`
- `voice_draft_only`
- `user_preference_not_defect`
- `integration_or_external_unknown`
- `other`

If the owner selects "Needs change", one lightweight reason prompt should be enough.

Do not force a long survey per enquiry.

---

# 5. Activation definitions

## Account created
Not activation.

## Onboarding complete
Not activation.

## First Decision Object
Useful technical milestone, but not enough.

## Beta activation
Define:

> A non-fixture enquiry reaches a reviewable Decision Object and the owner performs a meaningful review action.

Track:
- `first_real_enquiry_at`
- `first_review_at`
- `activated_at`

---

# 6. Recommendation quality

For each reviewed recommendation:

- accepted unchanged;
- edited substantively;
- rejected;
- deferred.

Metrics:

### Decision acceptance rate
accepted / (accepted + edited + rejected)

Exclude deferred/unreviewed.

### Assisted usefulness rate
(accepted + edited where owner still used the recommended action family) / reviewed

Only calculate if the edit classification supports it.

Do not publish these externally until denominators are meaningful.

---

# 7. Fact quality

Track:

- number of extracted live facts;
- user-confirmed without change;
- user-corrected;
- superseded by later customer update;
- inferred facts changed to unknown/ambiguous.

Useful internal metric:
> corrections per processed enquiry

Better diagnostic than one global model confidence score.

---

# 8. Evaluator quality

For each recommendation review/correction, allow classification:

- wrong evaluator selected;
- evaluator omitted;
- correct evaluator but rule wrong;
- correct evaluator but external source unknown;
- evaluator result correct.

This separates:
- model interpretation;
- rule setup;
- deterministic engine;
- integration availability.

Do not blame all failure on "AI accuracy".

---

# 9. Minimum blocker quality

Track when owner says the proposed question/blocker is wrong.

Possible result:
- blocker correct;
- blocker irrelevant;
- another fact mattered first;
- no question was needed;
- business-rule conflict should have been surfaced instead;
- multiple facts genuinely required.

This is strategically important differentiation evidence.

---

# 10. Business Brain evidence

Track:

- proposed rule;
- confirmed rule;
- rejected rule;
- corrected rule;
- high-impact rule confirmation;
- learning accepted/dismissed;
- "this enquiry only" vs "Teach Enquiry".

Beta questions:
- how often does Brain need correction?
- does setup stabilise?
- does the same correction recur after teaching?

---

# 11. Manual action evidence

Track truthfully:

- draft copied;
- owner marked response sent manually;
- follow-up sent manually;
- quote accepted externally;
- booking confirmed externally;
- decline sent manually.

Do not infer send from copy.

Do not call a manual external action "automated".

---

# 12. Lifecycle evidence

Per enquiry:

- created;
- waiting customer;
- waiting business;
- follow-up due;
- follow-up completed;
- booked;
- declined;
- lost;
- still open.

Silence is not automatically lost.

Useful cohort views:
- open → booked;
- open → declined;
- open → lost;
- open duration;
- follow-up recovered.

Do not call this a conversion funnel until product use/denominators support it.

---

# 13. Repeat-use definitions

For first five, define repeat use as:

> Same business processes a meaningful additional enquiry or meaningful later update in a later session/day without a bespoke founder walkthrough.

Track:
- active days;
- real enquiries processed;
- later updates processed;
- days between meaningful uses.

Do not use page views/logins as retention.

---

# 14. Time/effort evidence

Avoid fake precision.

Possible evidence:

### Product-instrumented
- time from opening enquiry to review decision;
- number of outside/manual checks explicitly recorded;
- number of questions drafted/used.

### Async self-report
At milestones:
- "What are you still checking outside Enquiry?"
- "Has this reduced work?" Yes / A little / No / Added work
- "If Enquiry disappeared, what would you go back to doing manually?"

Label self-report as self-report.

Do not market "X hours saved" unless actually measured defensibly.

---

# 15. WTP evidence

After repeated value:

- price shown;
- continue;
- decline;
- negotiate;
- reason.

Paid behaviour outranks survey responses.

Do not store speculative price preference as if it were purchase intent.

---

# 16. Event privacy

Event payload should contain identifiers/category fields, not raw message content.

Example safe fields:

```ts
{
  event: "recommendation_reviewed",
  businessId,
  enquiryId,
  action: "REQUEST_INFORMATION",
  outcome: "edited",
  reasonCode: "minimum_blocker_wrong",
  decisionVersion,
  at
}
```

Avoid:
- customer name;
- customer email;
- raw message;
- full draft;
- raw Business Brain document text

in generic telemetry.

---

# 17. Recommended first-beta event catalogue

## Acquisition/activation
- `workspace_created`
- `onboarding_completed`
- `real_enquiry_created`
- `decision_ready`
- `recommendation_reviewed`

## Corrections
- `fact_corrected`
- `brain_teach_proposed`
- `brain_rule_confirmed`
- `brain_rule_rejected`
- `minimum_blocker_corrected`

## Actions
- `draft_copied`
- `manual_response_recorded`
- `customer_update_recorded`
- `follow_up_due`
- `manual_follow_up_recorded`

## Outcome
- `enquiry_booked`
- `enquiry_declined`
- `enquiry_lost`

## Commercial
- `paid_offer_shown`
- `paid_offer_accepted`
- `paid_offer_declined`

Do not build every event before the phase that produces it.

---

# 18. Internal cohort readout

For each business:

| Measure | Value |
|---|---|
| Real enquiries processed | |
| Reviewed recommendations | |
| Accepted | |
| Edited | |
| Rejected | |
| Fact corrections | |
| Brain corrections | |
| Minimum-blocker corrections | |
| Booked | |
| Lost | |
| Declined | |
| Meaningful active days | |
| Paid offer | |
| Paid result | |

Aggregate across first five only with clear denominators.

---

# 19. Evidence thresholds

Do not define a universal PMF threshold yet.

Signals worth product-management attention:

### Serious concern
- recommendation rejection stays high after Brain setup;
- same rule correction repeats after being taught;
- arbitrary enquiries require manual reconstruction nearly every time;
- minimum blocker is often wrong;
- users stop after novelty.

### Promising
- owner increasingly accepts recommendation;
- corrections become configuration-specific rather than core-engine failures;
- users return independently;
- different verticals use same Decision Object mechanics;
- owner wants continued access enough to pay.

---

# 20. No interview dependency

This spec, together with lightweight milestone prompts, is sufficient to run first-beta learning asynchronously.

The founder does not need scheduled customer interviews to know whether Enquiry is working.
