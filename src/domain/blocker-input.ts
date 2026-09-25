/**
 * The right input for the one detail an enquiry is waiting on.
 *
 * A number pad for a count, a plain example for a date or a place, so the
 * owner answers in the shape the decision can use without having to guess
 * what format it wants. The example is only ever a placeholder; nothing is
 * pre-filled from it.
 */
export type BlockerInput = {
  inputMode: "numeric" | "text";
  placeholder: string;
};

export function blockerInput(field: string, label = ""): BlockerInput {
  const key = `${field} ${label}`.toLowerCase();
  if (/date|when|day/.test(key)) return { inputMode: "text", placeholder: "e.g. Sat 17 Oct" };
  if (/address|suburb|location|where|postcode/.test(key)) {
    return { inputMode: "text", placeholder: "e.g. Paddington" };
  }
  if (/hour|duration|length|time/.test(key))
    return { inputMode: "text", placeholder: "e.g. 3 hours" };
  if (/service|package|type/.test(key))
    return { inputMode: "text", placeholder: "e.g. Full repaint" };
  return { inputMode: "numeric", placeholder: "e.g. 4" };
}
