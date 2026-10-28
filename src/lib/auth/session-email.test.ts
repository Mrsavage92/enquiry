import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p: string) => readFileSync(p, "utf8");

// Server functions receive the Supabase token through middleware context, never
// as an Authorization header, so getSessionUser() with no token is always null.
// That once blanked app_user.email and would have refused every paying founder
// at onboarding once founding_gate was on (go-live review 2026-10-07).
test("the verified email reaches server functions through the auth middleware", () => {
  assert.match(read("src/lib/auth/middleware.ts"), /userEmail: user\.email/);
});

test("no server function asks for the session without the token", () => {
  for (const file of ["src/lib/server/workspace.ts", "src/lib/server/enquiry-actions.ts"]) {
    assert.doesNotMatch(read(file), /getSessionUser\(\s*\)/, `${file} calls getSessionUser() with no token`);
  }
});
