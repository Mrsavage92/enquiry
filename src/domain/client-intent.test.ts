import assert from "node:assert/strict";
import { test } from "node:test";
import { detectClientIntent } from "./client-intent.ts";

test("yes / lock it in is an accept", () => {
  assert.equal(detectClientIntent("Yes that works. Please lock it in."), "accept");
  assert.equal(detectClientIntent("Sounds good — book us"), "accept");
  assert.equal(detectClientIntent("Perfect, go ahead"), "accept");
});

test("a question is a question", () => {
  assert.equal(detectClientIntent("Could we move the date?"), "question");
  assert.equal(detectClientIntent("What about Sunday instead?"), "question");
  assert.equal(detectClientIntent("Can you do 3pm instead"), "question");
});

test("empty is other", () => {
  assert.equal(detectClientIntent("  "), "other");
  assert.equal(detectClientIntent("We'll think about it"), "other");
  assert.equal(detectClientIntent("Thanks"), "other");
});
