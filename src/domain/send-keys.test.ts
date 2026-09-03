import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSendKey } from "./send-keys.ts";

const enterCombo = (
  overrides: Partial<{ key: string; metaKey: boolean; ctrlKey: boolean }> = {},
) => ({
  key: "Enter",
  metaKey: true,
  ctrlKey: false,
  ...overrides,
});

test("a bare Enter is never a submit, wherever it is pressed - it is not this policy's job at all", () => {
  // A stray Enter inside the draft textarea (or anywhere else on the page)
  // must never fire a send. This holds independent of dialog state or demo
  // mode - a bare Enter is not even the shortcut this function governs.
  const notASend = { key: "Enter", metaKey: false, ctrlKey: false };
  assert.equal(resolveSendKey(notASend, { inDialog: false }, true), "ignore");
  assert.equal(resolveSendKey(notASend, { inDialog: false }, false), "ignore");
  assert.equal(resolveSendKey(notASend, { inDialog: true }, true), "ignore");
});

test("Cmd/Ctrl+Enter is ignored outside demo mode, regardless of dialog state", () => {
  assert.equal(resolveSendKey(enterCombo({ metaKey: true }), { inDialog: false }, false), "ignore");
  assert.equal(
    resolveSendKey(enterCombo({ ctrlKey: true, metaKey: false }), { inDialog: false }, false),
    "ignore",
  );
  assert.equal(resolveSendKey(enterCombo(), { inDialog: true }, false), "ignore");
});

test("Cmd/Ctrl+Enter submits in demo mode, outside a dialog", () => {
  assert.equal(resolveSendKey(enterCombo({ metaKey: true }), { inDialog: false }, true), "submit");
  assert.equal(
    resolveSendKey(enterCombo({ ctrlKey: true, metaKey: false }), { inDialog: false }, true),
    "submit",
  );
});

test("Cmd/Ctrl+Enter inside an open dialog never submits, even in demo mode", () => {
  // The approval preview owns its own confirm button - this global shortcut
  // must never race it or double-fire alongside it.
  assert.equal(resolveSendKey(enterCombo(), { inDialog: true }, true), "ignore");
});

test("any key other than Enter is ignored, even with Cmd/Ctrl held and in demo mode", () => {
  assert.equal(
    resolveSendKey({ key: "s", metaKey: true, ctrlKey: false }, { inDialog: false }, true),
    "ignore",
  );
  assert.equal(
    resolveSendKey({ key: "Escape", metaKey: true, ctrlKey: false }, { inDialog: false }, true),
    "ignore",
  );
});

test("Enter without Cmd or Ctrl is ignored even in demo mode outside a dialog", () => {
  assert.equal(
    resolveSendKey({ key: "Enter", metaKey: false, ctrlKey: false }, { inDialog: false }, true),
    "ignore",
  );
});
