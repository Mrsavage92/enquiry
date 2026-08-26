import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RIDGE_CREW_WINDOW_RULE,
  SIGNATURE_DEMO,
  signatureChangedFactIds,
  signatureState,
} from "./signature-demo.ts";

const FIXTURE_PHONES = ["0412 880 441", "0412 773 091", "07 3000 0000", "+61 4 glow"];

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

test("Maya's mobile is not already used by another fixture or integration", () => {
  assert.ok(!FIXTURE_PHONES.includes(SIGNATURE_DEMO.phone));
  const blob =
    readFileSync(new URL("../../fixtures/businesses.ts", import.meta.url), "utf8") +
    readFileSync(new URL("../../fixtures/enquiries.ts", import.meta.url), "utf8");
  assert.equal(blob.includes(SIGNATURE_DEMO.phone), false);
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
  assert.match(formCap?.value ?? "", /Provisional/);
  assert.match(formCap?.value ?? "", /two-person/i);
  assert.match(textCap?.value ?? "", /condition/);
  assert.match(textCap?.value ?? "", /third contractor/i);
  assert.equal(textCap?.changed, true);
  const blob = `${form.nextAction} ${text.nextAction} ${form.want} ${text.want}`;
  assert.doesNotMatch(blob, /\$\d/);
  assert.match(form.commercialNote, /measure/i);
});

test("capacity claims stay grounded in Tom's empty-house crew-window rule", () => {
  const form = signatureState("form");
  const text = signatureState("text");
  const formCap = form.checks.find((c) => c.id === "capacity");
  const textCap = text.checks.find((c) => c.id === "capacity");
  assert.equal(RIDGE_CREW_WINDOW_RULE.id, "rd-crew-window");
  assert.equal(formCap?.why, RIDGE_CREW_WINDOW_RULE.body);
  assert.equal(textCap?.why, RIDGE_CREW_WINDOW_RULE.body);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /five-weekday empty-house window/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /provisional until the living areas are measured/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /ceilings/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /three weekdays/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /third contractor/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /48 hours notice/i);
  const brain = readFileSync(
    new URL("../../fixtures/businesses.ts", import.meta.url),
    "utf8",
  );
  assert.match(brain, /id: "rd-crew-window"/);
  assert.ok(brain.includes(RIDGE_CREW_WINDOW_RULE.body));
  assert.match(brain, /source: src\("user", "Tom"\)/);
});
