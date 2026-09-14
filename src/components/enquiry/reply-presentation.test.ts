import assert from "node:assert/strict";
import test from "node:test";
import { UI1_PAINTING } from "../../fixtures/ui1-painting.ts";
import { isWaitingForInformation } from "./reply-presentation.ts";

function recordedRequest() {
  const enquiry = structuredClone(UI1_PAINTING);
  enquiry.state.decision = "WAITING_ON_CLIENT";
  enquiry.state.responsibility = "CUSTOMER";
  enquiry.conversation.push({
    ...enquiry.conversation[1],
    id: "recorded-reply",
    direction: "outbound",
    body: enquiry.decision.draft.body,
  });
  return enquiry;
}

test("an unsent information request keeps its prepared reply", () => {
  assert.equal(isWaitingForInformation(UI1_PAINTING), false);
});

test("a recorded information request shows waiting without changing source data", () => {
  const enquiry = recordedRequest();
  const before = structuredClone(enquiry);
  assert.equal(isWaitingForInformation(enquiry), true);
  assert.deepEqual(enquiry, before);
});

test("a new inbound message cannot be hidden by a stale waiting state", () => {
  const enquiry = recordedRequest();
  enquiry.conversation.push({ ...UI1_PAINTING.conversation[1], id: "new-inbound" });
  assert.equal(isWaitingForInformation(enquiry), false);
});

test("a new decision or follow-up retains its action surface", () => {
  const enquiry = recordedRequest();
  enquiry.state.decision = "ACTION_READY";
  assert.equal(isWaitingForInformation(enquiry), false);
  enquiry.state.decision = "WAITING_ON_CLIENT";
  enquiry.decision.recommendation.action = "FOLLOW_UP";
  assert.equal(isWaitingForInformation(enquiry), false);
});

test("a blocked recommendation remains visible", () => {
  const enquiry = recordedRequest();
  enquiry.decision.recommendation.blockedReason = "Availability needs checking";
  assert.equal(isWaitingForInformation(enquiry), false);
});

test("closed and business-owned decisions never use the information waiting view", () => {
  const enquiry = recordedRequest();
  enquiry.state.responsibility = "BUSINESS";
  assert.equal(isWaitingForInformation(enquiry), false);
  enquiry.state.responsibility = "CUSTOMER";
  enquiry.state.lifecycle = "BOOKED";
  assert.equal(isWaitingForInformation(enquiry), false);
});
