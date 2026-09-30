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

test("a closed wedding day is never 'Yes - reply ready': Not yet with nothing to book, Yes with a tail when part is", () => {
  const ready = live([{ field: "bedrooms", value: "2", status: "confirmed" }], "ACTION_READY");
  const withClosed = (closedDay: NonNullable<Enquiry["decision"]["closedDay"]>): Enquiry => ({
    ...ready,
    decision: { ...ready.decision, closedDay },
  });
  const wedding = { label: "Bridal makeup", amountMinor: 25000, iso: "2026-11-08" };
  const nothing = withClosed({ days: ["2026-11-08"], held: [wedding], bookable: false });
  assert.equal(promiseVerdict(nothing).line, "Not yet - that day is a closed day");
  assert.equal(derivedLabel(nothing.state, nothing), STATUS.needsDetail);
  const trial = withClosed({ days: ["2026-11-08"], held: [wedding], bookable: true });
  assert.equal(promiseVerdict(trial).line, "Yes - reply ready, one date can't be done");
  assert.equal(derivedLabel(trial.state, trial), STATUS.replyReady);
  const movable = withClosed({ days: ["2026-10-18"], held: [], bookable: true });
  assert.equal(promiseVerdict(movable).line, "Yes - reply ready, one date can't be done");
  // Every lifecycle and decision state still maps to one of the three words.
  for (const e of [nothing, trial, movable]) {
    for (const lifecycle of LIFECYCLES) {
      for (const decision of DECISIONS) {
        const verdict = promiseVerdict({ ...e, state: { ...e.state, lifecycle, decision } });
        assert.ok(WORDS.has(verdict.word), `${lifecycle}/${decision}: ${verdict.word}`);
        assert.ok(verdict.line.startsWith(`${verdict.word} - `), verdict.line);
        assert.ok(verdict.line.length > `${verdict.word} - `.length, verdict.line);
      }
    }
  }
  // Booked, closed and declined are unchanged by it.
  assert.equal(
    promiseVerdict({ ...nothing, state: { ...nothing.state, lifecycle: "BOOKED" } }).line,
    "Yes - booked",
  );
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
