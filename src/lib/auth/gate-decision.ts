/**
 * The route guard's decision, as data.
 *
 * Split out of `gates.tsx` so it can be tested without a router or a DOM - the
 * bug this encodes was a logic bug, and a logic bug deserves a logic test.
 */

/** Where signed-out visitors are sent. */
export const SIGN_IN_PATH = "/login";

export type AuthGateDecision =
  | { kind: "wait" }
  | { kind: "allow" }
  | { kind: "hold" }
  | { kind: "redirect"; to: string; redirectTo: string };

/**
 * `hold` is the case that is easy to miss and expensive to get wrong: the
 * guard stays mounted through the router transition and renders once more with
 * the pathname already changed to the sign-in route. Navigating again from
 * there carried `redirect: "/login"`, overwriting the real destination - so a
 * new customer who clicked "Open the app", signed in, and landed back on the
 * sign-in screen. Once we are on the sign-in route the login page owns the
 * URL, and the guard must leave it alone.
 */
export function decideAuthGate({
  isPending,
  hasUser,
  pathname,
}: {
  isPending: boolean;
  hasUser: boolean;
  pathname: string;
}): AuthGateDecision {
  if (isPending) return { kind: "wait" };
  if (hasUser) return { kind: "allow" };
  if (pathname === SIGN_IN_PATH) return { kind: "hold" };
  return { kind: "redirect", to: SIGN_IN_PATH, redirectTo: pathname };
}
