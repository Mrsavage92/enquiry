# Phase 6 — Roadmap Research Persistence + Attribution

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 6.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

---

## 1. Objective

Make the public roadmap produce useful customer-research data instead of only interaction counts.

Two known gaps:

1. the free-text answer to `What problem would this solve for your business?` is not currently persisted;
2. several roadmap events are tracked with blank UTM/referrer fields even though launch attribution helpers already exist.

Fix those two things without creating a new analytics platform.

---

## 2. Current implementation to inspect

Known baseline:

`src/components/site/roadmap-board.tsx` has a generic `track()` helper that currently sends blank:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `referrer`

The roadmap feedback form captures `problem` in local state, but after waitlist join it only fires `roadmap_stage_engaged`; the actual text is not sent to the backend.

`src/lib/launch/api.ts` already provides:

- waitlist join;
- launch-event tracking;
- roadmap-interest toggle;
- list-my-needs.

Use the existing system.

---

## 3. Data model

Prefer extending the existing roadmap research storage rather than inventing an unrelated table.

Current `roadmap_interest` should be inspected in `migrations/0002_launch.sql` before choosing the migration shape.

Minimum persisted data for qualitative feedback:

- unique record id if required by current schema;
- `feature_id` / roadmap public item id;
- `session_id`;
- `waitlist_id` when safely available;
- free-text `problem_text`;
- timestamp;
- optionally first/latest attribution if it is cleaner to attach it directly here.

Important: the roadmap stage IDs may have changed in Phase 4. Use the **current allowed feature IDs**, not assumptions from the old eight-stage roadmap.

Do not store more personal data than is needed.

---

## 4. Backend behaviour

Add a small explicit server action for feedback rather than smuggling arbitrary text into generic event names.

Preferred direction:

`saveRoadmapFeedback(...)`

Validate / constrain:

- allowed feature id;
- session id format;
- waitlist id format;
- problem text max length;
- trim empty submissions;
- safe no-op where IDs are malformed rather than exposing records.

Use the existing launch protection/rate-limiting pattern.

Do not return other users’ data.

Do not build an admin reader UI in this phase.

---

## 5. Feedback UX rules

Preserve `I need this` behaviour.

For a visitor not on the waitlist:

- email may still be required to register durable interest;
- problem statement remains optional;
- after successful join, save the interest and problem text.

For a visitor already on the waitlist:

Current UX may directly toggle interest and therefore never ask qualitative feedback. Do not make every click open a mandatory modal.

A lightweight approach is preferred:

- `I need this` toggles normally;
- optionally expose `Tell us why` after interest is registered;
- if current design already offers a feedback form, preserve its rhythm.

The goal is to capture qualitative data where volunteered, not add friction to every vote.

---

## 6. Attribution

Use the existing attribution helpers from `src/lib/launch/session.ts`.

For roadmap events, populate available:

- current touch UTM source/medium/campaign/content;
- referrer;
- landing path `/roadmap`;
- existing feature id.

Where useful, preserve first touch for durable waitlist/feedback records and current/latest touch for event records.

Do not create a second localStorage attribution implementation.

Do not overwrite the original first-touch attribution just because a returning user visits `/roadmap` later.

---

## 7. Event semantics

Keep event names useful and bounded.

Likely events:

- `roadmap_view`
- `roadmap_feedback_click`
- `roadmap_vote`
- `roadmap_feedback_submitted`
- `roadmap_waitlist_signup`

If guard allowlists currently use different approved names, modify them intentionally and test them.

Do not track every scroll pixel/click.

---

## 8. Migration safety

Add a new numbered migration; do not rewrite an already-used migration unless the repository’s platform convention explicitly requires it.

The existing repo currently has `migrations/0002_launch.sql`.

Use the next appropriate migration number.

Migration must be idempotent/safe according to the current project migration convention.

Do not delete current waitlist, roadmap-interest or launch-event data.

---

## 9. Tests

Cover:

1. valid feedback is persisted;
2. empty optional feedback does not create meaningless text rows;
3. invalid/unallowed feature IDs are rejected/no-op safely;
4. an arbitrary visitor cannot fetch another user’s feedback (there should be no public read action introduced);
5. roadmap event tracking includes supplied attribution;
6. existing interest toggle still works;
7. duplicate interest semantics remain correct.

Preserve current launch-protection tests.

---

## 10. Do not do

- no analytics dashboard;
- no admin CRM;
- no external analytics vendor;
- no email campaign automation;
- no feature-vote counts displayed publicly;
- no ranking features by vote count;
- no ICP scoring implementation;
- no broad database refactor.

---

## 11. Likely files

- `src/components/site/roadmap-board.tsx`
- `src/lib/launch/api.ts`
- `src/lib/launch/session.ts`
- `src/lib/launch/guard.ts`
- launch tests
- `migrations/0003_*.sql` or next appropriate number

---

## 12. Acceptance criteria

- [ ] Volunteered roadmap problem text is persisted with the correct roadmap item.
- [ ] Feedback can be tied to waitlist ID where available without exposing IDs across users.
- [ ] Roadmap events preserve available attribution instead of sending blank values.
- [ ] Original first-touch attribution remains intact.
- [ ] `I need this` still toggles correctly.
- [ ] Feedback remains optional and low-friction.
- [ ] No public vote leaderboard/counts are introduced.
- [ ] Migration preserves existing data.
- [ ] Typecheck passes.
- [ ] Relevant tests pass.
- [ ] Roadmap visual QA works desktop/mobile.

---

## 13. Handoff

Report:

- schema/migration added;
- where qualitative feedback is persisted;
- how attribution is populated;
- exact event names changed/added;
- files changed;
- tests/typecheck;
- any privacy/data concern discovered.

Then stop. Do not begin Phase 7.