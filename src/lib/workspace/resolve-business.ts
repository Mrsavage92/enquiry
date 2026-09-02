import type { Business } from "@/domain/types";

/**
 * Resolve the business an enquiry, booking or screen belongs to.
 *
 * Components used to fall back to the static fixture catalogue
 * (`BUSINESS_BY_ID[id]`) whenever the id was not in the loaded list. In live
 * mode that is wrong twice over: a real tenant's uuid is never in the fixture
 * map, so the fallback silently yields undefined, and if an id ever did collide
 * it would render a demo studio's name, prices and policies as the tenant's own.
 *
 * Live mode therefore resolves only from the authenticated workspace. Demo mode
 * keeps its fixture fallback, which is where fixtures belong.
 */
export function resolveBusiness(
  businesses: Business[],
  businessId: string | undefined,
  opts: { demoMode: boolean; fixtures?: Record<string, Business> },
): Business | undefined {
  if (!businessId) return undefined;
  const found = businesses.find((b) => b.id === businessId);
  if (found) return found;
  return opts.demoMode ? opts.fixtures?.[businessId] : undefined;
}

/**
 * The roster a "Working as" / "Workspace" picker may list.
 *
 * Two screens (Business Brain, Trust) built this inline as
 * `BUSINESSES.map(...)` with no `demoMode` check at all, so a real signed-in
 * tenant's selector listed every fixture studio's name - Ridge & Co Painting,
 * Northlight Photography - as if they were switchable workspaces. Extracted
 * once, alongside `resolveBusiness`, so every picker asks the same tested
 * question instead of five components carrying their own copy of the ternary.
 */
export function visibleBusinesses(
  businesses: Business[],
  opts: { demoMode: boolean; fixtures: readonly Business[] },
): readonly Business[] {
  return opts.demoMode ? opts.fixtures : businesses;
}
