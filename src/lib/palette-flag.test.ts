import assert from "node:assert/strict";
import test from "node:test";
import {
  PALETTE_INLINE_SCRIPT,
  PALETTE_STORAGE_KEY,
  resolvePaletteAction,
} from "./palette-flag.ts";

test("no query param, nothing stored: default palette (A), no storage write", () => {
  const result = resolvePaletteAction("", null);
  assert.equal(result.attribute, null);
  assert.equal(result.stored, null);
  assert.equal(result.storeAction, "none");
});

test("?palette=b with nothing stored: activates B and stores it", () => {
  const result = resolvePaletteAction("?palette=b", null);
  assert.equal(result.attribute, "b");
  assert.equal(result.stored, "b");
  assert.equal(result.storeAction, "set");
});

test("?palette=a with B stored: clears B and removes storage", () => {
  const result = resolvePaletteAction("?palette=a", "b");
  assert.equal(result.attribute, null);
  assert.equal(result.stored, null);
  assert.equal(result.storeAction, "remove");
});

test("no query param, B already stored: B persists across reload", () => {
  const result = resolvePaletteAction("", "b");
  assert.equal(result.attribute, "b");
  assert.equal(result.stored, "b");
  assert.equal(result.storeAction, "none");
});

test("?palette=b already stored: no redundant storage write", () => {
  const result = resolvePaletteAction("?palette=b", "b");
  assert.equal(result.attribute, "b");
  assert.equal(result.storeAction, "none");
});

test("an unrecognised palette value is ignored, previous choice stands", () => {
  assert.equal(resolvePaletteAction("?palette=c", "b").attribute, "b");
  assert.equal(resolvePaletteAction("?palette=c", null).attribute, null);
});

test("other query params alongside palette are ignored, not treated as noise", () => {
  const result = resolvePaletteAction("?enquiryId=42&palette=b&tab=facts", null);
  assert.equal(result.attribute, "b");
});

test("the inline head script mirrors the storage key and both query values", () => {
  assert.match(PALETTE_INLINE_SCRIPT, new RegExp(PALETTE_STORAGE_KEY));
  assert.match(PALETTE_INLINE_SCRIPT, /"b"/);
  assert.match(PALETTE_INLINE_SCRIPT, /"a"/);
  assert.match(PALETTE_INLINE_SCRIPT, /data-palette/);
  assert.match(PALETTE_INLINE_SCRIPT, /try\s*{/);
});
