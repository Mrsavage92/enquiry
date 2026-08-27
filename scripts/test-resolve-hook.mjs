/**
 * Bundler-style module resolution for Node's test runner.
 *
 * The application source is written for Vite's resolver, which supplies two
 * things Node's ESM resolver does not:
 *
 *   1. the `@/*` -> `./src/*` alias from `tsconfig.json`;
 *   2. extensionless specifiers (`./helpers`, `@/domain/labels`).
 *
 * Without both, any test whose module graph reaches application source dies
 * with ERR_MODULE_NOT_FOUND before a single assertion runs. That is precisely
 * why the domain suite could sit in the repository looking green while never
 * executing a line.
 *
 * This shim is test-only. It does not touch how Vite builds the app, and it
 * resolves nothing Vite would not have resolved the same way.
 *
 * `registerHooks` is synchronous and in-thread, so it needs no worker/port
 * plumbing and composes with the strip-types loader running alongside it.
 */
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ALIAS = "@/";

/** Extensions tried for an extensionless specifier, in Vite's precedence. */
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json"];

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * The absolute path an `@/…` specifier points at, or null when it is not an
 * alias. Exported so the mapping is unit-testable without loading a module.
 */
export function aliasTarget(specifier, root) {
  if (typeof specifier !== "string" || !specifier.startsWith(ALIAS)) return null;
  const rest = specifier.slice(ALIAS.length);
  if (!rest) return null;
  return join(root, "src", rest);
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * The concrete file an extensionless path refers to, or null when none exists.
 * Mirrors Vite: exact file first, then extensions, then a directory index.
 */
export function withExtension(path) {
  if (isFile(path)) return path;
  for (const ext of EXTENSIONS) {
    if (isFile(`${path}${ext}`)) return `${path}${ext}`;
  }
  for (const ext of EXTENSIONS) {
    const index = join(path, `index${ext}`);
    if (isFile(index)) return index;
  }
  return null;
}

const root = projectRoot();

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliased = aliasTarget(specifier, root);
    if (aliased) {
      const file = withExtension(aliased);
      if (file) return { shortCircuit: true, url: pathToFileURL(file).href };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      // Only extensionless relative/absolute specifiers get a second chance;
      // a genuinely missing package must still fail loudly.
      if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) throw err;
      const base = context?.parentURL
        ? dirname(fileURLToPath(context.parentURL))
        : root;
      const file = withExtension(resolvePath(base, specifier));
      if (!file) throw err;
      return { shortCircuit: true, url: pathToFileURL(file).href };
    }
  },
});
