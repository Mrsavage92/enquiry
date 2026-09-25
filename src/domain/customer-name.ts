/**
 * How a customer is named on screen when the message did not say.
 *
 * A pasted "hey mate ... - Priya" used to leave an empty header, an empty
 * avatar and a row with no name at all, and sentences built from the first
 * name came out as "the customer answered?". Every screen reads the name
 * through here so none of them can render a blank.
 */

/** Shown in place of a name nobody gave. */
export const UNKNOWN_CUSTOMER = "Customer";

type Named = { customerName?: string | null; nameUnknown?: boolean };

export function hasName(e: Named): boolean {
  if (e.nameUnknown) return false;
  const name = (e.customerName ?? "").trim();
  return Boolean(name) && name !== UNKNOWN_CUSTOMER;
}

/** The full name, or "Customer". Never empty. */
export function displayName(e: Named): string {
  return hasName(e) ? (e.customerName ?? "").trim() : UNKNOWN_CUSTOMER;
}

/** "Karen", or "the customer" mid-sentence. */
export function firstName(e: Named): string {
  return hasName(e) ? (e.customerName ?? "").trim().split(/\s+/)[0]! : "the customer";
}

/** "KM", or "?" when there is no name to take letters from. */
export function initialsOf(e: Named): string {
  if (!hasName(e)) return "?";
  return (e.customerName ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Every generated sentence starts with a capital: "The customer answered?". */
export function sentence(text: string): string {
  const t = text.trimStart();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}
