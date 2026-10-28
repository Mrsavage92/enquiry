import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimit } from "./guard.ts";
import {
  UNSUBSCRIBE_LIMIT,
  handleUnsubscribeRequest,
  type UnsubscribeResult,
} from "./unsubscribe-handler.ts";

const URL_WITH_TOKEN = "https://site.test/api/unsubscribe?t=sealed";

function spy(result: UnsubscribeResult = "removed") {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      unsubscribe: async (token: string) => {
        calls.push(token);
        return result;
      },
    },
  };
}

test("a GET never deletes anything", async () => {
  resetRateLimit();
  const { calls, deps } = spy();
  const response = await handleUnsubscribeRequest(new Request(URL_WITH_TOKEN), deps);
  assert.equal(response.status, 405);
  assert.equal(calls.length, 0);
});

test("a cross-site one-click POST with no Sec-Fetch headers succeeds (RFC 8058)", async () => {
  resetRateLimit();
  const { calls, deps } = spy();
  const response = await handleUnsubscribeRequest(
    new Request(URL_WITH_TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://mail.example.com",
        "x-forwarded-for": "203.0.113.9",
      },
      body: "List-Unsubscribe=One-Click",
    }),
    deps,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["sealed"]);
});

test("the page's no-JS form is sent back to the page with the result", async () => {
  resetRateLimit();
  const { deps } = spy("removed");
  const response = await handleUnsubscribeRequest(
    new Request(URL_WITH_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "from=page",
    }),
    deps,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/unsubscribe?result=removed");
});

test("a forged token is a 400 and the JSON form says invalid", async () => {
  resetRateLimit();
  const { deps } = spy("invalid");
  const response = await handleUnsubscribeRequest(
    new Request(URL_WITH_TOKEN, { method: "POST", headers: { accept: "application/json" } }),
    deps,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { outcome: "invalid" });
});

test("too many POSTs from one address get 429 and delete nothing more", async () => {
  resetRateLimit();
  const { calls, deps } = spy();
  const post = () =>
    handleUnsubscribeRequest(
      new Request(URL_WITH_TOKEN, {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.7" },
      }),
      { ...deps, now: 1_000 },
    );
  for (let i = 0; i < UNSUBSCRIBE_LIMIT; i += 1) assert.equal((await post()).status, 200);
  const limited = await post();
  assert.equal(limited.status, 429);
  assert.equal(calls.length, UNSUBSCRIBE_LIMIT);
});

test("a failure reports the error and returns 500", async () => {
  resetRateLimit();
  const errors: unknown[] = [];
  const response = await handleUnsubscribeRequest(new Request(URL_WITH_TOKEN, { method: "POST" }), {
    unsubscribe: async () => {
      throw new Error("db down");
    },
    onError: (error) => errors.push(error),
  });
  assert.equal(response.status, 500);
  assert.equal(errors.length, 1);
});

test("opening the unsubscribe page never deletes: only a button press POSTs", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync("src/routes/unsubscribe.tsx", "utf8");
  assert.doesNotMatch(page, /useEffect/);
  assert.match(page, /onSubmit=\{remove\}/);
  assert.match(page, /<form method="post"/);
  assert.match(page, /Remove me from the list/);
});
