import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError, formatAlert, guarded, sendAlert } from "./alert.ts";

const at = new Date("2026-09-15T00:00:00.000Z");

test("describeError keeps the message and only the first stack lines", () => {
  const error = new Error("boom");
  error.stack = "Error: boom\n    at one\n    at two\n    at three\n    at four";
  const described = describeError(error);
  assert.equal(described.message, "boom");
  assert.equal(described.stack, "at one | at two | at three");
  assert.deepEqual(describeError("plain"), { message: "plain", stack: "" });
  assert.equal(describeError({ code: 7 }).message, '{"code":7}');
});

test("formatAlert names the scope, time, message and scalar context only", () => {
  const text = formatAlert(
    {
      scope: "joinWaitlist",
      error: new Error("db down"),
      context: { already: false, skip: undefined },
    },
    at,
  );
  assert.match(text, /^Enquiry error in joinWaitlist at 2026-09-15T00:00:00.000Z\n/);
  assert.match(text, /db down/);
  assert.match(text, /already=false/);
  assert.doesNotMatch(text, /skip=/);
});

test("sendAlert skips without a webhook and never throws on a failing one", async () => {
  const quiet = console.error;
  console.error = () => undefined;
  try {
    assert.equal(
      await sendAlert({ scope: "x", error: "e" }, { webhookUrl: "", now: () => at }),
      "skipped",
    );
    const failing: typeof fetch = async () => {
      throw new Error("network");
    };
    assert.equal(
      await sendAlert(
        { scope: "x", error: "e" },
        { webhookUrl: "https://hook.test", fetchImpl: failing, now: () => at },
      ),
      "failed",
    );
    const rejected: typeof fetch = async () => new Response("nope", { status: 500 });
    assert.equal(
      await sendAlert(
        { scope: "x", error: "e" },
        { webhookUrl: "https://hook.test", fetchImpl: rejected, now: () => at },
      ),
      "failed",
    );
  } finally {
    console.error = quiet;
  }
});

test("sendAlert posts a Slack and Discord compatible body", async () => {
  const quiet = console.error;
  console.error = () => undefined;
  const captured: { url: string; body: string }[] = [];
  const capturing: typeof fetch = async (url, init) => {
    captured.push({ url: String(url), body: String(init?.body) });
    return new Response("ok", { status: 200 });
  };
  try {
    const outcome = await sendAlert(
      { scope: "qualifyWaitlist", error: new Error("boom") },
      { webhookUrl: "https://hook.test/abc", fetchImpl: capturing, now: () => at },
    );
    assert.equal(outcome, "sent");
    assert.equal(captured.length, 1);
    const body = JSON.parse(captured[0].body) as { text: string; content: string };
    assert.equal(body.text, body.content);
    assert.match(body.text, /qualifyWaitlist/);
  } finally {
    console.error = quiet;
  }
});

test("guarded reports unexpected errors, rethrows, and leaves expected ones alone", async () => {
  const quiet = console.error;
  const seen: string[] = [];
  console.error = (line: string) => {
    seen.push(String(line));
  };
  try {
    const expected = new Error("Too many requests");
    const wrapped = guarded(
      "scope",
      async (kind: "ok" | "expected" | "unexpected") => {
        if (kind === "expected") throw expected;
        if (kind === "unexpected") throw new Error("db down");
        return 42;
      },
      (error) => error === expected,
    );
    assert.equal(await wrapped("ok"), 42);
    await assert.rejects(() => wrapped("expected"), /Too many requests/);
    assert.equal(seen.length, 0);
    await assert.rejects(() => wrapped("unexpected"), /db down/);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(seen.length, 1);
    assert.match(seen[0], /\[alert\] Enquiry error in scope/);
  } finally {
    console.error = quiet;
  }
});
