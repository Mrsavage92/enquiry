/**
 * Every sentence that names a count, built in one place.
 *
 * The count for a second line on a quote is stored as "rooms for ceiling" or
 * "windows for windows", and each screen used to glue that key into its own
 * sentence: "how many windows for windows", "the rooms for ceiling". This turns
 * a stored field into its parts once, and every question, label and button
 * reads from here.
 */

/**
 * A stored field name as a person says it: "num_bedrooms" and "numBedrooms"
 * read as "bedrooms", "gutter_metres" as "gutter metres".
 */
export function humanField(field: string): string {
  return field
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^(?:num|no|nr|qty|count|number|total)(?: of)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type CountParts = {
  /** What is counted, plural: "rooms", "square metres", "windows". */
  noun: string;
  /** The line it is counted for, when it is not the main job: "the ceiling". */
  forService?: string;
  /** Whether the noun is a count at all ("address" is not). */
  isCount: boolean;
};

const stemOf = (w: string) => w.toLowerCase().replace(/(?:es|s)$/, "");

/** "rooms for ceiling" -> { noun: "rooms", forService: "the ceiling" }. */
export function countParts(field: string): CountParts {
  const human = humanField(field);
  const split = /^(.+?)\s+for\s+(.+)$/.exec(human);
  const noun = (split?.[1] ?? human).trim();
  const isCount = /[^s]s$/.test(noun) || noun === "people";
  if (!split) return { noun, isCount };
  const service = split[2]!.trim().replace(/^the\s+/, "");
  // "windows for windows": the service is the thing counted, said once.
  const nounStems = noun.split(/\s+/).map(stemOf);
  const serviceStems = service.split(/\s+/).map(stemOf);
  if (nounStems.some((s) => serviceStems.includes(s))) return { noun, isCount };
  return { noun, forService: `the ${service}`, isCount };
}

function tail(parts: CountParts): string {
  return parts.forService ? ` for ${parts.forService}` : "";
}

/** "the number of rooms for the ceiling", "the number of windows", "the address". */
export function numberOf(field: string): string {
  const parts = countParts(field);
  if (!parts.noun) return "the quantity";
  return parts.isCount ? `the number of ${parts.noun}${tail(parts)}` : `the ${parts.noun}`;
}

/** "how many rooms for the ceiling", "how many windows"; null for a non-count. */
export function howMany(field: string): string | null {
  const parts = countParts(field);
  return parts.isCount && parts.noun ? `how many ${parts.noun}${tail(parts)}` : null;
}

function singularOf(noun: string): string {
  if (noun === "people") return "person";
  return /[^s]s$/.test(noun) ? noun.slice(0, -1) : noun;
}

/** "3 rooms", "1 bedroom", "1,200 square metres": a count said the way a person says it. */
export function countOf(value: string, field: string): string {
  const { noun } = countParts(field);
  const n = Number(value);
  const word = n === 1 ? singularOf(noun) : noun;
  const shown = Number.isFinite(n) && value.trim() !== "" ? n.toLocaleString("en-AU") : value;
  return `${shown} ${word}`.trim();
}

/**
 * Counts only the owner can know. A customer cannot say how many hours a paint
 * job takes; asking them is asking for a guess. These go to the owner as "How
 * many hours do you estimate?" and never into the reply as a question.
 */
const OWNER_ESTIMATES = /^(?:hours?|hrs?|days?|half days?|visits? needed|labour hours?)$/;

export function isOwnerEstimate(field: string): boolean {
  return OWNER_ESTIMATES.test(countParts(field).noun);
}

/** "How many hours do you estimate?" (for the owner) or "How many rooms for the ceiling?". */
export function ownerQuestion(field: string): string {
  const q = howMany(field);
  if (!q) return `What is ${numberOf(field)}?`;
  const sentence = isOwnerEstimate(field) ? `${q} do you estimate?` : `${q}?`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
