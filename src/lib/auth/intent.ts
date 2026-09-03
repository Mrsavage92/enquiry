/**
 * Signup and sign-in as two explicit customer intents.
 *
 * Before this, both were one call to `signInWithOtp` with Supabase's default
 * `shouldCreateUser: true`, under a page that said "Sign in". Typing a typo'd
 * address on that screen silently created a second account and mailed a
 * "Confirm Your Signup" email, so the customer could not tell which of the two
 * things they had just done.
 *
 * The split is behavioural, not cosmetic:
 *
 * - `signup`  - creation allowed. Existing addresses still just get a link, so
 *               there is nothing to enumerate.
 * - `signin`  - `shouldCreateUser: false`. Supabase then errors for an unknown
 *               address, and that error is exactly what MUST NOT reach the
 *               screen: it answers "does this person have an account?" for
 *               anyone who asks. `classifyAuthError` folds it back into the
 *               ordinary sent state.
 */

export type AuthIntent = "signup" | "signin";

/** Whether this intent may bring a new account into existence. */
export function shouldCreateUser(intent: AuthIntent): boolean {
  return intent === "signup";
}

export type AuthErrorKind =
  /** Not shown as an error: reporting it would reveal whether an account exists. */
  | "silent"
  | "rate-limited"
  | "invalid-email"
  | "unavailable"
  | "unknown";

export type ClassifiedAuthError = {
  kind: AuthErrorKind;
  /** Copy for the customer. Never mentions whether an account exists. */
  message: string;
  /** True when the UI should show the ordinary "check your email" state instead. */
  treatAsSent: boolean;
};

/**
 * Supabase codes meaning "there is no account for this address, and this
 * request was not allowed to create one". Matched on `code` first and on the
 * message text second, because the hosted API has shipped both shapes.
 */
const ABSENT_ACCOUNT_CODES = new Set([
  "otp_disabled",
  "signup_disabled",
  "signups_not_allowed",
  "user_not_found",
]);

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

const INVALID_EMAIL_CODES = new Set([
  "email_address_invalid",
  "validation_failed",
]);

function errorCode(error: unknown): string {
  const e = (error ?? {}) as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : "";
  if (code) return code.toLowerCase();
  const status = typeof e.status === "number" ? e.status : 0;
  return status === 429 ? "over_request_rate_limit" : "";
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  const e = (error ?? {}) as Record<string, unknown>;
  return typeof e.message === "string" ? e.message.toLowerCase() : "";
}

/**
 * Turn a provider error into copy that is safe to render.
 *
 * The important branch is `signin` + absent account: it returns `treatAsSent`,
 * so a probe for a stranger's address gets the identical screen a real customer
 * gets. The mail genuinely was not sent - the UI is careful never to claim
 * delivery, only that a link is on its way if the account exists.
 */
export function classifyAuthError(
  error: unknown,
  intent: AuthIntent,
): ClassifiedAuthError {
  const code = errorCode(error);
  const text = errorText(error);

  const absentAccount =
    ABSENT_ACCOUNT_CODES.has(code) ||
    text.includes("signups not allowed") ||
    text.includes("user not found");

  if (absentAccount) {
    if (intent === "signin") {
      return {
        kind: "silent",
        message: "",
        treatAsSent: true,
      };
    }
    return {
      kind: "unavailable",
      message: "New accounts are not being created right now. Try again shortly.",
      treatAsSent: false,
    };
  }

  if (RATE_LIMIT_CODES.has(code) || text.includes("rate limit")) {
    return {
      kind: "rate-limited",
      message: "Too many requests from here. Wait a minute, then try again.",
      treatAsSent: false,
    };
  }

  if (INVALID_EMAIL_CODES.has(code) || text.includes("invalid email")) {
    return {
      kind: "invalid-email",
      message: "That email address does not look right. Check it and try again.",
      treatAsSent: false,
    };
  }

  return {
    kind: "unknown",
    message: "We could not start that request. Try again in a moment.",
    treatAsSent: false,
  };
}

/**
 * What the sent screen may honestly say. The API resolving means the request
 * was accepted, NOT that mail was delivered, so no copy here promises arrival.
 */
export function sentStateCopy(intent: AuthIntent): { heading: string; body: string } {
  return intent === "signup"
    ? {
        heading: "Confirm your email",
        body: "We have asked our mail provider to send a confirmation link to",
      }
    : {
        heading: "Check your email",
        body: "If an Enquiry account uses this address, a sign-in link is on its way to",
      };
}
