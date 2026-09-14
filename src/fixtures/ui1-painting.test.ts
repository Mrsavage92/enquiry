import assert from "node:assert/strict";
import test from "node:test";
import { UI1_PAINTING } from "./ui1-painting.ts";
import { BUSINESSES } from "./businesses.ts";

test("UI1 painting is an unsent synthetic enquiry, not a booking or exact quote", () => {
  assert.equal(UI1_PAINTING.fixtureId, "UI1_PAINTING");
  assert.ok(UI1_PAINTING.conversation.every((message) => message.direction === "inbound"));
  assert.equal(UI1_PAINTING.state.lifecycle, "OPEN");
  assert.equal(UI1_PAINTING.valueExact, undefined);
  assert.equal(UI1_PAINTING.decision.quotes.length, 0);
  assert.equal(UI1_PAINTING.decision.automationEligible, false);
  assert.equal(UI1_PAINTING.decision.recommendation.requiredApproval, true);
});

test("the crew explanation uses the existing sample business rule verbatim", () => {
  const ridge = BUSINESSES.find((business) => business.id === UI1_PAINTING.businessId)!;
  const ruleId = UI1_PAINTING.decision.evaluators.find((item) => item.type === "capacity")!
    .ruleIds![0];
  const rule = ridge.knowledge.find((item) => item.id === ruleId)!;
  assert.equal(rule.state, "Active");
  assert.equal(UI1_PAINTING.decision.why[0].evidence, rule.body);
});

test("the changed request stays available with both messages and no invented calendar result", () => {
  assert.equal(UI1_PAINTING.conversation.length, 2);
  assert.equal(UI1_PAINTING.decision.changeDiff?.length, 2);
  assert.match(UI1_PAINTING.conversation[1].body, /three weekdays/);
  assert.match(UI1_PAINTING.conversation[1].body, /ceilings/);
  assert.ok(!UI1_PAINTING.decision.evaluators.some((item) => item.type === "availability"));
  assert.match(UI1_PAINTING.decision.draft.body, /check the contractor's availability/);
  assert.match(UI1_PAINTING.decision.draft.body, /Nothing is booked yet/);
});
