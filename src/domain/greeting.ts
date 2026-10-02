/**
 * Who the reply greets (research doc 51, decision 2).
 *
 * A name read from the customer's sign-off goes into the greeting by itself
 * only when a second, independent signal agrees with it: their email address,
 * or the name written somewhere else in the message ("I'm Tom"). Otherwise
 * the reply says "Hi there," and the screen offers "Greet as Tom?". The owner
 * can always switch either way; that choice is the `greeting` fact, which is
 * internal (never a customer name, never in a list row, never in the coverage
 * key). Recording a send that greets by the read name confirms the reading.
 */

export const GREETING_FIELD = "greeting";

export const GREETING_CHOICE = {
  /** "Hi there,", whatever was read. */
  there: "there",
  /** Greet by the name read from their message. */
  name: "name",
} as const;

export type GreetingChoice = (typeof GREETING_CHOICE)[keyof typeof GREETING_CHOICE];

export function isGreetingChoice(value: string): value is GreetingChoice {
  return value === GREETING_CHOICE.there || value === GREETING_CHOICE.name;
}

/** "Margaret & Tony Russo" is greeted as "Margaret & Tony"; one name by its first word. */
export function greetedFirst(customerName: string): string {
  const who = customerName.trim();
  return /^(\S+\s+(?:&|and)\s+\S+)/.exec(who)?.[1] ?? who.split(/\s+/)[0] ?? "";
}

/** The greeting line a reply opens with for this name ("" greets "Hi there,"). */
export function greetingLine(first: string): string {
  return first ? `Hi ${first},` : "Hi there,";
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const INTRO = /\b(?:i'?m|i am|my name is|this is|it'?s)\s+([A-Za-z][A-Za-z'-]+)/gi;

function plainFirst(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z'-]/g, "");
}

/** The words of an email's local part: "tom.nguyen92" -> tom, nguyen. */
function localWords(email: string): string[] {
  const local = email.split("@")[0] ?? "";
  return local
    .toLowerCase()
    .split(/[._+\-\d]+/)
    .filter((w) => w.length >= 2);
}

export type NameSignal = "email" | "intro";

/**
 * The independent signals that agree with a read name. The sign-off reading
 * itself is the first signal; each one returned here is a second.
 */
export function nameSignals(
  readName: string,
  sources: { emails?: readonly string[]; message?: string },
): NameSignal[] {
  const first = plainFirst(readName);
  if (first.length < 2) return [];
  const out: NameSignal[] = [];
  const message = sources.message ?? "";
  const emails = [...(sources.emails ?? []), ...(message.match(EMAIL) ?? [])];
  if (emails.some((e) => localWords(e).includes(first))) out.push("email");
  for (const m of message.matchAll(INTRO)) {
    if ((m[1] ?? "").toLowerCase() === first) {
      out.push("intro");
      break;
    }
  }
  return out;
}

/** "from sign-off and email" for the greeting row. */
export function signalWords(signals: readonly NameSignal[]): string {
  const said = signals.map((s) => (s === "email" ? "email" : "message"));
  return ["sign-off", ...said].join(" and ");
}
