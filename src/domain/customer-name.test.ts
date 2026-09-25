import assert from "node:assert/strict";
import { test } from "node:test";
import { displayName, firstName, initialsOf, sentence, UNKNOWN_CUSTOMER } from "./customer-name.ts";

test("no name never renders blank", () => {
  for (const e of [{ customerName: "" }, { customerName: "   " }, { customerName: null }, {}]) {
    assert.equal(displayName(e), UNKNOWN_CUSTOMER);
    assert.equal(initialsOf(e), "?");
    assert.equal(firstName(e), "the customer");
  }
  assert.equal(displayName({ customerName: "Customer", nameUnknown: true }), "Customer");
  assert.equal(initialsOf({ customerName: "Customer", nameUnknown: true }), "?");
});

test("a real name reads as written", () => {
  const karen = { customerName: "Karen Mills" };
  assert.equal(displayName(karen), "Karen Mills");
  assert.equal(firstName(karen), "Karen");
  assert.equal(initialsOf(karen), "KM");
});

test("generated sentences start with a capital", () => {
  assert.equal(sentence(`${firstName({})} answered?`), "The customer answered?");
  assert.equal(sentence("Karen answered?"), "Karen answered?");
  assert.equal(sentence(""), "");
});
