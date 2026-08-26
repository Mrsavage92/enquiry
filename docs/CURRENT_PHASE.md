# Enquiry - Current Implementation Phase

## Current phase

**Phase 6 - REVIEW GATE: inspect the already-landed roadmap research implementation**

Source of truth:

- `AGENTS.project.md`
- `docs/PRODUCT_CHANGE_PLAN.md`
- `docs/phases/PHASE_6_ROADMAP_RESEARCH_PERSISTENCE_ATTRIBUTION.md`
- `docs/TEST_REGRESSION_POLICY.md`

## Completed gates

### Phase 1
**SIGNED OFF.** Public positioning leads with the decision layer rather than phone-first quoting.

### Phase 2A
**SIGNED OFF.** Ridge & Co / Maya signature demo is grounded in explicit business truth and deterministic same-phone continuity.

### Phase 2B
**SIGNED OFF.** The Ridge decision-continuity proof is the first substantial public proof on the homepage and `/how`; Priya remains secondary exact-price evidence.

### Phase 3
**SIGNED OFF.** Pricing and capacity are no longer treated as universal. Non-price enquiries render without fake commercial placeholders and the queue is attention-first.

### Phase 4
**SIGNED OFF.** The public roadmap is six customer-facing eras, continuity is framed as one coherent enquiry rather than a unified inbox, pricing/capacity remain conditional, autonomy remains earned, and the endgame stays bounded at booked/lost.

### Phase 5
**SIGNED OFF.** Commit `140768bbc89c211080c6f81ae2e7c087772572a2` plus correction commit `543d1c4471793d4d7eefd6fbf56b97c28ec870b4` satisfy the Phase 5 gate. The remaining `No fake scarcity` wording was removed from the homepage and waitlist success state without changing waitlist behaviour or broadening scope.

---

# Sequencing incident to preserve

Grok committed later-phase work before product management advanced this file:

- `6d326e39ff4156d654ec515c7799779c87f2cfd6` - labelled Phase 6;
- `836a79fccb6079b44dd4769acf56422978c75ac8` - labelled Phase 8.

The presence of those commits does **not** mean those phases are signed off or authorised.

Do not continue from the highest phase number found in git history. `docs/CURRENT_PHASE.md` remains the execution authority.

The Phase 8-labelled commit must be treated as **ungated existing code only**. Do not add to it, extend it, or use it as authority to skip Phase 6 review or Phase 8's later formal gate.

---

# Review Phase 6 only

Implementation already present to review:

`6d326e39ff4156d654ec515c7799779c87f2cfd6`

Do not reimplement Phase 6 from scratch. Inspect the actual landed code against the full brief:

`docs/phases/PHASE_6_ROADMAP_RESEARCH_PERSISTENCE_ATTRIBUTION.md`

## Required review questions

1. Does volunteered `What problem would this solve for your business?` text persist as durable research data tied to the correct current/canonical roadmap item?
2. Is feedback tied to `session_id` and optional `waitlist_id` safely, with no public read path that exposes another visitor's feedback?
3. Does migration `0003` follow the repository migration convention, preserve existing data, and remain safe/idempotent?
4. Do roadmap events now carry available current-touch UTM/referrer attribution rather than blanks?
5. Is original first-touch attribution still preserved rather than overwritten by later roadmap visits?
6. Does `I need this` still toggle correctly, including existing legacy/canonical feature-ID behaviour from Phase 4?
7. Is qualitative feedback optional and low-friction for both already-known and new waitlist visitors?
8. Were launch protection, validation, maximum text lengths and malformed-ID safe-no-op behaviour preserved?
9. Were no public vote counts, admin dashboards, CRM behaviour or unrelated analytics systems introduced?
10. Do focused tests cover persistence, empty feedback, invalid feature IDs, attribution, no public read path and interest-toggle compatibility?

## Scope rule

This is a **review gate**, not permission for more product work.

If the existing Phase 6 implementation passes, product management may mark Phase 6 signed off and move to the next deliberate gate.

If it fails, update this file with the smallest precise correction gate and keep Phase 6 active.

Do not begin or extend Phase 7, Phase 8, Phase 9 or Phase 10.

## Acceptance criteria

- [ ] Volunteered roadmap problem text is persisted with the correct roadmap item.
- [ ] Feedback can be tied to waitlist ID where available without exposing IDs/data across users.
- [ ] Roadmap events preserve available attribution instead of blank values.
- [ ] Original first-touch attribution remains intact.
- [ ] `I need this` still toggles correctly.
- [ ] Feedback remains optional and low-friction.
- [ ] No public vote leaderboard/counts are introduced.
- [ ] Migration preserves existing data and follows project migration conventions.
- [ ] Typecheck passes.
- [ ] Relevant focused tests pass.
- [ ] Roadmap visual QA works on desktop/mobile.

Then stop.

**Do not treat the existing Phase 8-labelled commit as an authorised Phase 8 completion.**
