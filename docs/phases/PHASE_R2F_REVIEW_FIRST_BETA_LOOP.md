# R2F — Review-First Manual Action Loop + Beta Telemetry

**Status:** PREPARED — NOT AUTHORISED UNTIL `docs/CURRENT_PHASE.md` ACTIVATES R2F

R2F is the sixth slice of:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting:

- `docs/BETA_READINESS_GATE.md`
- `docs/R2_DECISION_ENGINE_REVIEW.md`

R2F begins only after R2E is signed off.

---

# Objective

Complete one truthful first-beta enquiry loop without pretending production channel/payment/booking integrations exist.

Target:

> paste/manual enquiry  
> → Enquiry interprets + validates  
> → prepares next action/draft  
> → owner reviews/corrects  
> → owner acts externally/manual where needed  
> → Enquiry records what actually happened  
> → later customer update is added  
> → Decision Object recompiles  
> → booked/lost/handoff  
> → useful beta evidence is captured

---

# Product invariant

> **Prepared is not sent. Recommended is not authorised. Recorded is not performed by Enquiry.**

The UI and audit language must distinguish:

- Enquiry prepared;
- owner approved;
- owner copied/used;
- owner confirms it was sent externally;
- Enquiry itself sent via a genuine connected provider.

For first beta, the last category may be absent.

---

# 1. Review action states

For every prepared recommendation, capture one of:

### Accepted unchanged
The business decision/action is accepted without substantive change.

Tone-only edits do not count as a rejected decision.

### Substantively edited
The owner still uses the prepared action, but changes:
- requested missing fact;
- commercial/eligibility decision;
- scope;
- recommendation;
- material wording that changes commitment.

### Rejected
Owner chooses a materially different next action.

### Deferred
Owner intentionally leaves it for later; do not treat as acceptance/rejection.

This data is beta evidence and later action-authority evidence.

---

# 2. Draft handling

The owner may:

- edit draft;
- copy draft;
- mark "Used/sent manually";
- leave unsent.

Do not label a copy action as "Sent".

If a draft is manually sent:
- persist outbound message/record with channel `manual` or truthful recorded source;
- record operator confirmation;
- append audit event;
- transition responsibility/state appropriately.

If the owner edits tone only:
- retain decision acceptance as accepted unchanged;
- optionally record voice-learning evidence separately.

---

# 3. Manual customer update

Allow the operator to add the customer's later reply/update to the same enquiry.

Minimum UI/action:
- raw message;
- source/channel label;
- timestamp optional/default now.

Then use the R2E interpretation path:
- extract changed/new facts;
- preserve old fact history;
- re-run relevant evaluator state;
- update minimum blocker/recommendation;
- show what changed.

Do not create a new enquiry simply because the reply came through a different manually selected channel.

Cross-channel identity graph is not required; the owner is explicitly adding it to this enquiry.

---

# 4. Follow-up loop

When an enquiry is waiting on the customer:

- apply persisted follow-up rules;
- show follow-up due;
- prepare a grounded follow-up;
- owner reviews/manual-sends;
- record outcome.

Do not:
- send automatically unless action authority genuinely permits it;
- classify silence as lost;
- repeatedly nag without business policy.

Follow-up evidence should measure whether the feature actually creates useful recovery.

---

# 5. Booked/lost/handoff

### Booked
When operator confirms external booking/acceptance:
- persist booked lifecycle;
- create/update booking record where useful;
- record manual/external origin truthfully;
- suppress inappropriate follow-up;
- hand off to the business's existing fulfilment system/process.

### Lost
Explicit:
- customer chose someone else;
- business deliberately closes as lost.

### Declined
Business chose not to take work.

### Handoff
The Enquiry product boundary ends after booked/lost and any minimal record/handoff.

Do not expand R2F into post-booking project management.

---

# 6. Beta telemetry

Capture structured product events/server evidence sufficient to calculate:

## Activation
- first non-fixture enquiry reaches a useful Decision Object;
- first reviewed recommendation.

## Recommendation quality
- accepted unchanged;
- edited;
- rejected;
- deferred.

## Corrections
- fact correction;
- inference correction;
- ambiguity missed;
- missing-fact/minimum-blocker correction;
- evaluator omitted/wrongly selected;
- Business Brain rule correction;
- recommendation correction;
- action-authority override;
- voice-only edit.

## Lifecycle
- customer update;
- follow-up due;
- follow-up manually used/sent;
- booked;
- lost;
- declined.

## Retention proxy
- meaningful later session;
- additional enquiry processed.

Do not treat login/page view as product activation.

---

# 7. Event privacy

Telemetry should reference:
- tenant/business id;
- enquiry id;
- event type;
- evaluator/action type;
- timestamp;
- outcome/category.

Do not copy raw customer message bodies into generic analytics.

Where product database/audit is enough for early cohort measurement, prefer deriving metrics there over adding a third-party analytics dependency.

---

# 8. Action-authority evidence

R2F begins producing the real evidence that later could support action autonomy.

But do not auto-graduate actions during first-beta merely because counts exist unless the existing trust contract explicitly supports it and the evidence gates are proven.

For first cohort:
- review-first remains default;
- show evidence transparently;
- synthetic/demo history never mixes in.

---

# 9. Error / offline behaviour

For a manual action:

### Copy succeeds
No server mutation required except intentional event if useful.

### Mark sent manually fails server-side
Do not show sent state.

Allow retry.

### Customer update interpretation fails
Persist the inbound message, show Needs review, block unsafe action.

### Network lost
No false success.

If a user edits a draft locally during outage, preserve only as local draft state until server-confirmed actions occur.

---

# 10. Mobile usability

The first-five beta will likely be used on phones.

R2F must verify the core loop on phone:

- queue;
- open enquiry;
- inspect Why / facts;
- correct;
- review draft;
- copy;
- mark manual send;
- add customer update;
- close/book/lost.

No desktop-only critical action.

This is not Phase 10 installability; it is core responsive usability.

---

# 11. First-beta evidence readout

By the end of R2F, an authorised operator/research process must be able to answer for one tenant:

- number of real enquiries processed;
- reviewed recommendations;
- accepted / edited / rejected;
- correction categories;
- booked/lost/open;
- repeat use.

This can initially be:
- secure server/admin query;
- small internal export;
- existing database/reporting tool.

Do not expose public read endpoints or build a CRM dashboard just for metrics.

---

# 12. Tests

### Manual action
- accept/edit/reject recorded correctly;
- tone-only edit classification separate where implemented;
- manually-sent state persists;
- retry/idempotency safe.

### Customer update
- same enquiry receives update;
- changed fact supersedes old value;
- decision recompiles.

### Follow-up
- due only per rule/state;
- terminal enquiries do not remain follow-up due.

### Outcome
- booked/lost/declined persist;
- booking record idempotent;
- no fake integration wording/state.

### Telemetry
- events/counters derive correctly;
- no fixture/demo events included in live tenant metrics.

### Mobile/runtime
- core responsive interaction tests/QA.

---

# Acceptance

- [ ] One arbitrary non-fixture enquiry completes end-to-end review-first loop.
- [ ] Accepted/edited/rejected recommendation evidence persists.
- [ ] Owner can copy/use a draft without Enquiry falsely claiming send.
- [ ] Manual sent/used confirmation is recorded truthfully.
- [ ] Later customer update stays in same enquiry and recompiles the decision.
- [ ] Follow-up loop works without auto-lost/auto-spam behaviour.
- [ ] Booked/lost/declined states persist and end the Enquiry lifecycle appropriately.
- [ ] Beta correction/outcome telemetry is queryable.
- [ ] Live metrics exclude demo/fixture history.
- [ ] No false Gmail/Instagram/SMS/payment/booking integration claims.
- [ ] Core loop usable on phone.
- [ ] Typecheck/full tests/build + desktop/phone/reduced-motion QA pass or baseline classified.
- [ ] No post-booking CRM/FSM scope creep.

---

# Handoff

Report:

1. review-state data model;
2. draft/manual-send semantics;
3. customer-update flow;
4. follow-up flow;
5. booking/lost/handoff;
6. telemetry schema/source;
7. action-authority evidence handling;
8. error/offline behaviour;
9. mobile QA;
10. first-beta evidence query/export;
11. tests/build;
12. known beta limitations.

Then stop for the full `docs/BETA_READINESS_GATE.md`.
