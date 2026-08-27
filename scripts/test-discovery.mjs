/**
 * Find the repository's test files.
 *
 * The default test command used to hard-code two TypeScript paths and lean on a
 * shell glob for the rest. The glob never expanded on Windows, so `npm test`
 * reported success while most of the suite never ran. Discovery therefore walks
 * the tree in Node: no shell, no platform-specific quoting, and new test files
 * are picked up the moment they land.
 */
import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Directories searched for tests, relative to the workspace root. */
export const TEST_ROOTS = ["scripts", "src"];

/** Never descended into — build output and dependencies hold no repo tests. */
export const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".output",
  ".nitro",
  ".vercel",
  ".tanstack",
  ".git",
]);

const TEST_SUFFIXES = [".test.mjs", ".test.ts", ".test.tsx"];

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function isTestFile(name) {
  return TEST_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** True for a TypeScript test, which needs Node's strip-types mode. */
export function isTypeScriptTest(name) {
  return name.endsWith(".test.ts") || name.endsWith(".test.tsx");
}

function walk(dir, found) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found; // A configured root that does not exist is not an error.
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walk(join(dir, entry.name), found);
    } else if (entry.isFile() && isTestFile(entry.name)) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/**
 * Every test file under `TEST_ROOTS`, as paths relative to `root`, sorted so a
 * run is reproducible and diffable between machines.
 */
export function discoverTestFiles(root = projectRoot()) {
  const found = [];
  for (const testRoot of TEST_ROOTS) walk(join(root, testRoot), found);
  return found
    .map((file) => relative(root, file).split(sep).join("/"))
    .sort((a, b) => a.localeCompare(b));
}
