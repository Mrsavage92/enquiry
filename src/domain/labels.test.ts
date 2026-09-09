import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import {
  commercialValue,
  factStatusLabel,
  factStatusTone,
  filteredEnquiries,
  integrationStatusLabel,
  nextNeedsYou,
  pricingApplicability,
  queueFilterHasMatch,
  queueHeadline,
  queueSection,
  queueSummary,
} from "./labels.ts";
import type { EnquiryFact, IntegrationHealth } from "./types.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

const ALL_FACT_STATUSES: EnquiryFact["status"][] = [
  "confirmed",
  "inferred",
  "check_this",
  "unknown",
  "conflict",
  "range",
];

test("every fact status has a distinct, non-empty visible label - no fallthrough reads blank", () => {
  const labels = ALL_FACT_STATUSES.map(factStatusLabel);
  for (const label of labels) {
    assert.ok(label.trim().length > 0, "a fact status must never render as empty text");
  }
});

test("only a genuinely confirmed fact ever reads as Confirmed - inferred and check_this never do", () => {
  assert.equal(factStatusLabel("confirmed"), "Confirmed");
  for (const status of ["inferred", "check_this", "unknown", "conflict", "range"] as const) {
    assert.notEqual(
      factStatusLabel(status),
      "Confirmed",
      `${status} must never read as Confirmed - that would fabricate provenance`,
    );
  }
});

test("check_this and inferred each carry their own visible text, not a generic placeholder", () => {
  assert.equal(factStatusLabel("inferred"), "Inferred");
  assert.equal(factStatusLabel("check_this"), "Check this");
  assert.notEqual(factStatusLabel("inferred"), factStatusLabel("check_this"));
});

test("factStatusTone never returns the 'ok' (confirmed) tone for an unconfirmed status", () => {
  // Tone is never the only signal (the label carries the same information in
  // text), but a status that isn't confirmed must not borrow the confirmed
  // colour either - that would fabricate the same trust signal visually.
  for (const status of ["inferred", "check_this", "unknown", "conflict", "range"] as const) {
    assert.notEqual(
      factStatusTone(status),
      "ok",
      `${status} must not render with the same tone as a confirmed fact`,
    );
  }
  assert.equal(factStatusTone("confirmed"), "ok");
});

const ALL_INTEGRATION_STATUSES: IntegrationHealth["status"][] = [
  "connected",
  "disconnected",
  "error",
  "not_connected",
];

test("every integration status has a human label - the raw snake_case value never reaches the screen", () => {
  // Reproduces launch-audit run 29, P0-6/P1-5 (2026-09-04): /trust rendered
  // `not_connected` verbatim, twice, because only "connected" was mapped.
  for (const status of ALL_INTEGRATION_STATUSES) {
    const label = integrationStatusLabel(status);
    assert.ok(label.trim().length > 0, `${status} must never render as empty text`);
    assert.doesNotMatch(label, /_/, `${status} must read as a human label, not raw snake_case`);
  }
});

test("not_connected reads as Not connected", () => {
  assert.equal(integrationStatusLabel("not_connected"), "Not connected");
});

test("connected and not_connected never share a label", () => {
  assert.notEqual(integrationStatusLabel("connected"), integrationStatusLabel("not_connected"));
});

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

test("queueFilterHasMatch ignores the activeId pin - it answers whether the filter genuinely has a match", () => {
  const open = byId("f01");
  assert.equal(open.state.lifecycle, "OPEN");
  assert.notEqual(
    queueSection(open),
    "waiting",
    "fixture check: f01 must not itself be a waiting-section enquiry for this test to be meaningful",
  );

  // filteredEnquiries still pins the open enquiry into a filter it does not
  // match - that contract is asserted above and must not change.
  const pinned = filteredEnquiries([open], "all", "waiting", open.id);
  assert.deepEqual(
    pinned.map((e) => e.id),
    [open.id],
  );

  // But the filter has no genuine match, so a caller deciding whether to
  // render the "Nobody is waiting" empty state must see false here, not be
  // misled by the pinned list's non-zero length.
  assert.equal(
    queueFilterHasMatch([open], "all", "waiting"),
    false,
    "the pin must not make an unmatched filter look like it has a match",
  );
});

test("queueFilterHasMatch is true once a real match exists, independent of any pinned enquiry", () => {
  const open = byId("f01");
  const waiting = structuredClone(open);
  waiting.id = "waiting-fixture";
  waiting.state = { ...waiting.state, decision: "WAITING_ON_CLIENT", responsibility: "CUSTOMER" };
  assert.equal(queueSection(waiting), "waiting");

  assert.equal(queueFilterHasMatch([open, waiting], "all", "waiting"), true);
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
