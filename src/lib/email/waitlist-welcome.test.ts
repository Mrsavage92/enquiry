import assert from "node:assert/strict";
import { test } from "node:test";
import { sendEmail } from "./send.server.ts";
import {
  WAITLIST_WELCOME_SUBJECT,
  waitlistWelcomeEmail,
  waitlistWelcomeHtml,
  waitlistWelcomeText,
} from "./waitlist-welcome.ts";

const ORIGIN = "https://enquiry-ashy.vercel.app";

function quiet<T>(run: () => T): T {
  const error = console.error;
  const info = console.info;
  console.error = () => undefined;
  console.info = () => undefined;
  try {
    return run();
  } finally {
    console.error = error;
    console.info = info;
  }
}

test("the welcome email says what happens next without promising a date", () => {
  const text = waitlistWelcomeText(ORIGIN);
  assert.match(text, /You are on the list\./);
  assert.match(text, /invite businesses in small groups/);
  assert.match(text, /not an account and not a subscription/);
  // No invitation date may be promised - none is known.
  assert.doesNotMatch(text, /\b(next week|in \d+ days|by \w+day|this month)\b/i);
});

test("the welcome email carries exactly one action and a reply path", () => {
  const message = waitlistWelcomeEmail("owner@example.com", ORIGIN);
  assert.equal(message.subject, WAITLIST_WELCOME_SUBJECT);
  assert.equal(message.to, "owner@example.com");
  assert.ok(message.replyTo && message.replyTo.includes("@"), "a human reply address is set");
  // One call to action button, pointing at a real public route.
  const buttons = message.html.match(/<a href="[^"]*\/roadmap"/g) ?? [];
  assert.equal(buttons.length, 1);
});

test("the html claims no capability that is not live", () => {
  const html = waitlistWelcomeHtml(ORIGIN).toLowerCase();
  for (const forbidden of ["connect your inbox", "we send", "instagram", "sms", "your calendar"]) {
    assert.ok(!html.includes(forbidden), `must not claim: ${forbidden}`);
  }
});

test("the html escapes the origin it is given", () => {
  const html = waitlistWelcomeHtml('https://evil.test/"><script>');
  assert.ok(!html.includes("<script>"), "origin is escaped into the document");
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
});

test("sendEmail stays inert until both the key and the sender exist", async () => {
  const message = waitlistWelcomeEmail("owner@example.com", ORIGIN);
  const never: typeof fetch = async () => {
    throw new Error("must not be called");
  };
  const outcomes = await quiet(async () => [
    await sendEmail(message, { apiKey: "", from: "", fetchImpl: never }),
    await sendEmail(message, { apiKey: "re_key", from: "", fetchImpl: never }),
    await sendEmail(message, { apiKey: "", from: "Enquiry <a@b.co>", fetchImpl: never }),
  ]);
  assert.deepEqual(await Promise.resolve(outcomes), ["skipped", "skipped", "skipped"]);
});

test("sendEmail posts a Resend payload and never throws on failure", async () => {
  const message = waitlistWelcomeEmail("owner@example.com", ORIGIN);
  const calls: { url: string; body: string; auth: string }[] = [];
  const capturing: typeof fetch = async (url, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: String(url), body: String(init?.body), auth: headers.authorization });
    return new Response("{}", { status: 200 });
  };
  const sent = await quiet(async () =>
    sendEmail(message, {
      apiKey: "re_key",
      from: "Enquiry <hello@enquiry.test>",
      fetchImpl: capturing,
    }),
  );
  assert.equal(await Promise.resolve(sent), "sent");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].auth, "Bearer re_key");
  const body = JSON.parse(calls[0].body) as {
    from: string;
    to: string[];
    subject: string;
    reply_to: string;
  };
  assert.equal(body.from, "Enquiry <hello@enquiry.test>");
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal(body.subject, WAITLIST_WELCOME_SUBJECT);
  assert.ok(body.reply_to.includes("@"));

  const rejecting: typeof fetch = async () => new Response("no", { status: 422 });
  const failed = await quiet(async () =>
    sendEmail(message, {
      apiKey: "re_key",
      from: "Enquiry <hello@enquiry.test>",
      fetchImpl: rejecting,
    }),
  );
  assert.equal(await Promise.resolve(failed), "failed");

  const throwing: typeof fetch = async () => {
    throw new Error("network");
  };
  const threw = await quiet(async () =>
    sendEmail(message, {
      apiKey: "re_key",
      from: "Enquiry <hello@enquiry.test>",
      fetchImpl: throwing,
    }),
  );
  assert.equal(await Promise.resolve(threw), "failed");
});
