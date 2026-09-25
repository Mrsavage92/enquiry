import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HARBOUR_SOLO_RULE,
  RIDGE_CREW_WINDOW_RULE,
  SIGNATURE_BUSINESSES,
  SIGNATURE_DEMO,
  signatureChangedFactIds,
  signatureState,
} from "./signature-demo.ts";

const FIXTURE_PHONES = ["0412 880 441", "0412 773 091", "07 3000 0000", "+61 4 glow"];

test("Ridge & Co demo begins as a website form and continues as a text", () => {
  assert.equal(SIGNATURE_DEMO.business, "Sample business · Ridge & Co Painting");
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
  const brain = readFileSync(new URL("../../fixtures/businesses.ts", import.meta.url), "utf8");
  assert.match(brain, /id: "rd-crew-window"/);
  assert.ok(brain.includes(RIDGE_CREW_WINDOW_RULE.body));
  assert.match(brain, /source: src\("user", "Tom"\)/);
});

test("the same message gets a different correct answer at the second business", () => {
  assert.equal(SIGNATURE_BUSINESSES.length, 2);
  const ridge = signatureState("form", "ridge");
  const harbour = signatureState("form", "harbour");
  // Identical customer input: message, facts, channel.
  assert.equal(ridge.message, harbour.message);
  assert.deepEqual(ridge.facts, harbour.facts);
  // Different business rule, different next step.
  assert.notEqual(ridge.nextAction, harbour.nextAction);
  assert.match(harbour.nextAction, /full week/i);
  const cap = harbour.checks.find((c) => c.id === "capacity");
  assert.match(cap?.why ?? "", /alone/i);
  assert.equal(cap?.why, HARBOUR_SOLO_RULE.body);
});

test("one changed fact moves each business's answer for its own reason", () => {
  const ridge = signatureState("text", "ridge");
  const harbour = signatureState("text", "harbour");
  assert.equal(ridge.message, harbour.message);
  assert.match(ridge.nextAction, /extra crew/i);
  assert.match(harbour.nextAction, /say no/i);
  const eligibility = harbour.checks.find((c) => c.id === "eligibility");
  assert.equal(eligibility?.tone, "block");
  assert.match(eligibility?.value ?? "", /not offered/i);
  const capacity = harbour.checks.find((c) => c.id === "capacity");
  assert.match(capacity?.value ?? "", /not possible/i);
  // No invented price anywhere in either answer.
  const blob = `${ridge.nextAction} ${harbour.nextAction} ${harbour.nextReason} ${harbour.commercialNote}`;
  assert.doesNotMatch(blob, /\$\d/);
});

test("an unknown business id falls back to Ridge rather than throwing", () => {
  assert.equal(signatureState("form", "nope" as never).nextAction, SIGNATURE_DEMO.form.nextAction);
});

test("every business x scene combination carries a plain Yes / No / Not yet verdict", () => {
  for (const business of SIGNATURE_BUSINESSES) {
    for (const scene of ["form", "text"] as const) {
      const state = signatureState(scene, business.id);
      assert.ok(state.verdict && state.verdict.length > 0, `${business.id}/${scene} has a verdict`);
      assert.match(
        state.verdict,
        /\b(Yes|No|Not yet)\b/,
        `${business.id}/${scene} verdict "${state.verdict}" names a Yes/No/Not yet answer`,
      );
    }
  }
  assert.equal(SIGNATURE_DEMO.form.verdict, "Not yet - measure first");
  assert.equal(SIGNATURE_DEMO.text.verdict, "Yes, with a condition");
  assert.equal(signatureState("form", "harbour").verdict, "Not yet - measure first, hold the week");
  assert.equal(
    signatureState("text", "harbour").verdict,
    "No to the 16th - offer the next full week",
  );
});

test("each check's tone matches what its value says", () => {
  for (const business of SIGNATURE_BUSINESSES) {
    for (const scene of ["form", "text"] as const) {
      for (const check of signatureState(scene, business.id).checks) {
        const where = `${business.id}/${scene}/${check.id}`;
        if (/not possible|not offered/i.test(check.value))
          assert.equal(check.tone, "block", `${where} rules the request out`);
        if (/provisional|need a measure/i.test(check.value))
          assert.equal(check.tone, "check", `${where} holds only after a check`);
        if (check.tone === "ok")
          assert.doesNotMatch(check.value, /provisional|measure|not /i, `${where} is really clear`);
      }
    }
  }
  assert.match(
    signatureState("text", "harbour").nextReason,
    /^Same conversation, different business\./,
  );
});
