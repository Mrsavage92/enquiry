/**
 * A day that cannot move: a wedding, a school formal, a birthday party, a
 * funeral, a deadline ("by Friday", "before we move in"). Offering "Would
 * Monday suit instead?" for a wedding tells the customer the owner did not
 * read the message. Read from event words near the day they wrote.
 */

const EVENT =
  /\b(wedding|married|marrying|bridal|bride|formal|birthday|party|event|funeral|memorial|christening|baptism|engagement|graduation|anniversary|hens|bucks|baby\s+shower|gala|ball|recital|photo\s*shoot|ceremony|reception|deadline)\b/i;

/** "by Friday 10 October", "before we move in", "no later than the 9th". */
const DEADLINE_BEFORE = /\b(?:by|before|no later than|ready for)\s+(?:the\s+)?$/i;
const MOVE_DEADLINE = /\bbefore\s+(?:we|i|they)\s+move\b|\bbefore\s+(?:my|our|the)\s+move\b/i;

/** How far either side of the day an event word still belongs to it. */
const NEAR = 60;

/**
 * The event the day is for ("wedding", "formal", "deadline"), when the words
 * around the day they wrote name one; undefined otherwise.
 */
export function fixedEventNear(message: string, span: string | undefined): string | undefined {
  const said = (span ?? "").trim();
  if (!message.trim() || !said) return undefined;
  const at = message.toLowerCase().indexOf(said.toLowerCase());
  if (at === -1) return undefined;
  const before = message.slice(Math.max(0, at - NEAR), at);
  const after = message.slice(at + said.length, at + said.length + NEAR);
  if (DEADLINE_BEFORE.test(before)) return "deadline";
  const near = `${before} ${said} ${after}`;
  if (MOVE_DEADLINE.test(near)) return "deadline";
  const event = EVENT.exec(near)?.[1]?.toLowerCase();
  if (!event) return undefined;
  return event === "married" || event === "marrying" ? "wedding" : event;
}
