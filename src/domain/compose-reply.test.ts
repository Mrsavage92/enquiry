import assert from "node:assert/strict";
import test from "node:test";
import { askFor, composeReply, spokenDate } from "./compose-reply.ts";
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
  assert.match(body, /can you let me know how many guests there are\?/);
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
  assert.match(body, /^Hi there,/);
  assert.ok(body.trim().length > 0);
});

test("the draft never contains an em dash", () => {
  const decision = decideEnquiry(perUnit, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "5", status: "confirmed" }],
  } as never);
  assert.doesNotMatch(composeReply(decision, { customerName: "Jo" }), /\u2014/);
});

test("the missing-detail question reads naturally for plural and singular fields", () => {
  assert.equal(askFor("bedrooms"), "can you let me know how many bedrooms there are?");
  assert.equal(askFor("gutter_metres"), "can you let me know how many gutter metres there are?");
  assert.equal(askFor("address"), "can you let me know the address?");
  assert.equal(askFor("quantity"), "can you let me know the quantity?");
});

test("a date the customer asked about is acknowledged, never ignored or promised", () => {
  const blocked = decideEnquiry(perUnit, { serviceLabel: "Group makeup", facts: [] });
  const priced = decideEnquiry(perUnit, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "5", status: "confirmed" }],
  } as never);
  const none = decideEnquiry({ knowledge: [] }, { serviceLabel: "Anything", facts: [] });
  for (const decision of [blocked, priced, none]) {
    const body = composeReply(decision, { customerName: "Karen", jobDateIso: "2026-10-03" });
    assert.match(body, /I'll confirm whether Saturday 3 October works\./);
    // No availability is known, so nothing claims the day is free.
    assert.doesNotMatch(body, /\b(is free|is available|we can do)\b/i);
  }
  const without = composeReply(blocked, { customerName: "Karen" });
  assert.doesNotMatch(without, /confirm whether/);
});

test("spokenDate reads an ISO day as words and refuses anything else", () => {
  assert.equal(spokenDate("2026-10-03"), "Saturday 3 October");
  assert.equal(spokenDate("2026-02-30"), null);
  assert.equal(spokenDate("Sat 3 Oct"), null);
  assert.equal(spokenDate(undefined), null);
});

test("a count the customer already gave is never asked for again", () => {
  const decision = decideEnquiry(perUnit, {
    serviceLabel: "Group makeup",
    facts: [{ field: "guests", value: "4", status: "inferred", displayValue: "4 people" }],
  } as never);
  assert.equal(decision.blocker?.inferred?.value, "4");
  const body = composeReply(decision, { customerName: "Sarah" });
  assert.doesNotMatch(body, /how many|let me know/i);
  assert.match(body, /4 guests you mentioned/);
});
