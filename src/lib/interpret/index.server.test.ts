import assert from "node:assert/strict";
import test from "node:test";
import { createInterpreter } from "./index.server.ts";
import { stubInterpreter } from "./stub-interpreter.ts";
import { nullInterpreter } from "./null-interpreter.ts";

/**
 * `createInterpreter`'s precedence, with no network call ever made: the real
 * provider is only constructed, never invoked, so an Anthropic key never has
 * to be genuine for this test to run.
 */

type EnvSnapshot = {
  ENQUIRY_INTERPRETER: string | undefined;
  NODE_ENV: string | undefined;
  VERCEL: string | undefined;
  ANTHROPIC_API_KEY: string | undefined;
};

function snapshotEnv(): EnvSnapshot {
  return {
    ENQUIRY_INTERPRETER: process.env.ENQUIRY_INTERPRETER,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}

function restoreEnv(original: EnvSnapshot): void {
  for (const key of Object.keys(original) as (keyof EnvSnapshot)[]) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("createInterpreter prefers the dev-only stub over a configured real provider", () => {
  const original = snapshotEnv();
  try {
    process.env.ENQUIRY_INTERPRETER = "stub";
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    assert.equal(createInterpreter(), stubInterpreter);
  } finally {
    restoreEnv(original);
  }
});

test("createInterpreter returns the real provider when a key is set and the stub is not enabled", () => {
  const original = snapshotEnv();
  try {
    delete process.env.ENQUIRY_INTERPRETER;
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const interpreter = createInterpreter();
    assert.notEqual(interpreter, stubInterpreter);
    assert.notEqual(interpreter, nullInterpreter);
  } finally {
    restoreEnv(original);
  }
});

test("createInterpreter returns the real provider even when the stub opt-in is set but production disables it", () => {
  const original = snapshotEnv();
  try {
    process.env.ENQUIRY_INTERPRETER = "stub";
    process.env.NODE_ENV = "production";
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const interpreter = createInterpreter();
    assert.notEqual(interpreter, stubInterpreter);
    assert.notEqual(interpreter, nullInterpreter);
  } finally {
    restoreEnv(original);
  }
});

test("createInterpreter falls back to the null interpreter with no stub and no key", () => {
  const original = snapshotEnv();
  try {
    delete process.env.ENQUIRY_INTERPRETER;
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(createInterpreter(), nullInterpreter);
  } finally {
    restoreEnv(original);
  }
});

test("createInterpreter treats a whitespace-only key the same as no key", () => {
  const original = snapshotEnv();
  try {
    delete process.env.ENQUIRY_INTERPRETER;
    process.env.ANTHROPIC_API_KEY = "   ";
    assert.equal(createInterpreter(), nullInterpreter);
  } finally {
    restoreEnv(original);
  }
});
