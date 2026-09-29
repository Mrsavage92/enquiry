/**
 * A day that cannot move: a wedding, a school formal, a birthday party, a
 * funeral, a deadline ("by Friday", "before we move in"), or a property date
 * (an open home, the inspection, settlement, the keys going back). Offering
 * "Would Monday suit instead?" for any of these tells the customer the owner
 * did not read the message. Read from event words about the job's own day, in
 * the sentence that names it.
 */

const EVENT =
  /\b(wedding|married|marrying|bridal|bride|formal|birthday|party|event|funeral|memorial|christening|baptism|engagement|graduation|anniversary|hens|bucks|baby\s+shower|gala|ball|recital|photo\s*shoot|ceremony|reception|deadline|open\s+home|inspection|settlement|handover|hand\s+over|auction|move[- ]?out|moving\s+out|keys?\s+(?:back|go\s+back|handed\s+back|due)|lease\s+(?:ends?|finishes|is\s+up))\b/i;

/** "my daughter's 18th", "our 21st": a birthday by its number. */
const ORDINAL_BIRTHDAY =
  /\b(?:my|our|his|her|their|[a-z]+'s)\s+\d{1,2}(?:st|nd|rd|th)\b(?!\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i;

/** The event word names a thing, not the day: "wedding cake stand", "party supplies". */
const THING_AFTER =
  /^\s+(?:cake|dress|dresses|stand|supplies|decorations?|decor|photos?|gifts?|album|shoes|suit|hire|gear|stuff|leftovers)\b/i;

/** The event is not this job's day: "the wedding was last week", "going to a wedding". */
const NOT_THE_DAY =
  /\b(?:was|were|went|had|last\s+(?:week|month|year|time|weekend)|ago|going\s+to\s+(?:a|the)|attending|so\s+any\s+(?:day|weekday)|any\s+(?:weekday|day)\s+is\s+fine|after\s+the)\b/i;

/** "by Friday 10 October", "before we move in", "no later than the 9th". */
const DEADLINE_BEFORE = /\b(?:by|before|no later than|ready for)\s+(?:the\s+)?$/i;
const MOVE_DEADLINE = /\bbefore\s+(?:we|i|they)\s+move\b|\bbefore\s+(?:my|our|the)\s+move\b/i;

/** The sentence around a position. */
function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const from =
    Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
      before.lastIndexOf("\n"),
    ) + 1;
  const rest = text.slice(end);
  const stop = rest.search(/[.!?\n]/);
  return text.slice(from, stop === -1 ? text.length : end + stop);
}

/**
 * The event the day is for ("wedding", "formal", "birthday", "deadline"), when
 * the sentence that names the day is about it; undefined otherwise.
 */
export function fixedEventNear(message: string, span: string | undefined): string | undefined {
  const said = (span ?? "").trim();
  if (!message.trim() || !said) return undefined;
  const at = message.toLowerCase().indexOf(said.toLowerCase());
  if (at === -1) return undefined;
  const before = message.slice(Math.max(0, at - 60), at);
  if (DEADLINE_BEFORE.test(before)) return "deadline";
  const sentence = sentenceAround(message, at, at + said.length);
  if (MOVE_DEADLINE.test(sentence)) return "deadline";
  if (NOT_THE_DAY.test(sentence)) return undefined;
  if (ORDINAL_BIRTHDAY.test(sentence)) return "birthday";
  for (const m of sentence.matchAll(new RegExp(EVENT.source, "gi"))) {
    const after = sentence.slice((m.index ?? 0) + m[0].length);
    if (THING_AFTER.test(after)) continue;
    const word = m[1]!.toLowerCase();
    if (/^(?:married|marrying|bridal|bride)$/.test(word)) return "wedding";
    if (
      /^(?:open|inspection|settlement|hand|handover|auction|move|moving|keys?|lease)/.test(word)
    ) {
      return "deadline";
    }
    return word;
  }
  return undefined;
}
