import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { BUSINESSES } from "../fixtures/businesses.ts";
import {
  autopilotEligible,
  enableFollowUp,
  isCustomerFacingSend,
  needsSendConfirm,
  proposeRevision,
  snoozeEnquiry,
  isSnoozed,
  defaultHold,
  resolvedHold,
} from "./commercial.ts";
import { ACTION_CATALOGUE } from "./action-catalogue.ts";
import { detectSheetLetterMismatch, alignLetterToSheet } from "./voice-detect.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("follow-up after silence re-enables send without rewriting the sent sheet", () => {
  const priya = structuredClone(byId("f01"));
  priya.state.commercial = "QUOTED";
  priya.state.decision = "WAITING_ON_CLIENT";
  priya.decision.quotes = priya.decision.quotes.map((q) =>
    q.status === "draft" ? { ...q, status: "sent" as const } : q,
  );
  const next = enableFollowUp(priya);
  assert.equal(next.followUpDue, true);
  assert.equal(next.decision.recommendation.action, "FOLLOW_UP");
  assert.equal(next.decision.recommendation.primaryEnabled, true);
  assert.equal(next.decision.quotes.find((q) => q.status === "sent")?.status, "sent");
});

test("a revision adds a new draft and leaves the sent sheet on file", () => {
  const marcus = structuredClone(byId("f08"));
  const next = proposeRevision(marcus);
  const sent = next.decision.quotes.find((q) => q.status === "sent");
  const draft = next.decision.quotes.find((q) => q.status === "draft");
  assert.ok(sent);
  assert.ok(draft);
  assert.equal(draft!.version, (sent!.version ?? 1) + 1);
  assert.equal(next.decision.recommendation.action, "SEND_QUOTE");
  assert.equal(next.state.decision, "ACTION_READY");
  assert.match(next.decision.draft.body, /previous quote stays/);
});

test("F15 is Autopilot-eligible only when the action class is Automatic when safe", () => {
  const chris = byId("f15");
  const glow = structuredClone(BUSINESSES.find((b) => b.id === "glow")!);
  assert.equal(autopilotEligible(chris, glow, "REQUEST_INFORMATION"), false);
  glow.actionPolicies = glow.actionPolicies.map((p) =>
    p.action === "REQUEST_INFORMATION" ? { ...p, mode: "Automatic when safe" as const } : p,
  );
  assert.equal(autopilotEligible(chris, glow, "REQUEST_INFORMATION"), true);
  glow.paused = true;
  assert.equal(autopilotEligible(chris, glow, "REQUEST_INFORMATION"), false);
});

test("F12 complaint is never Autopilot-eligible", () => {
  const gwen = byId("f12");
  const harbour = BUSINESSES.find((b) => b.id === "harbour")!;
  assert.equal(gwen.decision.risk, "PROHIBITED_AUTO");
  assert.equal(autopilotEligible(gwen, harbour, gwen.decision.recommendation.action), false);
});

test("send confirm is required for every commercial send, regardless of amount or risk", () => {
  // Priya's $625 quote is LOW risk and well under the old $2000 floor - it
  // still must not skip the preview. The floor is unconditional now; amount
  // and risk no longer decide whether a preview exists, only how much
  // friction sits on top of it.
  const priya = byId("f01");
  assert.equal(priya.decision.risk, "LOW");
  assert.equal(needsSendConfirm(priya), true, "a low-risk, under-$2000 quote still needs a preview");

  const harper = structuredClone(byId("f05"));
  harper.decision.recommendation.action = "SEND_QUOTE";
  harper.valueExact = { amount: 4800, currency: "AUD" };
  assert.equal(needsSendConfirm(harper), true, "large/high-risk quotes still need a preview");

  const tinyQuote = structuredClone(byId("f01"));
  tinyQuote.valueExact = { amount: 12, currency: "AUD" };
  tinyQuote.decision.risk = "LOW";
  assert.equal(needsSendConfirm(tinyQuote), true, "for ANY amount, not just amounts above a floor");

  const estimate = structuredClone(byId("f01"));
  estimate.decision.recommendation.action = "SEND_ESTIMATE";
  estimate.decision.risk = "LOW";
  estimate.valueExact = { amount: 5, currency: "AUD" };
  assert.equal(needsSendConfirm(estimate), true, "SEND_ESTIMATE is governed the same as SEND_QUOTE");

  const nonSend = structuredClone(byId("f01"));
  nonSend.decision.recommendation.action = "REQUEST_INFORMATION";
  assert.equal(needsSendConfirm(nonSend), false, "non-send actions never need a send preview");
});

test("isCustomerFacingSend covers every action-catalogue class - the floor a business can be granted is always a send", () => {
  // ACTION_CATALOGUE is the product's own list of action classes a business
  // can be permitted to perform (action-catalogue.ts). Every one of them is,
  // by definition, a customer-facing send - REQUEST_INFORMATION included,
  // which carries no amount and no risk above LOW but still writes a real
  // outbound record when sent.
  for (const entry of ACTION_CATALOGUE) {
    assert.equal(
      isCustomerFacingSend(entry.action),
      true,
      `${entry.action} is in ACTION_CATALOGUE and must be gated as a customer-facing send`,
    );
  }
});

test("isCustomerFacingSend also covers the sendable actions not yet promoted into the catalogue", () => {
  // ACKNOWLEDGE, SEND_QUALIFICATION_RESPONSE, SEND_AVAILABILITY,
  // RECOMMEND_OFFER and OFFER_BOOKING reach the exact same primary button and
  // the exact same commitSend/recordSent call as the six catalogue actions -
  // they are just not yet action classes a business can be granted autonomy
  // over. Missing this list was the actual bug: ACKNOWLEDGE (the "Needs
  // info"/no-amount reply) went straight to commitSend with no preview.
  for (const action of [
    "ACKNOWLEDGE",
    "SEND_QUALIFICATION_RESPONSE",
    "SEND_AVAILABILITY",
    "RECOMMEND_OFFER",
    "OFFER_BOOKING",
  ] as const) {
    assert.equal(isCustomerFacingSend(action), true, `${action} must be gated as a customer-facing send`);
  }
});

test("isCustomerFacingSend is false for actions that never write an outbound record", () => {
  for (const action of ["ROUTE_ENQUIRY", "WAIT", "ESCALATE_HUMAN", "NO_ACTION"] as const) {
    assert.equal(isCustomerFacingSend(action), false, `${action} must not be gated as a send - it never reaches commitSend`);
  }
});

test("snooze hides an enquiry from needs-you until the time passes", () => {
  const next = snoozeEnquiry(byId("f01"), new Date(Date.now() + 86_400_000).toISOString());
  assert.equal(isSnoozed(next), true);
  const past = snoozeEnquiry(byId("f01"), new Date(Date.now() - 1000).toISOString());
  assert.equal(isSnoozed(past), false);
});

test("hold is a human fee, not 30% to the dollar", () => {
  assert.equal(defaultHold(625)?.amount, 190);
  assert.equal(defaultHold(100)?.amount, 50);
  assert.equal(defaultHold(80), undefined);
});

test("resolved hold prefers the figure on the sheet", () => {
  assert.equal(resolvedHold({ total: { amount: 625 } })?.amount, 190);
  assert.equal(
    resolvedHold({ total: { amount: 625 }, hold: { amount: 190, currency: "AUD", label: "To hold the date" } })
      ?.amount,
    190,
  );
});

test("a letter that says $187 against a $190 hold is a mismatch", () => {
  const miss = detectSheetLetterMismatch(
    "If you'd like to hold the date, a $187 booking fee does that.",
    { total: 625, hold: 190 },
  );
  assert.ok(miss);
  assert.equal(miss!.sheet, "$190");
  assert.equal(miss!.letter, "$187");
  const fixed = alignLetterToSheet(
    "If you'd like to hold the date, a $187 booking fee does that. Makeup is $625.",
    { total: 625, hold: 190 },
  );
  assert.match(fixed, /\$190/);
  assert.doesNotMatch(fixed, /\$187/);
  assert.match(fixed, /\$625/);
});

test("fixture letters do not contradict the hold on the sheet", () => {
  for (const e of ENQUIRIES) {
    const quote = [...e.decision.quotes].reverse().find((q) => q.status === "draft" || q.status === "accepted")
      ?? e.decision.quotes[e.decision.quotes.length - 1];
    if (!quote) continue;
    const hold = resolvedHold(quote);
    const miss = detectSheetLetterMismatch(e.decision.draft.body, {
      total: quote.total?.amount,
      hold: hold?.amount,
    });
    assert.equal(miss, null, `${e.id} letter ${miss?.letter} vs sheet ${miss?.sheet}`);
  }
});

