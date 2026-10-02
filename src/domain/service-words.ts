/**
 * The words a service name is recognised by in a customer's message, shared by
 * the service chooser, the extra-request reader and the quantity reader so all
 * three agree on what "the message names this service" means.
 */

const IGNORED = new Set([
  "and",
  "the",
  "for",
  "with",
  "our",
  "your",
  "service",
  "services",
  "job",
  "per",
]);

/** Painting words: "outside" and "inside" name exterior and interior work only beside one. */
const PAINT_WORK = /\b(?:paint\w*|repaint\w*|colou?rs?|coats?)\b/i;
const OUTSIDE = /\b(?:outside|external|outdoors?|exteriors?)\b/i;
const INSIDE = /\b(?:inside|internal|indoors?)\b/i;
/** "walls" are interior work, unless they are the outside, brick or garden walls. */
const WALLS = /\bwalls?\b/i;
const OUTER_WALLS =
  /\b(?:outside|external|exterior|outer|brick|retaining|garden|fence|boundary|front)\s+walls?\b/i;

/**
 * The service words a customer says without the service's name: "the walls"
 * are interior painting; "paint the outside" is exterior painting. Added to
 * the words they wrote, never replacing them.
 */
function impliedWords(text: string): string[] {
  const out: string[] = [];
  // "gel mani", "gel nails": a manicure; "vacate clean", "bond clean", "exit
  // clean": an end of lease clean, whatever the business calls it.
  if (/\b(?:mani|manis|nails?)\b/i.test(text)) out.push("manicure");
  if (/\b(?:pedi|pedis)\b/i.test(text)) out.push("pedicure");
  if (/\b(?:vacate|vacating|bond|exit|move[- ]?out|moving[- ]?out)\s+clean/i.test(text)) {
    out.push("end", "lease");
  }
  if (WALLS.test(text) && !OUTER_WALLS.test(text)) out.push("interior");
  for (const sentence of text.split(/[.!?\n]/)) {
    if (!PAINT_WORK.test(sentence)) continue;
    if (OUTSIDE.test(sentence)) out.push("exterior");
    if (INSIDE.test(sentence)) out.push("interior");
  }
  return out;
}

/** Meaningful words, lower case: "End of lease clean" -> ["end", "lease", "clean"]. */
export function serviceWords(text: string): string[] {
  const said = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w));
  const implied = impliedWords(text).filter((w) => !said.includes(w));
  return implied.length ? [...said, ...new Set(implied)] : said;
}

/** A shared stem: "paint" in "painted" and "painting", "clean" in "cleaning", "ceili" in "ceilings". */
export function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word.replace(/s$/, "");
}

export function stemsOf(text: string): string[] {
  return serviceWords(text).map(stem);
}

/**
 * The stems that tell this service apart from the others: "oven" for "Oven
 * clean" beside "End of lease clean", "ceili" for "Ceilings" beside "Interior
 * wall painting". A service with none (a subset of another's name) has no
 * words of its own to be found by.
 */
export function distinctiveStems(service: string, others: readonly string[]): string[] {
  const shared = new Set(others.flatMap(stemsOf));
  return [...new Set(stemsOf(service))].filter((s) => !shared.has(s));
}

/** Whether a piece of text mentions any of these stems. */
export function mentionsAny(text: string, stems: readonly string[]): boolean {
  if (stems.length === 0) return false;
  const said = new Set(stemsOf(text));
  return stems.some((s) => said.has(s));
}

/** Work words most services share: never enough on their own to name one. */
const GENERIC_STEMS = new Set([
  "remov",
  "clean",
  "servi",
  "job",
  "work",
  "repai",
  "paint",
  "wash",
  "insta",
  "treat",
  "fix",
]);

/**
 * Whether text names this service: every one of its own words (not the work
 * word it shares with others) is there. "rubbish removal" does not name
 * "mould removal"; "mould inspections" does not name "black mould".
 */
export function namesService(text: string, service: string): boolean {
  const all = [...new Set(stemsOf(service))];
  const own = all.filter((s) => !GENERIC_STEMS.has(s));
  const need = own.length ? own : all;
  if (need.length === 0) return false;
  const said = new Set(stemsOf(text));
  return need.every((s) => said.has(s));
}

/** "Nothing bridal", "not the bride", "no bridesmaids": what they say they don't want. */
const NEGATED_THING = /\b(?:nothing|not|no|non)[- ]+(?:the\s+|a\s+|an\s+|any\s+)?([a-z]{3,})\b/gi;

/**
 * The message with what they turned down taken out, so it never names a
 * service: "Nothing bridal, just glam" is not a bridal booking, and "not the
 * bride, i'm a bridesmaid" drops "bride" and "bridal" but keeps "bridesmaid".
 */
export function withoutNegated(text: string): string {
  const negated = [...text.matchAll(NEGATED_THING)].map((m) => m[1]!.toLowerCase());
  if (negated.length === 0) return text;
  const out = text.replace(NEGATED_THING, " ");
  return out.replace(/[A-Za-z]+/g, (w) => {
    const x = w.toLowerCase();
    const gone = negated.some(
      (n) => x === n || (x.startsWith(n.slice(0, -1)) && x.length <= n.length + 2),
    );
    return gone ? " " : w;
  });
}
