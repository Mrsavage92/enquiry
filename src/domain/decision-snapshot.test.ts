import assert from "node:assert/strict";
import test from "node:test";
import { emptyDecisionSnapshot, snapshotFromDecision } from "./decision-snapshot.ts";
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
