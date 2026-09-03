import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import {
  commercialValue,
  filteredEnquiries,
  nextNeedsYou,
  pricingApplicability,
  queueHeadline,
  queueSection,
  queueSummary,
} from "./labels.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("Priya is an exact quote", () => {
  const v = commercialValue(byId("f01"));
  assert.equal(v.kind, "exact");
  assert.equal(v.amountLabel, "$625");
  assert.equal(v.caption, "Exact quote");
});

test("Jordan's event hours are an estimate", () => {
  const v = commercialValue(byId("f02"));
  assert.equal(v.kind, "estimate");
  assert.equal(v.amountLabel, "$720–$1,080");
});

test("A. Patel has no invented price", () => {
  const v = commercialValue(byId("f03"));
  assert.equal(pricingApplicability(byId("f03")), "applicable");
  assert.equal(v.kind, "not_ready");
  assert.equal(v.amountLabel, "Price not ready");
});

test("Chris's assumed $210 is not a locked exact quote", () => {
  const v = commercialValue(byId("f15"));
  assert.equal(v.kind, "not_ready");
  assert.equal(v.amountLabel, "Price not ready");
});

test("Elena's price conflict is not ready", () => {
  const v = commercialValue(byId("f11"));
  assert.equal(v.kind, "not_ready");
});

test("Tash's Instagram DM is an exact quote", () => {
  const v = commercialValue(byId("f18"));
  assert.equal(v.kind, "exact");
  assert.equal(v.amountLabel, "$210");
});

test("Rowan (F17) pricing is not applicable - not 'Price not ready'", () => {
  const enquiry = byId("f17");
  assert.equal(pricingApplicability(enquiry), "not_applicable");
  const v = commercialValue(enquiry);
  assert.equal(v.kind, "not_applicable");
  assert.equal(v.amountLabel, "");
  assert.notEqual(v.amountLabel, "Price not ready");
  assert.doesNotMatch(v.caption, /price not ready/i);
  assert.doesNotMatch(`${v.amountLabel} ${v.caption}`, /\$0|N\/A|No price/i);
});

test("nextNeedsYou skips the current card", () => {
  const current = ENQUIRIES.find((e) => queueSection(e) === "needs_you");
  assert.ok(current);
  const next = nextNeedsYou(ENQUIRIES, "all", current.id);
  assert.ok(next);
  assert.notEqual(next, current.id);
  assert.equal(queueSection(ENQUIRIES.find((e) => e.id === next)!), "needs_you");
});

test("queue summary is attention-first and does not require a commercial aggregate", () => {
  const all = queueSummary(ENQUIRIES);
  assert.ok(all.needsYou >= 0);
  assert.equal(queueHeadline(all), all.needsYou === 0 ? "Caught up" : `${all.needsYou} need you`);
  assert.doesNotMatch(queueHeadline(all), /Open exact|\$/);

  const rowanOnly = queueSummary([byId("f17")]);
  assert.equal(rowanOnly.exactCount, 0);
  assert.equal(rowanOnly.exactValue, 0);
  assert.equal(queueHeadline(rowanOnly), `${rowanOnly.needsYou} need you`);
  assert.ok(rowanOnly.needsYou >= 1);
});

test("the queue's closed filter includes a declined live enquiry", () => {
  const declined = structuredClone(byId("f01"));
  declined.state = { ...declined.state, lifecycle: "DECLINED" };
  const open = byId("f02");
  const all = [declined, open];

  const closed = filteredEnquiries(all, "all", "closed");
  assert.deepEqual(
    closed.map((e) => e.id),
    [declined.id],
  );

  const needsYou = filteredEnquiries(all, "all", "needs_you");
  assert.ok(
    !needsYou.some((e) => e.id === declined.id),
    "a declined enquiry does not also sit in an attention section",
  );
});

test("the closed filter still surfaces the active enquiry even when it is open", () => {
  const open = byId("f01");
  const result = filteredEnquiries([open], "all", "closed", open.id);
  assert.deepEqual(
    result.map((e) => e.id),
    [open.id],
    "activeId always wins, regardless of the filter",
  );
});

test("a live enquiry with a structural quote but no evaluators still reads as an exact commercial value (queue row parity)", () => {
  const noEvaluators = structuredClone(byId("f01"));
  noEvaluators.decision.evaluators = [];
  noEvaluators.valueExact = { amount: 580, currency: "AUD" };
  assert.equal(pricingApplicability(noEvaluators), "applicable");
  const v = commercialValue(noEvaluators);
  assert.equal(v.kind, "exact");
  assert.equal(v.amountLabel, "$580");
});

test("a live enquiry with neither evaluators nor a value stays not_applicable, never a fabricated figure", () => {
  const bare = structuredClone(byId("f01"));
  bare.decision.evaluators = [];
  bare.valueExact = undefined;
  bare.valueRange = undefined;
  assert.equal(pricingApplicability(bare), "not_applicable");
  assert.equal(commercialValue(bare).amountLabel, "");
});
