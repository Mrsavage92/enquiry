import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccessMode } from "./access-mode.ts";

// All four combinations, exhaustively. This branch decides whether a request is
// attributed to a verified human, to a shared throwaway identity, or to nobody
// at all, so "we think it's fine" is not good enough.

test("a configured auth stack always verifies, database or not", () => {
  assert.equal(
    resolveAccessMode({ authConfigured: true, databaseConfigured: true }),
    "verify",
  );
  assert.equal(
    resolveAccessMode({ authConfigured: true, databaseConfigured: false }),
    "verify",
  );
});

test("auth off with no database is the local prototype's shared dev user", () => {
  assert.equal(
    resolveAccessMode({ authConfigured: false, databaseConfigured: false }),
    "dev-user",
  );
});

test("auth off against a real database refuses rather than sharing an identity", () => {
  // The regression that matters: degrading to "dev-user" here would give every
  // anonymous visitor read and write access to every other tenant's rows.
  assert.equal(
    resolveAccessMode({ authConfigured: false, databaseConfigured: true }),
    "refuse",
  );
});

test("the dev-user fallback is never reachable once a database is configured", () => {
  const withDatabase = [true, false].map((authConfigured) =>
    resolveAccessMode({ authConfigured, databaseConfigured: true }),
  );
  assert.ok(!withDatabase.includes("dev-user"));
});
