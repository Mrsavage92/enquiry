import assert from "node:assert/strict";
import { test } from "node:test";
import { SEND_UNDO_WINDOW_MS, undoableSend } from "./send-undo-window.ts";
import { UNDO_SEND_WINDOW_MS } from "../lib/repo/undo-send-core.ts";

const NOW = Date.parse("2026-09-25T10:00:00Z");
const base = {
  practice: false,
  state: { lifecycle: "OPEN", decision: "WAITING_ON_CLIENT" } as never,
};
const msg = (direction: "inbound" | "outbound", minutesAgo: number, id = "m") =>
  ({ id, direction, at: new Date(NOW - minutesAgo * 60_000).toISOString() }) as never;

test("the enquiry offers Undo for exactly the server's window", () => {
  assert.equal(SEND_UNDO_WINDOW_MS, UNDO_SEND_WINDOW_MS);
});

test("a send recorded 30 seconds ago can be undone, with the time left", () => {
  const r = undoableSend(
    { ...base, conversation: [msg("inbound", 5, "in"), msg("outbound", 0.5, "out")] },
    NOW,
  );
  assert.equal(r?.messageId, "out");
  assert.equal(r?.msLeft, SEND_UNDO_WINDOW_MS - 30_000);
});

test("after the window, after their reply, or on a closed enquiry: no Undo", () => {
  assert.equal(undoableSend({ ...base, conversation: [msg("outbound", 16)] }, NOW), null);
  assert.equal(
    undoableSend({ ...base, conversation: [msg("outbound", 2), msg("inbound", 1)] }, NOW),
    null,
  );
  assert.equal(
    undoableSend(
      {
        ...base,
        state: { lifecycle: "DECLINED" } as never,
        conversation: [msg("outbound", 1)],
      },
      NOW,
    ),
    null,
  );
  assert.equal(undoableSend({ ...base, conversation: [msg("inbound", 1)] }, NOW), null);
});
