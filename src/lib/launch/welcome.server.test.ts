import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EmailMessage } from "@/lib/email/send.server";
import { welcomeNewSignup, type WelcomeDeps } from "./welcome.server.ts";

const INPUT = { waitlistId: "id-1", email: "a@x.com", origin: "https://site.test" };
const LINKS = {
  page: "https://site.test/unsubscribe?t=x",
  oneClick: "https://site.test/api/unsubscribe?t=x",
};

function deps(links: WelcomeDeps["links"]) {
  const sent: EmailMessage[] = [];
  const reported: unknown[] = [];
  return {
    sent,
    reported,
    deps: {
      links,
      build: (to: string) => ({ to, subject: "s", html: "h", text: "t" }),
      send: (message: EmailMessage) => sent.push(message),
      report: (error: unknown) => reported.push(error),
    } satisfies WelcomeDeps,
  };
}

test("no secret: the email is skipped and the owner alerted, nothing throws", async () => {
  const d = deps(async () => null);
  assert.equal(await welcomeNewSignup(INPUT, d.deps), "skipped");
  assert.equal(d.sent.length, 0);
  assert.equal(d.reported.length, 1);
});

test("a failure making the link never escapes to the signup", async () => {
  const d = deps(async () => {
    throw new Error("launch_settings unreachable");
  });
  assert.equal(await welcomeNewSignup(INPUT, d.deps), "skipped");
  assert.equal(d.sent.length, 0);
  assert.equal(d.reported.length, 1);
});

test("with a link the email is sent once", async () => {
  const d = deps(async () => LINKS);
  assert.equal(await welcomeNewSignup(INPUT, d.deps), "sent");
  assert.equal(d.sent.length, 1);
  assert.equal(d.reported.length, 0);
});

test("joinWaitlist returns the new id after the welcome step, whatever it does", () => {
  const api = readFileSync("src/lib/launch/api.ts", "utf8");
  const join = api.slice(
    api.indexOf("export const joinWaitlist"),
    api.indexOf("export const leaveWaitlist"),
  );
  const welcome = join.indexOf("await welcomeNewSignup(");
  const ret = join.indexOf("return { id: result.id, already: false as const };");
  assert.ok(welcome > 0 && ret > welcome, "the id is returned after the welcome step");
  assert.doesNotMatch(
    join,
    /await unsubscribeLinks\(/,
    "links are only made inside welcomeNewSignup",
  );
});
