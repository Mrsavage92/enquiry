import assert from "node:assert/strict";
import test from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import type { CompositeState, Enquiry } from "./types.ts";
import { PROMISE_WORDS, STATUS, derivedLabel, promiseVerdict } from "./labels.ts";
import { isHighRisk, laserNext, precheckEligible, sendRisk } from "./laser.ts";
import { VERDICT_MAX, riskLines, segmentsOf, verdictLine } from "./laser-view.ts";

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

function every(fn: (e: Enquiry) => void) {
  for (const base of ENQUIRIES) {
    for (const lifecycle of LIFECYCLES) {
      for (const decision of DECISIONS)
        fn({ ...base, state: { ...base.state, lifecycle, decision } });
    }
  }
}

test("check 5: the verdict fits two lines at 390px over every fixture and state, and never uses an em dash", () => {
  every((e) => {
    const v = verdictLine(e);
    assert.ok(v.line.length <= VERDICT_MAX, v.line);
    assert.doesNotMatch(v.line, /—/);
  });
});

/** Doc 50 section 5: the list chip agrees with the verdict word wherever it implies a promise. */
const CHIP_WORD: Partial<Record<string, string>> = {
  [STATUS.replyReady]: PROMISE_WORDS.yes,
  [STATUS.booked]: PROMISE_WORDS.yes,
  [STATUS.bookingToConfirm]: PROMISE_WORDS.yes,
  [STATUS.declineReady]: PROMISE_WORDS.no,
  [STATUS.needsDetail]: PROMISE_WORDS.notYet,
  [STATUS.reading]: PROMISE_WORDS.notYet,
  [STATUS.needsPrices]: PROMISE_WORDS.notYet,
  [STATUS.yourCall]: PROMISE_WORDS.notYet,
  [STATUS.open]: PROMISE_WORDS.notYet,
  [STATUS.declined]: PROMISE_WORDS.no,
  [STATUS.lost]: PROMISE_WORDS.no,
  [STATUS.cancelled]: PROMISE_WORDS.no,
};

test("the list chip agrees with the verdict word (doc 50 section 5 mapping)", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  for (const base of ENQUIRIES) {
    const e = { ...base, snoozedUntil: undefined, followUpDue: undefined, atRisk: undefined };
    const chip = derivedLabel(e.state, e, now);
    const want = CHIP_WORD[chip];
    if (!want) continue; // Waiting, Follow up, Gone quiet, Later, Public comment: no promise word.
    assert.equal(
      promiseVerdict(e).word,
      want,
      `${e.id}: chip "${chip}" vs "${promiseVerdict(e).line}"`,
    );
  }
});

test("risk rule: the catalogue's risk or the decision's, whichever is higher", () => {
  const base = ENQUIRIES.find((e) => e.state.lifecycle === "OPEN")!;
  const withAction = (action: string, risk: Enquiry["decision"]["risk"] = "MEDIUM") => ({
    decision: {
      ...base.decision,
      risk,
      recommendation: { ...base.decision.recommendation, action: action as never },
    },
  });
  assert.equal(sendRisk(withAction("DECLINE")), "HIGH");
  assert.equal(isHighRisk(withAction("DECLINE")), true);
  assert.equal(sendRisk(withAction("REQUEST_INFORMATION", "LOW")), "LOW");
  assert.equal(sendRisk(withAction("SEND_QUOTE")), "MEDIUM");
  assert.equal(isHighRisk(withAction("SEND_QUOTE", "PROHIBITED_AUTO")), true);
});

test("check 19: the pre-check runs only on a send step, never for practice, demo or offline", () => {
  for (const e of ENQUIRIES) {
    const next = laserNext(e, {});
    const eligible = precheckEligible(next, e, {});
    if (next.kind !== "send") assert.equal(eligible, false, `${e.id} ${next.kind}`);
    assert.equal(precheckEligible(next, { ...e, practice: true }, {}), false);
    assert.equal(precheckEligible(next, e, { demoMode: true }), false);
    assert.equal(precheckEligible(next, e, { offline: true }), false);
  }
});

test("the read view marks the amount and the changed line without changing the text", () => {
  const text = "Hi Tom,\n\nFor the oven clean, that comes to $95.\n\nThanks";
  const parts = segmentsOf(text, ["Thanks"]);
  assert.equal(parts.map((p) => p.text).join(""), text);
  assert.deepEqual(
    parts.filter((p) => p.kind !== "plain").map((p) => [p.kind, p.text]),
    [
      ["amount", "$95"],
      ["fresh", "Thanks"],
    ],
  );
});

test("safeguards keep their owner words; the action-class line is not repeated", () => {
  const e = {
    decision: {
      ...ENQUIRIES[0]!.decision,
      failedGates: [
        "Risk class PROHIBITED_AUTO",
        "Action class SEND_QUOTE is set to Ask every time",
      ],
    },
  };
  assert.deepEqual(riskLines(e), ["This requires your personal review"]);
});
