import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SIGNATURE_DEMO,
  signatureChangedFactIds,
  signatureState,
} from "./signature-demo.ts";

test("Ridge & Co demo begins as a website form and continues as a text", () => {
  assert.equal(SIGNATURE_DEMO.business, "Ridge & Co Painting");
  assert.equal(SIGNATURE_DEMO.form.channel, "Website form");
  assert.equal(SIGNATURE_DEMO.text.channel, "Text message");
  assert.match(SIGNATURE_DEMO.form.message, /New Farm/i);
  assert.match(SIGNATURE_DEMO.text.message, /ceilings/i);
});

test("the later text is linked by the same mobile number, not a guessed identity", () => {
  assert.ok(SIGNATURE_DEMO.text.link);
  assert.match(SIGNATURE_DEMO.text.link!.label, /existing enquiry/i);
  assert.match(SIGNATURE_DEMO.text.link!.reason, /mobile number/i);
  assert.match(SIGNATURE_DEMO.phone, /^04\d{2} \d{3} \d{3}$/);
});

test("deadline and scope are the facts that change", () => {
  const ids = signatureChangedFactIds(SIGNATURE_DEMO.form, SIGNATURE_DEMO.text);
  assert.deepEqual(ids.sort(), ["deadline", "scope"]);
  const deadline = SIGNATURE_DEMO.text.facts.find((f) => f.id === "deadline");
  const scope = SIGNATURE_DEMO.text.facts.find((f) => f.id === "scope");
  assert.equal(deadline?.from, "18 Sep");
  assert.equal(deadline?.value, "16 Sep");
  assert.match(scope?.value ?? "", /ceilings/);
});

test("capacity and next action change; price is not the payoff", () => {
  const form = signatureState("form");
  const text = signatureState("text");
  assert.notEqual(form.nextAction, text.nextAction);
  assert.match(form.nextAction, /site measure/i);
  assert.match(text.nextAction, /extra crew/i);
  const formCap = form.checks.find((c) => c.id === "capacity");
  const textCap = text.checks.find((c) => c.id === "capacity");
  assert.match(formCap?.value ?? "", /Feasible/);
  assert.match(textCap?.value ?? "", /condition/);
  assert.equal(textCap?.changed, true);
  assert.match(textCap?.why ?? "", /two painters/i);
  const blob = `${form.nextAction} ${text.nextAction} ${form.want} ${text.want}`;
  assert.doesNotMatch(blob, /\$\d/);
  assert.match(form.commercialNote, /measure/i);
});
