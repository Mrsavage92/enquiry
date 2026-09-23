import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeError,
  formatAlert,
  guarded,
  resetWebhookCache,
  resolveWebhookUrl,
  sendAlert,
} from "./alert.ts";

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

test("the webhook comes from env first, then the settings table, cached for five minutes", async () => {
  resetWebhookCache();
  const previous = process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_WEBHOOK_URL;
  let loads = 0;
  const loadSetting = async (key: string) => {
    loads += 1;
    return key === "alert_webhook_url" ? "https://relay.example/hook" : null;
  };
  const t0 = new Date("2026-09-23T00:00:00.000Z");
  assert.equal(
    await resolveWebhookUrl({ loadSetting, now: () => t0 }),
    "https://relay.example/hook",
  );
  assert.equal(
    await resolveWebhookUrl({ loadSetting, now: () => t0 }),
    "https://relay.example/hook",
  );
  assert.equal(loads, 1, "second call inside the TTL does not query again");
  const later = new Date(t0.getTime() + 6 * 60 * 1000);
  await resolveWebhookUrl({ loadSetting, now: () => later });
  assert.equal(loads, 2, "after the TTL the setting is read again");

  process.env.ALERT_WEBHOOK_URL = "https://env.example/hook";
  assert.equal(
    await resolveWebhookUrl({ loadSetting, now: () => later }),
    "https://env.example/hook",
  );
  assert.equal(loads, 2, "env wins without a query");
  if (previous === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = previous;
  resetWebhookCache();
});

test("a failing settings read means skipped, never a throw", async () => {
  resetWebhookCache();
  const previous = process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_WEBHOOK_URL;
  const outcome = await sendAlert(
    { scope: "x", error: new Error("boom") },
    { loadSetting: async () => null, fetchImpl: async () => new Response("", { status: 200 }) },
  );
  assert.equal(outcome, "skipped");
  if (previous === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = previous;
  resetWebhookCache();
});
