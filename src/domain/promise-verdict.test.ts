import assert from "node:assert/strict";
import { decideConfirmed } from "./coverage-testing.ts";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { PROMISE_WORDS, STATUS, derivedLabel, promiseVerdict } from "./labels.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import type { CompositeState, Enquiry } from "./types.ts";

const WORDS = new Set<string>(Object.values(PROMISE_WORDS));

const LIFECYCLES: CompositeState["lifecycle"][] = [
  "OPEN",
  "BOOKED",
  "DECLINED",
  "LOST",
  "CANCELLED",
];
const DECISIONS: CompositeState["decision"][] = [
  "EVALUATING",
  "NEEDS_INFORMATION",
  "NEEDS_HUMAN",
  "ACTION_READY",
  "WAITING_ON_CLIENT",
  "BOOKING_PENDING",
  "NONE",
];

test("every decision state maps to exactly one of Yes, No, Not yet", () => {
  for (const e of ENQUIRIES) {
    for (const lifecycle of LIFECYCLES) {
      for (const decision of DECISIONS) {
        const state = { ...e.state, lifecycle, decision };
        const verdict = promiseVerdict({ ...e, state });
        assert.ok(WORDS.has(verdict.word), `${e.id} ${lifecycle}/${decision}: ${verdict.word}`);
        assert.ok(verdict.line.startsWith(`${verdict.word} - `), verdict.line);
        assert.doesNotMatch(verdict.line, /\u2014/);
      }
    }
  }
});

const PER_BEDROOM = {
  knowledge: [
    {
      state: "Active",
      rulePayload: {
        kind: "per_unit",
        service: "End of lease clean",
        amount: 190,
        currency: "AUD",
        unit: "bedroom",
        quantityField: "bedrooms",
      },
    },
  ],
};

function live(
  facts: { field: string; value: string; status: string; displayValue?: string }[],
  decisionState: CompositeState["decision"],
  knowledge: typeof PER_BEDROOM | { knowledge: [] } = PER_BEDROOM,
): Enquiry {
  // A priced reply is only ready once the owner confirmed what it covers.
  const decision = decideConfirmed(knowledge, {
    serviceLabel: "End of lease clean",
    facts: facts as never,
  });
  const base = ENQUIRIES.find((e) => e.state.lifecycle === "OPEN")!;
  return {
    ...base,
    followUpDue: undefined,
    atRisk: undefined,
    snoozedUntil: undefined,
    state: { ...base.state, lifecycle: "OPEN", decision: decisionState, commercial: "UNASSESSED" },
    decision: { ...base.decision, ...snapshotFromDecision(decision), evaluators: [] },
  };
}

test("a priced reply is Yes, a missing detail is Not yet, prices to add is Not yet", () => {
  const ready = live([{ field: "bedrooms", value: "2", status: "confirmed" }], "ACTION_READY");
  assert.equal(promiseVerdict(ready).line, "Yes - reply ready");
  const missing = live([], "NEEDS_INFORMATION");
  assert.equal(promiseVerdict(missing).line, "Not yet - one detail decides it");
  const inferred = live(
    [{ field: "bedrooms", value: "2", status: "inferred", displayValue: "2 bed" }],
    "NEEDS_INFORMATION",
  );
  assert.equal(promiseVerdict(inferred).line, "Not yet - check one detail they gave");
  const noPrices = live([], "NEEDS_HUMAN", { knowledge: [] });
  assert.equal(promiseVerdict(noPrices).line, "Not yet - your prices decide it");
});

test("a closed wedding day is never 'Yes - reply ready' with nothing to book; the date tails live on the settled line", () => {
  const ready = live([{ field: "bedrooms", value: "2", status: "confirmed" }], "ACTION_READY");
  const withClosed = (closedDay: NonNullable<Enquiry["decision"]["closedDay"]>): Enquiry => ({
    ...ready,
    decision: { ...ready.decision, closedDay },
  });
  const wedding = { label: "Bridal makeup", iso: "2026-11-08" };
  const nothing = withClosed({ days: ["2026-11-08"], held: [wedding], bookable: false });
  assert.equal(promiseVerdict(nothing).line, "Not yet - that day is a closed day");
  assert.equal(derivedLabel(nothing.state, nothing), STATUS.needsDetail);
  // Doc 50 section 5: the verdict says the reply is ready, once; the days that
  // can't be done and a date to check are on the settled line instead.
  const trial = withClosed({ days: ["2026-11-08"], held: [wedding], bookable: true });
  assert.equal(promiseVerdict(trial).line, "Yes - reply ready");
  assert.equal(derivedLabel(trial.state, trial), STATUS.replyReady);
  const two = withClosed({ days: ["2026-10-18", "2026-10-25"], held: [], bookable: true });
  const checked = {
    ...two,
    facts: [
      { id: "d", field: "date", label: "date", value: "2026-10-18", status: "check_this" },
    ] as Enquiry["facts"],
  };
  assert.equal(promiseVerdict(checked).line, "Yes - reply ready");
  // With nothing bookable the reply only asks about the date: Not yet, even
  // though that reply can be sent.
  const asking = {
    ...nothing,
    state: { ...nothing.state, decision: "NEEDS_INFORMATION" as const },
  };
  assert.equal(promiseVerdict(asking).line, "Not yet - that day is a closed day");
  assert.equal(derivedLabel(asking.state, asking), STATUS.needsDetail);
  for (const e of [nothing, trial, two, checked]) {
    for (const lifecycle of LIFECYCLES) {
      for (const decision of DECISIONS) {
        const verdict = promiseVerdict({ ...e, state: { ...e.state, lifecycle, decision } });
        assert.ok(WORDS.has(verdict.word), `${lifecycle}/${decision}: ${verdict.word}`);
        assert.ok(verdict.line.startsWith(`${verdict.word} - `), verdict.line);
        assert.ok(verdict.line.length > `${verdict.word} - `.length, verdict.line);
      }
    }
  }
  assert.equal(
    promiseVerdict({ ...nothing, state: { ...nothing.state, lifecycle: "BOOKED" } }).line,
    "Yes - booked",
  );
});

test("truth fix: never 'Yes - reply ready' over a quote reply that names no price or asks which day suits", () => {
  const ready = live([{ field: "bedrooms", value: "2", status: "confirmed" }], "ACTION_READY");
  const withBody = (body: string): Enquiry => ({
    ...ready,
    decision: { ...ready.decision, draft: { ...ready.decision.draft, body } },
  });
  const unpriced = withBody(
    "Hi there,\n\nThanks for getting in touch.\n\nLet me know what date suits and I'll confirm.\n\nThanks",
  );
  assert.equal(promiseVerdict(unpriced).line, "Not yet - one date to settle");
  assert.equal(derivedLabel(unpriced.state, unpriced), STATUS.needsDetail);
  const priced = withBody(
    "Hi there,\n\nFor the end of lease clean, that comes to $380.\n\nLet me know what date suits and I'll confirm.\n\nThanks",
  );
  assert.equal(promiseVerdict(priced).line, "Yes - reply ready");
  assert.equal(derivedLabel(priced.state, priced), STATUS.replyReady);
});

test("a declined or out-of-scope enquiry is No", () => {
  const base = live([], "NEEDS_HUMAN");
  const declined = { ...base, state: { ...base.state, lifecycle: "DECLINED" as const } };
  assert.equal(promiseVerdict(declined).word, PROMISE_WORDS.no);
  const decline = {
    ...base,
    decision: {
      ...base.decision,
      recommendation: { ...base.decision.recommendation, action: "DECLINE" as const },
    },
  };
  assert.equal(promiseVerdict(decline).line, "No - outside what you offer");
});
