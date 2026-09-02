import { safeReturnPath } from "./return-path.ts";

/**
 * What `/auth/complete` should render, as one pure decision.
 *
 * This route is the only destination for an email or OAuth return, so it is
 * also the only place four independent things can be half-resolved at once:
 * the link itself, the Supabase session, the server workspace, and where the
 * person was originally heading. Deciding that inline in the component is how
 * you get a screen that redirects optimistically to `/enquiries` while the
 * workspace call is still in flight - or worse, after it failed.
 *
 * Every state is named, so "we do not know yet" can never collapse into "no".
 */

/** Where a confirmed user with no workspace is sent. */
export const ONBOARDING_PATH = "/onboarding";

export type SessionPhase = "pending" | "signed-in" | "signed-out";

export type WorkspacePhase =
  /** Not asked yet. */
  | "idle"
  | "loading"
  | "needs-onboarding"
  | "ready"
  | "failed";

/** An error handed back by the auth provider on the return URL itself. */
export type AuthLinkError = {
  code: string | null;
  description: string | null;
};

export type AuthCompletionInput = {
  linkError: AuthLinkError | null;
  session: SessionPhase;
  workspace: WorkspacePhase;
  /** The in-app path the visitor was originally heading to. Re-validated here. */
  returnPath?: unknown;
};

export type AuthCompletionView =
  /** The link was consumed, expired, or already used. Recoverable by asking again. */
  | { phase: "link-expired" }
  /** The provider refused the link for another reason. */
  | { phase: "link-invalid"; detail: string | null }
  /** Supabase is still exchanging the link for a session. */
  | { phase: "confirming" }
  /** The link resolved but produced no session - ask for a fresh one. */
  | { phase: "no-session" }
  /** Signed in; the workspace call is still in flight. */
  | { phase: "resolving" }
  /** The workspace call failed. Do NOT guess which way to route. */
  | { phase: "workspace-failed" }
  | { phase: "redirect"; to: string };

const EXPIRED_CODES = new Set([
  "otp_expired",
  "token_expired",
  "expired_token",
  "flow_state_expired",
]);

/**
 * Read a provider error off the return URL.
 *
 * Supabase reports failures in the fragment for the implicit flow and in the
 * query string for PKCE, so both are read - fragment first, because that is
 * where a magic-link failure lands.
 */
export function parseAuthCallbackError(
  hash: string | null | undefined,
  search: string | null | undefined,
): AuthLinkError | null {
  for (const raw of [hash ?? "", search ?? ""]) {
    const trimmed = raw.replace(/^[#?]/, "");
    if (!trimmed) continue;
    const params = new URLSearchParams(trimmed);
    const error = params.get("error") ?? params.get("error_code");
    if (!error) continue;
    return {
      code: params.get("error_code") ?? params.get("error"),
      description: params.get("error_description")?.replace(/\+/g, " ") ?? null,
    };
  }
  return null;
}

function isExpired(error: AuthLinkError): boolean {
  const code = (error.code ?? "").toLowerCase();
  if (EXPIRED_CODES.has(code)) return true;
  const description = (error.description ?? "").toLowerCase();
  return description.includes("expired");
}

/**
 * Resolve the completion screen.
 *
 * Order matters: a link error outranks the session, because Supabase can leave
 * a stale session in local storage while the link the person just clicked was
 * refused. Routing them onward on the strength of that old session would hide
 * a real failure behind an apparent success.
 */
export function resolveAuthCompletion({
  linkError,
  session,
  workspace,
  returnPath,
}: AuthCompletionInput): AuthCompletionView {
  if (linkError) {
    return isExpired(linkError)
      ? { phase: "link-expired" }
      : { phase: "link-invalid", detail: linkError.description };
  }

  if (session === "pending") return { phase: "confirming" };
  if (session === "signed-out") return { phase: "no-session" };

  switch (workspace) {
    case "idle":
    case "loading":
      return { phase: "resolving" };
    case "failed":
      return { phase: "workspace-failed" };
    case "needs-onboarding":
      return { phase: "redirect", to: ONBOARDING_PATH };
    case "ready":
      return { phase: "redirect", to: safeReturnPath(returnPath) };
  }
}
