#!/usr/bin/env node
/**
 * The default test entry point: discover every repository test, then run them
 * in one Node test-runner process.
 *
 * Spawning is shell-free and argv-explicit for the same reason
 * `with-app-env.mjs` is — a shell glob silently matched nothing on Windows and
 * turned `npm test` into a green light for a suite that never ran.
 *
 * Extra arguments are forwarded to the runner, so `npm test -- --test-name-pattern=x`
 * still works.
 */
import { spawn } from "node:child_process";
import { discoverTestFiles, isTypeScriptTest, projectRoot } from "./test-discovery.mjs";
import { exitStatusFromChild } from "./with-app-env.mjs";

const root = projectRoot();
const files = discoverTestFiles(root);

if (files.length === 0) {
  console.error("[run-tests] no test files found — discovery is misconfigured");
  process.exit(1);
}

const scriptCount = files.length - files.filter(isTypeScriptTest).length;
console.log(
  `[run-tests] ${files.length} test files (${scriptCount} script, ${files.length - scriptCount} typescript)`,
);

const args = [
  // Type stripping keeps the TypeScript tests running without a build step.
  "--experimental-strip-types",
  // Application source is written for Vite's resolver; this teaches Node the
  // `@/` alias and extensionless imports so test modules can actually load.
  "--import",
  "./scripts/test-resolve-hook.mjs",
  "--test",
  ...process.argv.slice(2),
  ...files,
];

const child = spawn(process.execPath, args, { stdio: "inherit", cwd: root });

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (err) => {
  console.error("[run-tests] failed to start the test runner:", err?.message || err);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  process.exit(exitStatusFromChild(code, signal));
});
