import assert from "node:assert/strict";
import test from "node:test";
import { createAnthropicInterpreter } from "./anthropic-interpreter.server.ts";
import type { AnthropicTransport } from "./anthropic-interpreter.server.ts";

/**
 * No real network call, no key, anywhere in this file. Every scenario is
 * driven through the injectable `transport` - the only place
 * `anthropic-interpreter.server.ts` reaches `@anthropic-ai/sdk`, and it is
 * never invoked here.
 */

const business = { services: ["Group makeup"], ruleSummaries: [], industry: "beauty" };
const input = { rawMessage: "Need makeup for 4 people", messageId: "m1", business };

const VALID_JSON = JSON.stringify({
  serviceCandidate: { label: "Group makeup", confidence: "medium", span: "makeup" },
  facts: [
    {
      field: "guests",
      value: "4",
      displayValue: "4 guests",
      confidence: "medium",
      span: "4 people",
    },
  ],
  ambiguities: [],
  candidateMissingFacts: [],
});

test("a well-formed JSON reply resolves ok with the parsed result and model id", async () => {
  const transport: AnthropicTransport = async () => VALID_JSON;
  const interpreter = createAnthropicInterpreter({
    apiKey: "sk-test",
    model: "claude-haiku-4-5",
    transport,
  });
  const outcome = await interpreter.interpret(input);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.model, "claude-haiku-4-5");
  assert.equal(outcome.result.facts.length, 1);
  assert.equal(outcome.result.facts[0]?.field, "guests");
  assert.equal(outcome.result.serviceCandidate?.label, "Group makeup");
});

test("non-JSON text classifies as invalid_output", async () => {
  const transport: AnthropicTransport = async () => "not json at all";
  const interpreter = createAnthropicInterpreter({ apiKey: "sk-test", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "invalid_output" });
});

test("valid JSON in the wrong shape classifies as invalid_output", async () => {
  const transport: AnthropicTransport = async () => JSON.stringify({ hello: "world" });
  const interpreter = createAnthropicInterpreter({ apiKey: "sk-test", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "invalid_output" });
});

test("an adversarial payload smuggling an extra action-like key is rejected as invalid_output", async () => {
  const transport: AnthropicTransport = async () =>
    JSON.stringify({
      serviceCandidate: null,
      facts: [],
      ambiguities: [],
      candidateMissingFacts: [],
      action: "approve",
      price: 1,
    });
  const interpreter = createAnthropicInterpreter({ apiKey: "sk-test", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "invalid_output" });
});

test("an abort past the deadline classifies as timeout, not provider_error", async () => {
  const transport: AnthropicTransport = ({ signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const interpreter = createAnthropicInterpreter({
    apiKey: "sk-test",
    timeoutMs: 20,
    transport,
  });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "timeout" });
});

test("a thrown transport error classifies as provider_error", async () => {
  const transport: AnthropicTransport = async () => {
    throw new Error("503 from the provider");
  };
  const interpreter = createAnthropicInterpreter({ apiKey: "sk-test", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "provider_error" });
});

test("no key configured resolves to no_provider without ever calling the transport", async () => {
  let called = false;
  const transport: AnthropicTransport = async () => {
    called = true;
    return VALID_JSON;
  };
  const interpreter = createAnthropicInterpreter({ apiKey: "", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "no_provider" });
  assert.equal(called, false, "the transport must never be reached with no key");
});

test("a blank/whitespace-only key also resolves to no_provider", async () => {
  const transport: AnthropicTransport = async () => VALID_JSON;
  const interpreter = createAnthropicInterpreter({ apiKey: "   ", transport });
  const outcome = await interpreter.interpret(input);
  assert.deepEqual(outcome, { ok: false, reason: "no_provider" });
});
