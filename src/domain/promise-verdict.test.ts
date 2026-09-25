import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { PROMISE_WORDS, promiseVerdict } from "./labels.ts";
import { decideEnquiry } from "./decide.ts";
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
  const decision = decideEnquiry(knowledge, {
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
