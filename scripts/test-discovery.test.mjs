import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  IGNORED_DIRECTORIES,
  discoverTestFiles,
  isTestFile,
  isTypeScriptTest,
  projectRoot,
} from "./test-discovery.mjs";

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), "discovery-"));
  for (const rel of files) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "");
  }
  return root;
}

test("recognises every test extension the suite uses", () => {
  assert.equal(isTestFile("guard.test.ts"), true);
  assert.equal(isTestFile("gates.test.tsx"), true);
  assert.equal(isTestFile("with-app-env.test.mjs"), true);
});

test("does not mistake source or fixtures for tests", () => {
  assert.equal(isTestFile("guard.ts"), false);
  assert.equal(isTestFile("test-discovery.mjs"), false);
  assert.equal(isTestFile("testing-helpers.ts"), false);
});

test("separates TypeScript tests, which need strip-types", () => {
  assert.equal(isTypeScriptTest("guard.test.ts"), true);
  assert.equal(isTypeScriptTest("gates.test.tsx"), true);
  assert.equal(isTypeScriptTest("with-app-env.test.mjs"), false);
});

test("discovery reaches src/domain, src/lib and scripts", () => {
  // The regression this guards: a discovery pass that silently covers only one
  // area still looks green, which is exactly how the old command failed.
  const found = discoverTestFiles(projectRoot());
  for (const prefix of ["scripts/", "src/domain/", "src/lib/"]) {
    assert.ok(
      found.some((file) => file.startsWith(prefix)),
      `no test discovered under ${prefix}`,
    );
  }
});

test("discovery finds the whole repository suite, not a subset", () => {
  const found = discoverTestFiles(projectRoot());
  // The two files the old hard-coded command ran must still be included.
  assert.ok(found.includes("src/lib/app-data/app-data.test.ts"));
  assert.ok(found.includes("src/lib/auth/gate-identity.test.ts"));
  // And the suite it silently skipped.
  assert.ok(found.includes("src/domain/labels.test.ts"));
  assert.ok(found.includes("src/lib/launch/guard.test.ts"));
  assert.ok(found.includes("scripts/with-app-env.test.mjs"));
  assert.ok(found.length >= 20, `expected the full suite, found ${found.length}`);
});

test("results are relative, slash-separated and sorted", () => {
  const root = makeTree(["scripts/b.test.mjs", "src/a.test.ts"]);
  assert.deepEqual(discoverTestFiles(root), ["scripts/b.test.mjs", "src/a.test.ts"]);
});

test("build output and dependencies are never searched", () => {
  const root = makeTree([
    "src/real.test.ts",
    "src/node_modules/dep/fake.test.ts",
    "src/dist/built.test.js",
  ]);
  assert.deepEqual(discoverTestFiles(root), ["src/real.test.ts"]);
  assert.ok(IGNORED_DIRECTORIES.has("node_modules"));
});

test("a missing search root is not an error", () => {
  const root = makeTree(["scripts/only.test.mjs"]);
  assert.deepEqual(discoverTestFiles(root), ["scripts/only.test.mjs"]);
});

test("nested directories are discovered", () => {
  const root = makeTree(["src/deep/nested/thing.test.ts"]);
  assert.deepEqual(discoverTestFiles(root), ["src/deep/nested/thing.test.ts"]);
});
