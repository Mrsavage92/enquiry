import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Acting is safe (attention plan C10): no path records a send without the
 * owner first seeing exactly what goes out.
 *
 * The two ways anything becomes a recorded send are `recordSent(` (live: the
 * owner attests they sent the reviewed artefact) and the store's `approve(`
 * (demo). Every screen that calls either must also render <SendPreview>, the
 * one preview-and-confirm surface. The only exception is the demo keyboard
 * shortcut, and it is only allowed while it stays behind resolveSendKey,
 * which refuses it outside demo mode (send-keys.test.ts).
 */

const ROOTS = ["src/components", "src/routes"];
const PREVIEW_EXEMPT: Record<string, RegExp> = {
  "src/components/enquiry/workspace.tsx": /resolveSendKey\(/,
};

function files(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

test("every screen that can record a send shows the send preview first", () => {
  const missing: string[] = [];
  let senders = 0;
  for (const file of ROOTS.flatMap(files).filter((f) => f.endsWith(".tsx"))) {
    const text = readFileSync(join(process.cwd(), file), "utf8");
    const sends = /\brecordSent\(|\bapprove\(/.test(text);
    if (!sends) continue;
    senders += 1;
    const key = file.replace(/\\/g, "/");
    const exempt = PREVIEW_EXEMPT[key];
    if (exempt) {
      assert.match(text, exempt, `${key} lost the guard that makes it exempt`);
      continue;
    }
    if (!/<SendPreview\b/.test(text)) missing.push(key);
  }
  assert.ok(senders >= 2, "the scan found the send paths it exists to check");
  assert.deepEqual(missing, [], "a send path without a preview");
});
