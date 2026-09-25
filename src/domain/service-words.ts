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

/** Meaningful words, lower case: "End of lease clean" -> ["end", "lease", "clean"]. */
export function serviceWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w));
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
