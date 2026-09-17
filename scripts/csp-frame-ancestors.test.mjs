// Production must not allow-list a third party as a framing ancestor.
//
// The deployed app carries authenticated operator sessions. *.grok-sandbox.com
// serves user-generated apps, so listing it in frame-ancestors on the deployed
// origin hands any such app a clickjacking surface over a signed-in session.
// The Grok builder preview chrome (src/routes/__root.tsx PreviewHostBridge)
// genuinely needs the allowance, so it is scoped to `vite preview` and to an
// explicit ALLOW_GROK_EMBED=1 escape hatch - never to a plain production build.
//
// This reads vite.config.ts rather than a built artefact so it runs without a
// build step. Verified against the generated .vercel/output/config.json at the
// time of writing: a default `npm run build` emits `frame-ancestors 'self'`,
// and `ALLOW_GROK_EMBED=1 npm run build` emits the full allow-list.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

test("frame-ancestors is conditional, not an unconditional third-party allow-list", () => {
  // Anchor on the backtick that opens the template literal, so this reads the
  // shipped directive and not the prose in the comment above it.
  const directive = config.match(/`(frame-ancestors[^`]*)`/)?.[1];
  assert.ok(directive, "Found the frame-ancestors template literal in vite.config.ts");

  // Everything before the first interpolation is what ships unconditionally.
  // A third-party origin may only appear inside a gated branch, never here.
  const unconditional = directive.split("${")[0];
  assert.equal(unconditional.trim(), "frame-ancestors 'self'");
  assert.doesNotMatch(
    unconditional,
    /grok/i,
    "grok origins must not sit in the unconditional part of the directive",
  );
});

test("the grok allowance stays reachable, gated on preview or an explicit opt-in", () => {
  // Deleting the capability outright would be a different change from scoping
  // it. Both gates must still be present.
  assert.match(config, /isPreview/, "preview builds still allow the embed");
  assert.match(config, /ALLOW_GROK_EMBED/, "an explicit escape hatch still exists");
  assert.match(config, /grok-sandbox\.com/, "the allow-list itself is retained for those gates");
});
