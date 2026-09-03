import assert from "node:assert/strict";
import test from "node:test";
import { writeThrough } from "./write-through.ts";

/**
 * `writeThrough` used to resolve normally on a caught failure - it reported
 * the error through `onFailure` but told an awaiting caller nothing went
 * wrong. That let a `.then()` chained on it run its success branch (a toast,
 * closing a dialog, navigating on) even when the write never landed. These
 * prove the return value itself now carries that signal.
 */

test("a run that throws resolves false and reports through onFailure", async () => {
  const failures: string[] = [];
  const ok = await writeThrough(
    "Decline",
    () => Promise.reject(new Error("network down")),
    (m) => failures.push(m),
  );
  assert.equal(ok, false);
  assert.deepEqual(failures, ["Decline was not saved: network down"]);
});

test("a run that resolves succeeds true and never calls onFailure", async () => {
  const failures: string[] = [];
  const ok = await writeThrough(
    "Decline",
    () => Promise.resolve({ id: "e1" }),
    (m) => failures.push(m),
  );
  assert.equal(ok, true);
  assert.deepEqual(failures, []);
});

test("a thrown non-Error value still resolves false, with a generic message", async () => {
  const failures: string[] = [];
  const ok = await writeThrough(
    "Snooze",
    () => Promise.reject("plain string rejection"),
    (m) => failures.push(m),
  );
  assert.equal(ok, false);
  assert.deepEqual(failures, ["Snooze was not saved. Please try again."]);
});

test("an Error with an empty message falls back to the generic message", async () => {
  const failures: string[] = [];
  const ok = await writeThrough(
    "Note",
    () => Promise.reject(new Error("")),
    (m) => failures.push(m),
  );
  assert.equal(ok, false);
  assert.deepEqual(failures, ["Note was not saved. Please try again."]);
});
