import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyDecisionSnapshot,
  snapshotFromDecision,
  stateFromDecision,
} from "./decision-snapshot.ts";
import { decideEnquiry } from "./decide.ts";

/**
 * The desk reads these arrays unguarded. A snapshot that omits any of them
 * white-screens the whole enquiry view, which is exactly what happened to the
 * first enquiry added by hand on the deployed app.
 */
const REQUIRED_ARRAYS = [
  "evaluators",
  "missing",
  "conflicts",
  "why",
  "quotes",
  "failedGates",
  "serviceComposition",
] as const;

test("the default snapshot has every array the desk reads", () => {
  const s = emptyDecisionSnapshot() as unknown as Record<string, unknown>;
  for (const key of REQUIRED_ARRAYS) {
    assert.ok(Array.isArray(s[key]), `${key} must be an array, got ${typeof s[key]}`);
  }
  assert.equal(typeof s.recommendation, "object");
  assert.equal(typeof s.draft, "object");
});

test("the default recommendation does not claim a decision that was not made", () => {
  const s = emptyDecisionSnapshot();
  assert.equal(s.recommendation.action, "ESCALATE_HUMAN");
  assert.equal(s.recommendation.primaryEnabled, false);
  assert.equal(s.automationEligible, false);
});

test("a blocked decision names the one fact that would unblock it", () => {
  const business = {
    knowledge: [
      {
        state: "Active",
        rulePayload: {
          kind: "per_unit",
          service: "Group makeup",
          amount: 145,
          currency: "AUD",
          unit: "person",
          quantityField: "guests",
        },
      },
    ],
  };
  const snapshot = snapshotFromDecision(
    decideEnquiry(business, { serviceLabel: "Group makeup", facts: [] }),
  );
  assert.equal(snapshot.recommendation.action, "REQUEST_INFORMATION");
  assert.equal(snapshot.missing.length, 1);
  assert.equal(snapshot.missing[0]?.factField, "guests");
  assert.ok(snapshot.missing[0]?.blocking);
  for (const key of REQUIRED_ARRAYS) {
    assert.ok(Array.isArray((snapshot as unknown as Record<string, unknown>)[key]), key);
  }
});

test("a priced decision is sendable and carries the workings", () => {
  const business = {
    knowledge: [
      {
        state: "Active",
        rulePayload: {
          kind: "fixed_price",
          service: "Bridal trial",
          amount: 120,
          currency: "AUD",
        },
      },
    ],
  };
  const snapshot = snapshotFromDecision(
    decideEnquiry(business, { serviceLabel: "Bridal trial", facts: [] }),
  );
  assert.equal(snapshot.recommendation.action, "SEND_QUOTE");
  assert.equal(snapshot.recommendation.primaryEnabled, true);
  // Never automatic: the owner sends every reply.
  assert.equal(snapshot.recommendation.requiredApproval, true);
  assert.match(snapshot.explanation, /\$120/);
  assert.equal(snapshot.missing.length, 0);
});

test("a business with no rules escalates rather than inventing a price", () => {
  const snapshot = snapshotFromDecision(
    decideEnquiry({ knowledge: [] }, { serviceLabel: "Group makeup", facts: [] }),
  );
  assert.equal(snapshot.recommendation.action, "ESCALATE_HUMAN");
  assert.equal(snapshot.recommendation.primaryEnabled, false);
});

test("a decided enquiry never sits on EVALUATING, waiting on nothing", () => {
  const priced = decideEnquiry(
    {
      knowledge: [
        {
          state: "Active",
          rulePayload: { kind: "fixed_price", service: "Trial", amount: 120, currency: "AUD" },
        },
      ],
    },
    { serviceLabel: "Trial", facts: [] },
  );
  assert.deepEqual(stateFromDecision(priced), {
    decisionState: "ACTION_READY",
    commercialState: "QUOTABLE",
    responsibility: "BUSINESS",
  });

  const blocked = decideEnquiry(
    {
      knowledge: [
        {
          state: "Active",
          rulePayload: {
            kind: "per_unit",
            service: "Group",
            amount: 145,
            currency: "AUD",
            unit: "person",
            quantityField: "guests",
          },
        },
      ],
    },
    { serviceLabel: "Group", facts: [] },
  );
  assert.equal(stateFromDecision(blocked).decisionState, "NEEDS_INFORMATION");

  const noRule = decideEnquiry({ knowledge: [] }, { serviceLabel: "Anything", facts: [] });
  assert.equal(stateFromDecision(noRule).decisionState, "NEEDS_HUMAN");
});

test("answering the blocker turns a blocked enquiry into a priced one", () => {
  // The loop's second half: Enquiry refuses to guess, the owner supplies the
  // one fact, and the price computes from the business's own rule.
  const business = {
    knowledge: [
      {
        state: "Active",
        rulePayload: {
          kind: "per_unit",
          service: "Group makeup",
          amount: 145,
          currency: "AUD",
          unit: "person",
          quantityField: "guests",
          minimumQuantity: 3,
        },
      },
    ],
  };

  const blocked = decideEnquiry(business, { serviceLabel: "Group makeup", facts: [] });
  assert.equal(stateFromDecision(blocked).decisionState, "NEEDS_INFORMATION");
  assert.equal(snapshotFromDecision(blocked).missing[0]?.factField, "guests");

  const answered = decideEnquiry(business, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "4", status: "confirmed" }],
  } as never);
  assert.equal(answered.price.kind, "EXACT");
  assert.equal(answered.price.kind === "EXACT" ? answered.price.amountMinor : 0, 58000);
  assert.equal(stateFromDecision(answered).decisionState, "ACTION_READY");
  assert.equal(snapshotFromDecision(answered).missing.length, 0);
});

test("an unconfirmed answer still does not price it", () => {
  const business = {
    knowledge: [
      {
        state: "Active",
        rulePayload: {
          kind: "per_unit",
          service: "Group makeup",
          amount: 145,
          currency: "AUD",
          unit: "person",
          quantityField: "guests",
        },
      },
    ],
  };
  const guessed = decideEnquiry(business, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "4", status: "inferred" }],
  } as never);
  assert.equal(guessed.price.kind, "BLOCKED");
  assert.equal(stateFromDecision(guessed).decisionState, "NEEDS_INFORMATION");
});
