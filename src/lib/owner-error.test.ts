import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { TRY_AGAIN, ownerError } from "./owner-error.ts";

test("a developer error becomes one plain line; a refusal written for the owner stays", () => {
  const raw = new TypeError(
    "Failed to fetch dynamically imported module: http://127.0.0.1:4321/assets/enquiry-actions-C4gLSMPo.js",
  );
  assert.equal(ownerError(raw), TRY_AGAIN);
  assert.equal(ownerError(new TypeError("Failed to fetch")), TRY_AGAIN);
  assert.equal(ownerError("nope"), TRY_AGAIN);
  assert.equal(ownerError(new Error("Enter the answer.")), "Enter the answer.");
  assert.equal(
    ownerError(new Error("That enquiry is closed. Reopen it before answering.")),
    "That enquiry is closed. Reopen it before answering.",
  );
});

function files(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

test("no component shows err.message to the owner as it came", () => {
  const offenders = files("src/components")
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) =>
      /instanceof Error \? \w+\.message/.test(readFileSync(join(process.cwd(), f), "utf8")),
    );
  assert.deepEqual(offenders, []);
});
