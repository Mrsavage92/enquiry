import assert from "node:assert/strict";
import test from "node:test";
import { composeReply } from "./compose-reply.ts";
import { decideEnquiry } from "./decide.ts";

const perUnit = {
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

test("a priced reply states the business's own total and its workings", () => {
  const decision = decideEnquiry(perUnit, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "4", status: "confirmed" }],
  } as never);
  const body = composeReply(decision, {
    customerName: "Sarah Chen",
    ownerFirstName: "Sam",
    serviceLabel: "Group makeup",
  });
  assert.match(body, /^Hi Sarah,/);
  assert.match(body, /\$580/);
  assert.match(body, /4 people at \$145 each/);
  assert.match(body, /Sam$/);
});

test("a blocked reply asks for exactly the one fact that decides the price", () => {
  const decision = decideEnquiry(perUnit, { serviceLabel: "Group makeup", facts: [] });
  const body = composeReply(decision, { customerName: "Sarah", ownerFirstName: "Sam" });
  assert.match(body, /can you let me know the guests\?/);
  // It must not name a price it does not have.
  assert.doesNotMatch(body, /\$/);
});

test("an unpriceable reply commits the business to nothing", () => {
  const decision = decideEnquiry({ knowledge: [] }, { serviceLabel: "Balloon arch", facts: [] });
  const body = composeReply(decision, { customerName: "Sarah", serviceLabel: "Balloon arch" });
  assert.doesNotMatch(body, /\$/);
  assert.match(body, /come straight back to you/);
});

test("no customer name still produces a sendable message", () => {
  const decision = decideEnquiry(perUnit, { serviceLabel: "Group makeup", facts: [] });
  const body = composeReply(decision);
  assert.match(body, /^Hi,/);
  assert.ok(body.trim().length > 0);
});

test("the draft never contains an em dash", () => {
  const decision = decideEnquiry(perUnit, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "5", status: "confirmed" }],
  } as never);
  assert.doesNotMatch(composeReply(decision, { customerName: "Jo" }), /\u2014/);
});
