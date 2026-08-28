/**
 * How a server function should resolve the caller's identity.
 *
 * Extracted as a pure function because this is the single most consequential
 * branch in the app: get it wrong in the "auth off, real database" direction and
 * every visitor shares one identity on live customer data. Keeping it free of
 * module-scope env reads means it can be tested exhaustively rather than
 * reasoned about.
 */
export type AccessMode =
  /** Verify the caller's token and use the resulting user id. */
  | "verify"
  /** Local prototype mode: no auth, no real database, one shared dev user. */
  | "dev-user"
  /** Fail closed: auth is off but a real database is configured. */
  | "refuse";

export type AccessInputs = {
  /** Auth is switched on AND actually configured well enough to verify anyone. */
  authConfigured: boolean;
  /** A real (non-embedded) database is configured. */
  databaseConfigured: boolean;
};

/**
 * The rule, in one place:
 *
 * - Auth configured -> always verify, database or not.
 * - Auth off, no database -> the shared dev user. This is the deliberate
 *   local prototype mode and it is safe because the data is disposable.
 * - Auth off, database present -> REFUSE. A shared dev user against a real
 *   database would let every visitor read and write everyone's rows. This is a
 *   misconfiguration, not a mode, so it must fail loudly rather than degrade.
 */
export function resolveAccessMode({
  authConfigured,
  databaseConfigured,
}: AccessInputs): AccessMode {
  if (authConfigured) return "verify";
  return databaseConfigured ? "refuse" : "dev-user";
}
