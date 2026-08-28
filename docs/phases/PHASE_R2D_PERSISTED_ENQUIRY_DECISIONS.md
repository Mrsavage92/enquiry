# R2D — Persist Enquiry Decision State, Corrections + Lifecycle

**Status:** PREPARED — NOT AUTHORISED UNTIL `docs/CURRENT_PHASE.md` ACTIVATES R2D

R2D is the fourth slice of:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting:

- `docs/R2_DECISION_ENGINE_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`

R2D begins only after R2C is signed off.

---

# Objective

Make the current enquiry review/correction/lifecycle semantics durable, auditable and server-authoritative.

R2D does **not** yet add arbitrary AI ingestion. It proves that once an enquiry exists, every meaningful operator correction and lifecycle transition persists correctly.

---

# Product invariant

> The client sends the user's factual/action intent. The server validates access, updates source truth, re-runs the deterministic decision logic and persists the resulting Decision Object.

Do not let the client send an already-decided commercial result as authority.

---

# 1. Fact correction

A correction must:

1. verify enquiry tenancy;
2. load current live fact;
3. mark old fact superseded rather than destructive overwrite;
4. insert/confirm the corrected fact with:
   - field;
   - value/display value;
   - asserted_by=user;
   - provenance;
   - status=confirmed where appropriate;
5. determine affected evaluator dependencies;
6. re-run affected deterministic evaluators;
7. persist a new decision snapshot/trace;
8. append audit event.

The unique live-field invariant in `enquiry_fact` must remain valid.

---

# 2. Confirming inferred/check-this facts

Support the current product distinction between:
- inferred;
- check_this;
- unknown;
- confirmed.

Confirming an already-correct inferred fact should not fabricate a new business rule.

It is an enquiry-level evidence update unless the operator separately chooses **Teach Enquiry**.

---

# 3. Teach vs this enquiry

Preserve the explicit scope choice:

### Just this enquiry
- correct the fact;
- no Business Brain promotion.

### Teach Enquiry
- correct the enquiry fact;
- create/propose the relevant Business Brain learning/rule change through the R2C governance model;
- high-impact rules still require confirmation;
- never rewrite historical customer facts as business rules.

---

# 4. Decision snapshot / trace consistency

After any decision-affecting change, persist coherent:

- decision snapshot;
- engine/compiler version;
- snapshot time;
- fact/rule/evaluator trace;
- recommendation;
- action-authority context where represented.

The relational facts and JSON decision snapshot must never disagree after a committed transaction.

If re-evaluation fails:
- roll back decision-changing writes where consistency requires it;
- or leave a clearly safe EVALUATING/NEEDS_HUMAN state with failure provenance if that is the deliberate transaction design.

Never persist half a new fact with an old exact-price decision.

---

# 5. Quote version semantics

Sent quote versions are immutable historical documents.

When a corrected fact/rule changes quoteable output:

- keep previously sent quote;
- create a new draft/superseding quote version;
- do not mutate the sent amount/line items in place;
- make changed assumptions visible;
- preserve rule-set version.

Draft quote replacement can be simpler, but version numbering must remain deterministic.

---

# 6. Enquiry lifecycle operations

Persist current operator operations where the product exposes them.

## Note
Existing `setEnquiryNote` can remain/extend.

## Snooze
Existing `snoozeEnquiry`.

## Follow-up due/release
Persist:
- due flag;
- reason;
- responsible state;
- release/manual completion.

## Mark lost
Must be explicit human/product action; silence alone is not lost.

## Decline
Persist:
- lifecycle;
- reason;
- recommendation/action record;
- audit.

Decline action authority remains highly constrained.

## Customer waiting / business waiting
Composite state axes remain orthogonal.

Do not collapse into one giant status enum.

---

# 7. Manual customer update

Before R2E's arbitrary creation path, R2D should establish the server semantics for adding a later customer message/update to an existing enquiry.

Minimum:

- inbound/manual channel;
- message body;
- timestamp;
- provenance/source;
- optional operator note about how it arrived.

Then:
- update interpretation/facts only through the currently supported deterministic/manual mechanism;
- full LLM interpretation of arbitrary updates is R2E.

If current fixture-specific receive-reply behaviour cannot generalise safely, persist the message and mark the enquiry as needing review rather than hard-coding a fixture result.

---

# 8. Booking/end-state semantics

Persist booking state only where the product currently has enough truth.

Allowed first-beta:
- explicit manually confirmed booking;
- external_pending;
- confirmed;
- cancelled;
- handoff note.

Do not claim a third-party booking system was called unless it genuinely was.

When manually confirming a booking:
- enquiry lifecycle BOOKED;
- booking row links to enquiry;
- quote status accepted where applicable;
- audit event;
- no duplicate booking on retry.

---

# 9. Idempotency

Meaningful mutations should tolerate:
- double click;
- retry after network interruption;
- repeated same client action where reasonable.

Particularly:
- booking creation;
- lifecycle terminal actions;
- follow-up release;
- customer-message external_id where available.

Do not create duplicate quote versions/bookings/messages from harmless retry.

Use explicit idempotency input where action semantics require it.

---

# 10. Undo / corrective operations

Do not retain prototype `undoLast()` for persisted enquiry actions.

Instead:

- fact correction -> another fact correction;
- lost/declined -> explicit reopen only if product supports it, audited;
- booking cancel -> explicit cancellation;
- note -> edit note;
- snooze -> clear/change snooze.

If no safe inverse exists, no generic Undo.

---

# 11. Audit

Append meaningful events:

- fact confirmed/corrected;
- Business Brain teaching proposed;
- quote version created;
- lost/declined;
- follow-up released;
- customer update recorded;
- booking manually confirmed/cancelled.

Do not flood audit with every UI click.

---

# 12. Tests

At minimum:

### Fact history
- correct fact creates new live value;
- prior fact remains superseded;
- one active value per field.

### Re-evaluation
- affected evaluator changes;
- unrelated evaluator stays same where testable;
- minimum blocker updates correctly;
- missing-but-irrelevant fact does not become blocker.

### Snapshot consistency
- transaction failure does not leave fact/snapshot disagreement.

### Quote
- sent quote immutable;
- corrected input creates new draft version;
- retry does not duplicate.

### Lifecycle
- note/snooze/follow-up/lost/decline persist;
- silence is not auto-lost;
- terminal state suppresses inappropriate follow-up.

### Booking
- manual confirm idempotent;
- cross-tenant access blocked.

### Message update
- manual customer update persists in same enquiry;
- no fixture-specific mutation is triggered accidentally.

---

# Acceptance

- [ ] Fact corrections survive reload and preserve superseded provenance.
- [ ] "This enquiry" vs "Teach Enquiry" scope is preserved.
- [ ] Decision snapshot/trace stays consistent with live facts/rules.
- [ ] Re-evaluation is server-authoritative.
- [ ] Minimum blocker changes only when decision logic requires it.
- [ ] Sent quotes are immutable/versioned.
- [ ] Note/snooze/follow-up/lost/decline persist.
- [ ] Manual customer updates append to same enquiry.
- [ ] Booking/end-state transitions are truthful and idempotent.
- [ ] Generic client-only Undo is removed from persisted actions.
- [ ] Cross-tenant mutations fail without existence leakage.
- [ ] Typecheck/full tests/build pass or unchanged baseline classified.
- [ ] No arbitrary LLM ingestion yet.

---

# Handoff

Report:

1. fact supersession transaction;
2. snapshot/trace persistence;
3. re-evaluation dependency strategy;
4. quote version behaviour;
5. lifecycle operations implemented;
6. manual customer update path;
7. booking semantics;
8. idempotency approach;
9. audit events;
10. Undo handling;
11. tests/build;
12. what R2E still needs.

Then stop.
