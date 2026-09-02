import assert from "node:assert/strict";
import test from "node:test";
import { activeRules, decideEnquiry } from "./decide.ts";

const rule = {
  kind: "per_unit", service: "Group makeup", amount: 145, currency: "AUD",
  unit: "person", quantityField: "guests", minimumQuantity: 3,
};
const knowledge = (state: string, payload: unknown = rule) =>
  ({ id: "k1", businessId: "b", section: "pricing", title: "Group makeup", body: "",
     class: "authoritative", state, source: {}, version: "1", rulePayload: payload }) as never;
const fact = (field: string, value: string, status = "confirmed") =>
  ({ id: "f", field, label: field, value, displayValue: value, status,
     confidence: "High", assertedBy: "customer", provenance: {} }) as never;

test("a priced enquiry is ready to quote", () => {
  const d = decideEnquiry({ knowledge: [knowledge("Active")] },
    { serviceLabel: "Group makeup", facts: [fact("guests", "4")] });
  assert.equal(d.action, "SEND_QUOTE");
  assert.equal(d.price.kind, "EXACT");
  if (d.price.kind === "EXACT") assert.equal(d.price.amountMinor, 58000);
});

test("a missing decision-critical fact asks for exactly one thing", () => {
  const d = decideEnquiry({ knowledge: [knowledge("Active")] },
    { serviceLabel: "Group makeup", facts: [] });
  assert.equal(d.action, "REQUEST_INFORMATION");
  assert.equal(d.blocker?.field, "guests");
});

test("only Active knowledge can price - confirmation must mean something", () => {
  for (const state of ["Proposed", "Confirmed", "Needs review", "Superseded", "Disabled"]) {
    const d = decideEnquiry({ knowledge: [knowledge(state)] },
      { serviceLabel: "Group makeup", facts: [fact("guests", "4")] });
    assert.equal(d.action, "ESCALATE_HUMAN", `${state} must not price`);
  }
});

test("a business with no rules escalates and says why - it does not invent a price", () => {
  const d = decideEnquiry({ knowledge: [] }, { serviceLabel: "Anything", facts: [] });
  assert.equal(d.action, "ESCALATE_HUMAN");
  assert.match(d.explanation, /No pricing rules are set up yet/);
});

test("a service nothing covers escalates by name", () => {
  const d = decideEnquiry({ knowledge: [knowledge("Active")] },
    { serviceLabel: "Wedding photography", facts: [] });
  assert.equal(d.action, "ESCALATE_HUMAN");
  assert.match(d.explanation, /Wedding photography/);
});

test("a malformed rule payload is ignored, never half-applied", () => {
  const d = decideEnquiry({ knowledge: [knowledge("Active", { kind: "per_unit", amount: "lots" })] },
    { serviceLabel: "Group makeup", facts: [fact("guests", "4")] });
  assert.equal(d.action, "ESCALATE_HUMAN");
});

test("activeRules only returns validated, Active, machine-usable rules", () => {
  assert.equal(activeRules({ knowledge: [knowledge("Active")] }).length, 1);
  assert.equal(activeRules({ knowledge: [knowledge("Proposed")] }).length, 0);
  assert.equal(activeRules({ knowledge: [knowledge("Active", null)] }).length, 0);
  assert.equal(activeRules({ knowledge: [] }).length, 0);
});

test("an unconfirmed quantity blocks rather than prices", () => {
  const d = decideEnquiry({ knowledge: [knowledge("Active")] },
    { serviceLabel: "Group makeup", facts: [fact("guests", "4", "inferred")] });
  assert.equal(d.action, "REQUEST_INFORMATION");
});
