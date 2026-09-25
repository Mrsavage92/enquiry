import assert from "node:assert/strict";
import { test } from "node:test";
import { toActionPolicy, type ActionPolicyRow } from "./rows.ts";

function row(mode: string): ActionPolicyRow {
  return {
    action: "REQUEST_INFORMATION",
    label: "Ask one missing-info question",
    mode,
    risk: "LOW",
    evidence: null,
    gates: null,
  };
}

test("a legacy 'Automatic when safe' row reads back as the conservative Never", () => {
  // The option is gone from every place a business can set it (the settings
  // UI, and the server endpoint that writes it) - the product promise is
  // nothing sends without the owner's approval. A row written before that
  // change must not keep autopilot eligible just because it was never
  // touched again, so it is normalised the moment it is read.
  assert.equal(toActionPolicy(row("Automatic when safe")).mode, "Never");
});

test("the two real modes pass through unchanged", () => {
  assert.equal(toActionPolicy(row("Ask every time")).mode, "Ask every time");
  assert.equal(toActionPolicy(row("Never")).mode, "Never");
});

test("an unrecognised mode also falls back to Never rather than reaching the app as-is", () => {
  assert.equal(toActionPolicy(row("")).mode, "Never");
  assert.equal(toActionPolicy(row("garbage")).mode, "Never");
});
