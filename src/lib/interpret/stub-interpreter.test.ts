import assert from "node:assert/strict";
import test from "node:test";
import { isStubInterpreterEnabled, stubInterpreter } from "./stub-interpreter.ts";

const business = { services: ["Group makeup"], ruleSummaries: [], industry: "beauty" };

test("stub's provenance model is always the literal 'stub-development'", async () => {
  const outcome = await stubInterpreter.interpret({
    rawMessage: "Hi, need makeup for me and 3 bridesmaids on the 14th of November",
    messageId: "m1",
    business,
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.model, "stub-development");
});

test("stub extracts a quantity and a date fact from a plausible message", async () => {
  const outcome = await stubInterpreter.interpret({
    rawMessage: "Hi, need makeup for me and 3 bridesmaids on the 14th of November",
    messageId: "m1",
    business,
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  const guests = outcome.result.facts.find((f) => f.field === "guests");
  const date = outcome.result.facts.find((f) => f.field === "date");
  assert.ok(guests, "expected a guests fact");
  assert.equal(guests?.value, "3");
  assert.ok(date, "expected a date fact");
  assert.match(date!.displayValue, /november/i);
});

test("stub proposes the first business service as the service candidate", async () => {
  const outcome = await stubInterpreter.interpret({
    rawMessage: "How much for a wedding?",
    messageId: "m1",
    business,
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.result.serviceCandidate?.label, "Group makeup");
});

test("stub with no business services proposes no service candidate", async () => {
  const outcome = await stubInterpreter.interpret({
    rawMessage: "How much for a wedding?",
    messageId: "m1",
    business: { services: [], ruleSummaries: [], industry: "beauty" },
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.result.serviceCandidate, null);
});

test("stub with no number in the message writes no guests fact", async () => {
  const outcome = await stubInterpreter.interpret({
    rawMessage: "Hi, when are you free for makeup?",
    messageId: "m1",
    business,
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(
    outcome.result.facts.find((f) => f.field === "guests"),
    undefined,
  );
});

test("isStubInterpreterEnabled requires the explicit opt-in AND a non-production, non-Vercel environment", () => {
  const original = {
    ENQUIRY_INTERPRETER: process.env.ENQUIRY_INTERPRETER,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
  };
  try {
    process.env.ENQUIRY_INTERPRETER = "stub";
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;
    assert.equal(isStubInterpreterEnabled(), true);

    process.env.NODE_ENV = "production";
    assert.equal(
      isStubInterpreterEnabled(),
      false,
      "never in production, even with the opt-in set",
    );

    process.env.NODE_ENV = "development";
    process.env.VERCEL = "1";
    assert.equal(
      isStubInterpreterEnabled(),
      false,
      "never on Vercel, even in a non-production env",
    );

    delete process.env.VERCEL;
    process.env.ENQUIRY_INTERPRETER = "";
    assert.equal(isStubInterpreterEnabled(), false, "the opt-in must be explicit");
  } finally {
    if (original.ENQUIRY_INTERPRETER === undefined) delete process.env.ENQUIRY_INTERPRETER;
    else process.env.ENQUIRY_INTERPRETER = original.ENQUIRY_INTERPRETER;
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.NODE_ENV;
    if (original.VERCEL === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original.VERCEL;
  }
});
