import assert from "node:assert/strict";
import test from "node:test";
import { resolveBusiness, visibleBusinesses } from "./resolve-business.ts";
import type { Business } from "@/domain/types";

const glow = { id: "glow", name: "Glow & Co" } as unknown as Business;
const ridge = { id: "ridge", name: "Ridge & Co Painting" } as unknown as Business;
const FIXTURES = { glow, ridge } as Record<string, Business>;
const FIXTURE_LIST = [glow, ridge] as const;

const tenantBusiness = {
  id: "b8f2-real-uuid",
  name: "Aurora Mobile Makeup",
} as unknown as Business;

test("resolveBusiness finds the tenant's own business first, live or demo", () => {
  for (const demoMode of [true, false]) {
    assert.equal(
      resolveBusiness([tenantBusiness], tenantBusiness.id, { demoMode, fixtures: FIXTURES }),
      tenantBusiness,
    );
  }
});

test("a live tenant never falls back to a fixture, even for a colliding id", () => {
  // The R2A blocker: a real tenant's uuid is never in the fixture map, so this
  // silently returned undefined before - and if an id ever DID collide, it
  // would have rendered a demo studio's name, prices and policies as the
  // tenant's own.
  assert.equal(
    resolveBusiness([tenantBusiness], "glow", { demoMode: false, fixtures: FIXTURES }),
    undefined,
  );
  assert.equal(resolveBusiness([], "glow", { demoMode: false, fixtures: FIXTURES }), undefined);
});

test("demo mode keeps its fixture fallback", () => {
  assert.equal(resolveBusiness([], "glow", { demoMode: true, fixtures: FIXTURES }), glow);
});

test("no business id resolves to nothing, in either mode", () => {
  assert.equal(
    resolveBusiness([tenantBusiness], undefined, { demoMode: false, fixtures: FIXTURES }),
    undefined,
  );
  assert.equal(
    resolveBusiness([tenantBusiness], undefined, { demoMode: true, fixtures: FIXTURES }),
    undefined,
  );
});

test("a picker lists only the tenant's own businesses when live", () => {
  // The defect this closes: Business Brain and Trust built this inline with no
  // demoMode check, so a real signed-in tenant's "Working as" / "Workspace"
  // selector listed every fixture studio's name as if it were a switchable
  // workspace of theirs.
  const visible = visibleBusinesses([tenantBusiness], { demoMode: false, fixtures: FIXTURE_LIST });
  assert.deepEqual(visible, [tenantBusiness]);
  assert.ok(!visible.some((b) => b.id === "glow" || b.id === "ridge"));
});

test("a picker lists the fixture roster only in explicit demo mode", () => {
  const visible = visibleBusinesses([tenantBusiness], { demoMode: true, fixtures: FIXTURE_LIST });
  assert.deepEqual(visible, FIXTURE_LIST);
});

test("a live tenant with zero businesses sees an empty picker, never the fixture roster", () => {
  // The exact shape right after onboarding: workspace hydrated, no businesses
  // yet. An empty list is the honest state; falling back to fixtures here is
  // the same leak as the collision case above.
  assert.deepEqual(visibleBusinesses([], { demoMode: false, fixtures: FIXTURE_LIST }), []);
});
