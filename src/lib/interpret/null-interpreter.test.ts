import assert from "node:assert/strict";
import test from "node:test";
import { nullInterpreter } from "./null-interpreter.ts";

test("nullInterpreter always resolves ok:false, reason no_provider - the entire fallback mechanism", async () => {
  const outcome = await nullInterpreter.interpret({
    rawMessage: "anything at all",
    messageId: "m1",
    business: { services: [], ruleSummaries: [], industry: "" },
  });
  assert.deepEqual(outcome, { ok: false, reason: "no_provider" });
});
