# Enquiry — Production Heuristic Safety Audit

**Status:** MANAGEMENT REVIEW / PREPARED  
**Reviewed:** 28 August 2026

**Purpose:** Identify demo-friendly fallback logic that must not silently become authoritative when the operator product moves onto real tenant data.

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# 1. Why this matters

The prototype contains several useful convenience heuristics that make fixtures feel complete even when structured business data is absent.

That is acceptable in a demo.

It is unsafe in a real service-business decision engine.

The production rule is:

> **If a business has not supplied a decision-critical rule or an external source cannot be verified, Enquiry returns Unknown / Needs human rather than filling the gap with a generic default.**

---

# 2. Persisted enquiry `fixtureId` is currently wrong

In:

`src/lib/repo/rows.ts`

`toEnquiry()` currently sets:

```ts
fixtureId: r.id
```

for persisted UUID enquiries.

But the domain comment defines `fixtureId` as:

> Fixture ID used in demos and deterministic tests.

A real persisted enquiry is not a fixture merely because it has an id.

### Required correction

During R2B:

- live persisted enquiries should not receive a synthetic `fixtureId`;
- demo fixture objects keep their fixture ids;
- any UI/instrumentation that needs a stable live id uses `enquiry.id`.

Do not overload `fixtureId` as an alias for primary key.

---

# 3. Service-duration fallbacks can fabricate real capacity

In:

`src/domain/calendar.ts`

`durationForService()` falls back to hard-coded label rules such as:

- group = 45 minutes × people;
- bridal = 90;
- formal = 60;
- interior/two rooms = 300;
- brand/identity = 120;
- deep clean = 300;
- standard clean = 180;
- end of lease = 360;
- family = 120;
- event = 240;
- headshot = 180;
- otherwise = 90.

These are excellent fixture/demo defaults.

They are **not valid production business rules**.

### Production requirement

For a live tenant:

- use confirmed service duration / typed capacity rule from that tenant's Business Brain;
- if no duration rule exists and duration is decision-critical, capacity/booking readiness becomes UNKNOWN / NEEDS_HUMAN;
- never fall back to a generic 90-minute duration to make a booking/capacity decision.

### Phase ownership

- R2C: typed service/capacity duration truth;
- R2D/R2E: evaluators use that truth;
- R2B: ensure live read path does not reinterpret missing service rules through fixture fallbacks.

Demo can retain heuristic duration helpers if isolated explicitly.

---

# 4. Travel-time fallbacks fabricate logistics

`travelBetween()` currently returns heuristic values such as:

- same exact location = 10 minutes;
- same first suburb token = 15;
- missing location = 20;
- otherwise = 25.

This can make a booking calendar look realistic.

It is not evidence of actual travel.

### Production requirement

For live tenant decisions:

- use an explicitly configured travel rule / real route source when available;
- otherwise travel time is UNKNOWN or a human-entered/manual value;
- do not use 10/15/20/25-minute generic guesses to validate a schedule/capacity commitment.

A presentation-only estimate must never cross into action-ready commercial/booking logic.

---

# 5. Timezone offset helper is not globally correct

`offsetForTimezone()` currently maps only a few names:

- Adelaide/Broken Hill/Darwin -> +09:30;
- Perth -> +08:00;
- Auckland -> +12:00;
- everything else -> +10:00.

This ignores:

- daylight saving;
- most global IANA zones;
- date-specific offset changes.

R2A now deliberately accepts any valid IANA timezone, so this helper cannot remain transaction-grade live logic.

### Production requirement

Before a live booking instant is persisted/validated:

- convert IANA timezone + local date/time using a real date-time mechanism that respects the specific date;
- or require/retain a fully-qualified timestamp supplied by the user/external system.

Do not generate a production timestamp by guessing an offset from a regex.

For an Australia-first first cohort, this still matters for Sydney/Melbourne daylight-saving dates.

---

# 6. Booking draft invents 09:00

`bookingDraftFromEnquiry()` currently does:

```ts
const when = dateFact?.value
  ? `${dateFact.value}T09:00:00${offset}`
  : new Date().toISOString()
```

If the enquiry has a date but no time, the helper invents 9am.

If it has no date, it invents now.

That is fine for a visual demo placeholder.

It must not create/validate a real booking.

### Production requirement

- missing booking time remains missing;
- missing date remains missing;
- booking readiness asks/records the required real value;
- manual external booking confirmation may supply the actual time;
- no default 09:00 or "now" can become persisted customer commitment.

---

# 7. Working-hours default is Brisbane-specific

`src/domain/working-hours.ts` has:

```ts
const ZONE = "Australia/Brisbane"
```

The actual calculation accepts `prefs.timezone`, which is good.

The risk is fallback behaviour.

### Production requirement

Once R2C persists business decision-affecting preferences:

- every live business must use its persisted IANA timezone;
- missing/invalid timezone should not silently become Brisbane for commercial follow-up timing;
- UTC or Needs setup is safer than another tenant/market's timezone.

This is especially important because R2A is now global-capable.

---

# 8. Public-comment and channel helpers may imply live channel integration

Some domain copy has statements such as:

> Instagram comments stay public. Enquiry will not quote here. Invite them to message...

The product rule is sound.

But in live first beta, social APIs may not be connected.

### Production requirement

The UI can explain channel safety only for:
- manually recorded source context;
- genuinely connected integration.

Do not expose a "reply/invite to DM" action that claims it executed on Instagram/Facebook when it did not.

This remains deferred integration work.

---

# 9. Fixture-specific Business Brain prose parsing

Already covered by:

`docs/R2_DECISION_ENGINE_REVIEW.md`

and:

`docs/R2_TYPED_BUSINESS_RULE_CONTRACT.md`

Additional reminder:

`src/domain/situation.ts` still extracts conflict dollar values from `KnowledgeItem.body` with a regex.

In live production:
- display can still show human-readable body;
- deterministic price authority/conflict resolution should use typed price-rule data, not parse arbitrary prose.

R2C owns this transition.

---

# 10. Fixture-specific re-evaluation branches

Already known:

- `src/domain/reeval.ts`
- `src/domain/brain-apply.ts`

contain fixture ids/titles/business assumptions.

### Rule

Do not delete these just because they are hard-coded.

Keep them as:
- demo/eval fixtures;
- regression examples.

But the R2E arbitrary-enquiry path must not dispatch to them by fixture id or business name.

---

# 11. Money/currency boundary

Database storage is currency-aware.

Current domain types historically constrained some Money/Business values to AUD.

R2A now accepts a three-letter currency string.

### First-beta decision

If first cohort is AUD-only, that is acceptable operationally.

But:
- do not claim multi-currency product support until domain/rendering/evaluators have been tested;
- live typed rule/evaluator code must never silently combine different currencies;
- a business currency mismatch should fail safe.

International launch is later evidence-driven work.

---

# 12. R2 phase implications

## R2A
Already:
- real timezone/currency profile introduced.

Must still:
- not move global-capable profile into fixture `glow`.

## R2B
Must:
- remove live `fixtureId` aliasing;
- keep demo-only heuristic runtime isolated;
- ensure missing live business data does not trigger fixture fallback values.

## R2C
Must:
- provide typed duration/capacity/travel/pricing truth where supported;
- provide persisted business timezone/working preference truth.

## R2D
Must:
- never create booking time/date from generic defaults;
- persist actual manual/external booking facts.

## R2E
Must:
- return UNKNOWN/NEEDS_FACTS rather than use generic service-duration/travel fallbacks.

## R2F
Must:
- label manual/external action truthfully;
- not claim route/calendar provider work occurred.

---

# 13. First-beta safety tests to add

At minimum, before Beta Readiness:

- [ ] Live unknown service duration does not become 90 minutes.
- [ ] Live unknown travel does not become 20/25 minutes.
- [ ] Date without time does not create 09:00 booking.
- [ ] Missing date does not create a booking for "now".
- [ ] Sydney/Melbourne date-specific timezone handling is correct when/if booking timestamps are created.
- [ ] Non-Australian IANA timezone is not coerced to +10.
- [ ] Persisted real enquiry has no demo `fixtureId`.
- [ ] Missing typed price rule does not fall back to parsing a dollar amount from prose for transaction authority.
- [ ] Social/manual source does not enable a fake provider action.

---

# 14. Principle

A prototype often benefits from smart defaults.

A decision engine often needs the opposite:

> **No rule is safer than the wrong rule.**

Where the business has not told Enquiry enough to decide correctly, the product should make that absence visible.
