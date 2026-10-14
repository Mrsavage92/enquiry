/**
 * What a failed action says to the owner (go-live review S1): never a raw
 * developer message such as "Failed to fetch dynamically imported module:
 * http://...". A refusal the server words for the owner ("Enter the answer.")
 * is kept as it is; a network, loading or internal failure becomes one plain
 * line that says what to do.
 */

export const TRY_AGAIN = "Couldn't save that. Check your connection, then tap it again.";

/** Signs of a failure that is not a sentence written for the owner. */
const TECHNICAL =
  /failed to fetch|fetch failed|dynamically imported module|importing a module script|load failed|networkerror|network request|typeerror|syntaxerror|referenceerror|unexpected token|is not a function|cannot read|undefined|null|econn|etimedout|status code|internal server|https?:\/\/|\bat \w+ \(|\.js\b|\.ts\b|stack|abort/i;

/** The longest server sentence shown as written; anything longer is not a refusal line. */
const MAX_OWNER_MESSAGE = 240;

export function ownerError(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message || message.length > MAX_OWNER_MESSAGE || TECHNICAL.test(message)) return TRY_AGAIN;
  return message;
}
