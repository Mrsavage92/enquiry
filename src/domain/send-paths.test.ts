import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Acting is safe (attention plan C10, doc 50 section 8 "C10 replacement"): no
 * path records a send without the owner first seeing exactly what goes out.
 *
 * The two ways anything becomes a recorded send are `recordSent(` (live: the
 * owner attests they sent the reviewed artefact) and the store's `approve(`
 * (demo). The only screen allowed to call either is the inline send bar, and
 * every screen that sends renders it beside the reply it copies. The demo
 * keyboard shortcut stays exempt only behind resolveSendKey, which refuses it
 * outside demo mode (send-keys.test.ts).
 */

const ROOTS = ["src/components", "src/routes"];
const SEND_BAR = "src/components/enquiry/laser/send-bar.tsx";
const DESK = "src/components/enquiry/laser/laser-desk.tsx";
const EXEMPT: Record<string, RegExp> = {
  "src/components/enquiry/workspace.tsx": /resolveSendKey\(/,
};

function files(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("only the inline send bar records a send, and every send path renders it", () => {
  const senders: string[] = [];
  for (const file of ROOTS.flatMap(files).filter((f) => f.endsWith(".tsx"))) {
    const key = file.replace(/\\/g, "/");
    const text = read(key);
    if (!/\brecordSent\(|\bapprove\(/.test(text)) continue;
    const exempt = EXEMPT[key];
    if (exempt) {
      assert.match(text, exempt, `${key} lost the guard that makes it exempt`);
      continue;
    }
    senders.push(key);
  }
  assert.deepEqual(senders, [SEND_BAR], "a send path outside the send bar");
  assert.match(read(DESK), /<SendBar\b/, "the enquiry screen renders the send bar");
  for (const screen of ["phone-desk.tsx", "workspace.tsx"]) {
    assert.match(read(`src/components/enquiry/${screen}`), /<LaserDesk\b/, screen);
  }
});

test("the send bar shows channel, recipient, amount and the reason before a copy", () => {
  const bar = read(SEND_BAR);
  // The send line: recipient, channel and amount, always above Copy.
  assert.match(bar, /line\.recipient/);
  assert.match(bar, /line\.channel/);
  assert.match(bar, /line\.amount/);
  // The review panel for a high-risk send adds the reason.
  assert.match(bar, /recommendation\.reason/);
});

test("Copy writes exactly the text rendered in the reply on the same screen", () => {
  const desk = read(DESK);
  // One `text` feeds both the reply box the owner reads and the bar that copies it.
  assert.match(desk, /<ReplyBox[\s\S]*?\btext=\{text\}/);
  assert.match(desk, /<SendBar[\s\S]*?\btext=\{text\}/);
  const bar = read(SEND_BAR);
  const onCopy = bar.slice(bar.indexOf("const onCopy"), bar.indexOf("const copyAgain"));
  assert.match(onCopy, /const body = text;/);
  assert.match(onCopy, /copyText\(body\)/);
  // The check that enables Copy was for this exact text.
  assert.match(bar, /check\.status === "ok" && check\.text === text/);
});
