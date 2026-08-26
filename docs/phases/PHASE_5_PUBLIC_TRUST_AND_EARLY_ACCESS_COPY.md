# Phase 5 — Public Trust Copy: Early Access + Updates

**Status:** PREPARED — NOT ACTIVE YET

**Do not execute until `docs/CURRENT_PHASE.md` explicitly points to Phase 5.**

Source: `docs/PRODUCT_CHANGE_PLAN.md`.

---

## 1. Objective

Keep Enquiry’s unusual honesty while making every public page sound like deliberate customer communication rather than an internal founder/product memo.

The visitor should feel:

- the company is candid;
- the product is early;
- access is controlled for a reason;
- the roadmap is trustworthy;
- the founder is building openly;
- none of this feels amateur, apologetic or artificially scarce.

---

## 2. Early Access page

Inspect current `src/routes/early-access.tsx`.

Preserve:

- email-first waitlist conversion;
- optional qualification after signup;
- gradual cohort rollout;
- no fake scarcity;
- no unsupported pricing promise;
- clear intent that Enquiry will become a paid product.

Remove / rewrite process-heavy language such as:

- `not pad a list`;
- `only as learning can absorb them`;
- `a say in the research, not a vote that ships features`;
- `Founding-user pricing only if we later know the commercial model is real`.

These ideas can remain in the internal strategy. They do not need to appear verbatim to a customer.

---

## 3. Preferred Early Access structure

### Hero
Eyebrow: `Early access`

Headline direction:

> **Be one of the first businesses to use Enquiry.**

Alternative if existing visual rhythm prefers shorter:

> **Join early access.**

Body direction:

> We’re opening Enquiry gradually so we can work closely with the first service businesses and improve the product before wider release.

Then the form.

### What joining means
Three concise customer-facing promises:

1. **Early access when your cohort opens**
   We invite businesses in small groups as the product is ready for them.

2. **A direct line into what we learn**
   Early businesses can tell us where Enquiry helps, where it gets in the way and what still needs work.

3. **Clear communication before anything becomes paid**
   Enquiry is intended to be a paid product. Pricing will be shared before any paid access begins.

Do not promise permanent founding discounts.

### Why gradual access
Optional small trust block:

> **Why not open it to everyone?**
>
> Enquiry is making business decisions, not just drafting text. We’d rather expand carefully and make those decisions trustworthy than chase a big signup number.

This is a strong product/trust explanation and is more valuable than founder-process language.

Do not overdo this section.

---

## 4. Cohort language

It is fine to state that access is gradual.

Avoid making specific cohort sizes prominent on the sales page unless they are operationally useful at that moment.

`First five`, `then twenty`, etc. is internal rollout detail and may age quickly.

If the current cohort state is shown, make it easy to change in one location/data constant rather than scattering hard-coded numbers through the website.

No queue-position gimmicks.

---

## 5. Updates page role

`/updates` is **not release notes**.

Its role is:

> meaningful notes from building Enquiry in public.

The page can contain:

- a product behaviour that became real;
- a meaningful product decision and why;
- a mistake/correction that materially changed Enquiry;
- first-user learnings when available;
- a major roadmap milestone that shipped.

It should not publish:

- every component change;
- bug fixes;
- dependency upgrades;
- database work;
- minor polish;
- internal implementation phases.

---

## 6. Current Updates cleanup

Review the existing hard-coded `POSTS`.

Several current entries are too implementation-specific or quote-centric, e.g. exact hold arithmetic / quote-sheet mechanics.

Do not delete useful history automatically, but curate the page to a small set of posts that strengthen the buyer’s understanding of Enquiry.

Recommended first public update themes after Phases 1–4:

### `Why Enquiry is not another CRM`
A short explanation of automatically maintained enquiry state + decision-first behaviour.

### `One enquiry, even when the conversation moves`
Use the Phase 2 demo story once complete.

### `Why Enquiry sometimes refuses to answer`
Unknown > fabricated decisions.

### `Learning the business without silently changing the rules`
One-off correction vs Teach Enquiry.

### `What we mean by building in public`
Only meaningful progress is published; roadmap changes when evidence changes.

Do not manufacture dates/history for milestones that have not happened.

---

## 7. Founder voice

Public copy should be plain, confident and technically literate.

Avoid:

- startup-guru tone;
- fake vulnerability;
- breathless AI language;
- excessive exclamation marks;
- `we’re disrupting X`;
- apologising for being early;
- internal PM phrases such as `learning can absorb`.

Good tone:

> We’re starting small because this product needs to make correct decisions before it makes lots of them.

> Some things work today. Some are still being tested. We’ll show the difference.

---

## 8. Cross-page consistency

Check public copy in:

- `/early-access`;
- `/updates`;
- homepage cohort/access section;
- footer snippets if relevant;
- waitlist success message if it repeats old language.

Do **not** launch a broad rewrite of every page. Change only inconsistent trust/access wording.

Preserve Phase 1 positioning and Phase 2/4 product narrative.

---

## 9. Waitlist form

Do not change the progressive qualification mechanics in this phase unless copy needs minor polish.

Email remains the first conversion.

Do not add required fields.

Do not add referrals.

Do not add countdowns / queue positions / artificial urgency.

---

## 10. Metadata

Update page description/title only if current metadata still uses internal/process language.

SEO claims must remain factual.

---

## 11. Do not do

- no pricing model design;
- no email automation implementation;
- no CRM/admin system for waitlist;
- no referral system;
- no public engineering changelog;
- no new roadmap architecture;
- no analytics schema work;
- no founder biography page.

---

## 12. Likely files

- `src/routes/early-access.tsx`
- `src/routes/updates.tsx`
- `src/routes/index.tsx` access/cohort section only if needed
- `src/components/site/waitlist-form.tsx` copy only if necessary
- shared launch copy/constants only if this removes duplicated cohort wording

---

## 13. Acceptance criteria

- [ ] Early Access feels honest and polished rather than like an internal experiment description.
- [ ] Gradual access is clear without fake scarcity.
- [ ] Enquiry’s intended paid nature is clear without an unvalidated price/discount promise.
- [ ] Current cohort mechanics are not over-explained.
- [ ] `/updates` clearly behaves as curated meaningful progress, not release notes.
- [ ] Quote-specific implementation trivia no longer dominates public update history.
- [ ] Copy is consistent with decision-layer positioning.
- [ ] Waitlist remains email-first with optional qualification.
- [ ] Typecheck passes.
- [ ] Desktop/mobile visual QA completed.

---

## 14. Handoff

Report:

- public copy sections changed;
- update entries retained/removed/rewritten and why;
- exact files changed;
- typecheck;
- desktop/mobile QA;
- any remaining public text that sounds like internal strategy language.

Then stop. Do not begin Phase 6.